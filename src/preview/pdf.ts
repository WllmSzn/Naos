import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { OUTPUT_DIR } from '../paths.js';
import { findBrowser } from '../scan/scan.js';
import { safePdfName } from '../screen/output.js';
import { getMode, type Mode } from '../modes/modes.js';

/**
 * Export PDF d'un écran : une page par cadre du mode (une diapo par page quand le mode
 * déclare preview.frameSelector), à la taille réelle du cadre, fonds imprimés.
 *
 * Le PDF est un livrable, pas un aperçu : il passe par page.pdf() du Chromium installé
 * (Edge ici) pour que les fonds, les polices et les emplacements d'image soient rendus
 * comme dans le navigateur, sans dépendance à un outil externe.
 */

export interface PdfOptions {
  name: string;
  /** Mode de la page : fournit les cadres, la taille de page et le runtime à neutraliser. */
  mode?: Mode;
  outDir?: string;
  /**
   * Imprime une page de notes orateur après chaque diapo, lue dans data-notes.
   * Sans notes dans la page, l'option ne change rien.
   */
  notes?: boolean;
}

export interface PdfResult {
  file: string;
  /** Taille d'une page PDF, en px CSS (= 1/96 de pouce). */
  width: number;
  height: number;
  /** Cadres trouvés dans la page : une page par cadre. */
  frames: number;
  /** Pages de notes ajoutées après les diapos (export avec notes: true). */
  notes: number;
  pages: number;
  bytes: number;
}

/** Nombre de pages d'un PDF, lu dans son arbre de pages (sans dépendance). */
export function countPdfPages(pdf: Buffer): number {
  const text = pdf.toString('latin1');
  // Le nœud racine porte « /Count N » ; on prend le plus grand, robuste aux sous-arbres.
  const counts = [...text.matchAll(/\/Count\s+(\d+)/g)].map((m) => Number(m[1]));
  if (counts.length) return Math.max(...counts);
  return (text.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
}

export async function exportPdf(html: string, opts: PdfOptions): Promise<PdfResult> {
  const dir = opts.outDir ?? OUTPUT_DIR;
  const file = path.join(dir, safePdfName(opts.name));
  const mode = opts.mode ?? getMode('website');
  const selector = mode?.preview.frameSelector;

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: findBrowser(),
      headless: true,
      args: ['--hide-scrollbars', '--mute-audio', '--no-first-run'],
    });
    const page = await browser.newPage();
    // Le runtime de présentation positionne les diapos en fixed et les met à l'échelle :
    // en impression, il ne resterait qu'une diapo. On le neutralise comme pour l'aperçu.
    await page.evaluateOnNewDocument('window.__NAOS_NO_RUNTIME__ = true;');

    const vp = mode?.viewports[0];
    await page.setViewport({ width: vp?.width ?? 1440, height: vp?.height ?? 900, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'load', timeout: 30000 });
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 }).catch(() => undefined);
    await page.evaluate('document.fonts.ready');
    await new Promise((r) => setTimeout(r, 300));

    // Taille de page = taille réelle du premier cadre, ou du viewport si le mode n'en a pas.
    const measured = (await page.evaluate(`(() => {
      const sel = ${JSON.stringify(selector ?? '')};
      const nodes = sel ? [...document.querySelectorAll(sel)] : [];
      const first = nodes[0];
      const box = first ? first.getBoundingClientRect() : null;
      return { frames: nodes.length, width: box ? Math.round(box.width) : 0, height: box ? Math.round(box.height) : 0 };
    })()`)) as { frames: number; width: number; height: number };

    const width = measured.width || vp?.width || 1440;
    const height = measured.height || vp?.height || 900;

    // Mise en page d'impression : page à la taille du cadre, marges nulles, un saut après
    // chaque cadre sauf le dernier (sinon Chromium ajoute une page blanche finale).
    // Les marges du body sont annulées : elles décaleraient chaque page de quelques pixels.
    const printCss =
      `@page{size:${width}px ${height}px;margin:0}` +
      'html,body{margin:0!important;padding:0!important;background:transparent!important}' +
      (selector
        ? `${selector}{break-after:page;break-inside:avoid}${selector}:last-of-type{break-after:auto}`
        : '');
    await page.addStyleTag({ content: printCss });

    // Notes orateur : une page après chaque diapo, à la taille de la page. Titrée
    // « Notes · diapo n / total », elle se glisse dans un PDF remis au présentateur.
    // Couleurs posées en ligne depuis les tokens : cette page n'est pas du contenu
    // édité, elle est construite par Naos, et le lint ne la voit jamais.
    const notesPages =
      opts.notes && selector
        ? ((await page.evaluate(`(() => {
      const H = ${height};
      const T = (window.NAOS && window.NAOS.tokens) || {};
      const fonts = (window.NAOS && window.NAOS.fonts) || {};
      const slides = Array.from(document.querySelectorAll(${JSON.stringify(selector)}));
      const ink = T.ink || '#111111';
      const muted = T.muted || '#666666';
      const base = T.base || '#ffffff';
      const bodyFont = fonts.body ? '"' + fonts.body + '",sans-serif' : 'sans-serif';
      const monoFont = fonts.mono ? '"' + fonts.mono + '",monospace' : 'monospace';
      let added = 0;
      slides.forEach((slide, i) => {
        const raw = (slide.getAttribute('data-notes') || '').trim();
        const page = document.createElement('section');
        page.setAttribute('data-slide', '');
        page.setAttribute('data-naos-notes-page', '');
        page.style.cssText =
          'box-sizing:border-box;margin:0;padding:96px;display:flex;flex-direction:column;gap:28px;overflow:hidden;' +
          'width:100%;height:' + H + 'px;background:' + base + ';color:' + ink + ';font-family:' + bodyFont;
        const head = document.createElement('div');
        head.style.cssText =
          'font:500 16px/1.4 ' + monoFont + ';letter-spacing:.08em;text-transform:uppercase;color:' + muted;
        head.textContent = 'Notes \\u00b7 diapo ' + (i + 1) + ' / ' + slides.length;
        const rule = document.createElement('div');
        rule.style.cssText = 'height:1px;background:' + (T.line || muted);
        const text = document.createElement('p');
        text.style.cssText = 'margin:0;white-space:pre-line;font-size:28px;line-height:1.5';
        text.textContent = raw || 'Pas de note pour cette diapo.';
        if (!raw) text.style.color = muted;
        page.appendChild(head);
        page.appendChild(rule);
        page.appendChild(text);
        slide.after(page);
        added++;
      });
      // Notes longues : réduire le texte plutôt que le couper.
      document.querySelectorAll('[data-naos-notes-page]').forEach((p) => {
        const text = p.lastElementChild;
        let size = 28;
        while (text.scrollHeight > H - 320 && size > 14) {
          size -= 2;
          text.style.fontSize = size + 'px';
        }
      });
      return added;
    })()`)) as number)
        : 0;

    const pdf = await page.pdf({
      width: `${width}px`,
      height: `${height}px`,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });

    const buffer = Buffer.from(pdf);
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, buffer);
    return {
      file,
      width,
      height,
      frames: measured.frames,
      notes: notesPages,
      pages: countPdfPages(buffer),
      bytes: buffer.length,
    };
  } finally {
    await browser?.close();
  }
}

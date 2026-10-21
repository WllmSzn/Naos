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
}

export interface PdfResult {
  file: string;
  /** Taille d'une page PDF, en px CSS (= 1/96 de pouce). */
  width: number;
  height: number;
  /** Cadres trouvés dans la page : une page par cadre. */
  frames: number;
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
      pages: countPdfPages(buffer),
      bytes: buffer.length,
    };
  } finally {
    await browser?.close();
  }
}

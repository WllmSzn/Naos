import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { OUTPUT_DIR } from '../paths.js';
import { findBrowser } from '../scan/scan.js';
import { safeScreenName } from '../screen/output.js';
import { renderChecksScript, type RenderChecks } from './checks.js';
import { getMode, type Mode } from '../modes/modes.js';

/**
 * Rendu réel d'un écran : captures découpées en tranches lisibles + contrôles de mise en page.
 * Le modèle voit enfin ce qu'il a produit.
 */

/** Nom d'un viewport du mode (ex. « mobile », « desktop-1440 »). */
export type ViewportName = string;


export interface PreviewIssue {
  rule: string;
  severity: 'error' | 'warning';
  viewport: ViewportName | 'all';
  message: string;
  samples: string[];
}

export interface PreviewShot {
  viewport: ViewportName;
  label: string;
  file: string;
  jpeg: Buffer;
}

export interface PreviewResult {
  issues: PreviewIssue[];
  shots: PreviewShot[];
  pageHeight: Record<ViewportName, number>;
  dir: string;
}

export interface PreviewOptions {
  name: string;
  /** Mode de conception : fournit les viewports et les seuils. « website » par défaut. */
  mode?: Mode;
  /** Sous-ensemble des viewports du mode, par nom. */
  viewports?: ViewportName[];
  /** Nombre maximal de tranches par viewport (le reste de la page est signalé, non capturé). */
  maxSlices?: number;
  outDir?: string;
  /** false : contrôles seuls, sans captures (audit rapide). */
  screenshots?: boolean;
}

async function settle(page: Page) {
  // Défilement complet : déclenche le chargement différé et les animations d'apparition.
  await page.evaluate(`(async () => {
    const step = Math.round(innerHeight * 0.8);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) { scrollTo(0, y); await new Promise(r => setTimeout(r, 80)); }
    scrollTo(0, 0);
    await document.fonts.ready;
    await new Promise(r => setTimeout(r, 250));
  })()`);
}

function toIssues(c: RenderChecks, viewport: ViewportName, mode: Mode): PreviewIssue[] {
  const issues: PreviewIssue[] = [];
  if (c.overflowX > 0) {
    issues.push({
      rule: 'layout.overflow-x',
      severity: 'error',
      viewport,
      message: `La page déborde de ${c.overflowX}px en largeur (défilement horizontal). Revoir largeurs fixes, grilles sans variante mobile, textes géants non adaptés.`,
      samples: c.overflowing,
    });
  }
  if (c.lowContrast.length) {
    issues.push({
      rule: 'render.contrast',
      severity: 'error',
      viewport,
      message: 'Texte sous le contraste minimal sur son fond réel (opacités et superpositions comprises).',
      samples: c.lowContrast.map((x) => `${x.ratio}:1 < ${x.required} · « ${x.text} » · ${x.fg} sur ${x.bg} · ${x.el}`),
    });
  }
  const tapViewports = mode.preview.tapTargetViewports;
  if (c.smallTargets.length && (!tapViewports.length || tapViewports.includes(viewport))) {
    issues.push({
      rule: 'render.tap-target',
      severity: 'warning',
      viewport,
      message: `Cibles trop petites pour le mode « ${mode.name} » (contrôles : ${mode.preview.controlMinHeight}px de haut, liens isolés : ${mode.preview.linkMinHeight}px).`,
      samples: c.smallTargets.map((x) => `${x.w}×${x.h}px < ${x.min} · « ${x.text} » · ${x.el}`),
    });
  }
  if (c.brokenImages.length) {
    issues.push({ rule: 'render.broken-image', severity: 'error', viewport, message: 'Images qui ne se chargent pas.', samples: c.brokenImages });
  }
  const missing = c.fonts.filter((f) => !f.loaded).map((f) => f.family);
  if (missing.length) {
    issues.push({
      rule: 'render.font',
      severity: 'warning',
      viewport,
      message: 'Polices de la DNA non chargées (hors ligne, nom inexact ou graisse absente) : le rendu utilise une police de secours.',
      samples: missing,
    });
  }
  return issues;
}

/** Fusionne les problèmes identiques relevés sur plusieurs viewports. */
function mergeIssues(list: PreviewIssue[]): PreviewIssue[] {
  const out: PreviewIssue[] = [];
  for (const issue of list) {
    const twin = out.find((o) => o.rule === issue.rule && o.rule !== 'layout.overflow-x' && o.rule !== 'render.tap-target');
    if (twin) {
      twin.viewport = 'all';
      twin.samples = [...new Set([...twin.samples, ...issue.samples])].slice(0, 12);
    } else out.push({ ...issue });
  }
  return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1));
}

export async function previewScreen(html: string, opts: PreviewOptions): Promise<PreviewResult> {
  const name = safeScreenName(opts.name).replace(/\.html$/, '');
  const dir = path.join(opts.outDir ?? path.join(OUTPUT_DIR, 'previews'), name);
  mkdirSync(dir, { recursive: true });
  const mode = opts.mode ?? getMode('website');
  if (!mode) throw new Error('Aucun mode disponible pour le rendu (content/modes/website manquant ?).');
  const unknown = (opts.viewports ?? []).filter((v) => !mode.viewports.some((x) => x.name === v));
  if (unknown.length) throw new Error(`Viewport(s) inconnu(s) du mode ${mode.id} : ${unknown.join(', ')} (disponibles : ${mode.viewports.map((v) => v.name).join(', ')})`);
  const viewports = opts.viewports?.length ? mode.viewports.filter((v) => opts.viewports!.includes(v.name)) : mode.viewports;
  const maxSlices = opts.maxSlices ?? 4;

  const issues: PreviewIssue[] = [];
  const shots: PreviewShot[] = [];
  const pageHeight = {} as Record<ViewportName, number>;
  const jsErrors = new Set<string>();
  const failedRequests = new Set<string>();

  let browser: Browser | undefined;
  try {
    browser = await puppeteer.launch({ executablePath: findBrowser(), headless: true, args: ['--hide-scrollbars', '--mute-audio', '--no-first-run'] });
    for (const vp of viewports) {
      const vpName = vp.name;
      const page = await browser.newPage();
      page.on('pageerror', (e) => jsErrors.add((e as Error).message.split('\n')[0]!.slice(0, 160)));
      page.on('console', (m) => {
        // Les ressources en échec sont déjà relevées par requestfailed.
        if (m.type() === 'error' && !/favicon|Failed to load resource/i.test(m.text())) jsErrors.add(m.text().slice(0, 160));
      });
      page.on('requestfailed', (r) => failedRequests.add(`${r.url().slice(0, 100)} (${r.failure()?.errorText ?? 'échec'})`));

      await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: vp.scale, isMobile: vp.mobile, hasTouch: vp.mobile });
      await page.setContent(html, { waitUntil: 'load', timeout: 30000 });
      // Tailwind CDN, polices et icônes arrivent après « load » : on attend le calme réseau.
      await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 }).catch(() => undefined);
      await settle(page);

      const checks = (await page.evaluate(renderChecksScript(mode.preview.controlMinHeight, mode.preview.linkMinHeight))) as RenderChecks;
      issues.push(...toIssues(checks, vpName, mode));

      const height = (await page.evaluate('document.documentElement.scrollHeight')) as number;
      pageHeight[vpName] = height;
      const slices = opts.screenshots === false ? 0 : Math.min(maxSlices, Math.ceil(height / vp.slice));
      for (let i = 0; i < slices; i++) {
        const y = i * vp.slice;
        const h = Math.min(vp.slice, height - y);
        const jpeg = Buffer.from(
          await page.screenshot({ type: 'jpeg', quality: 70, clip: { x: 0, y, width: vp.width, height: h }, captureBeyondViewport: true }),
        );
        const file = path.join(dir, `${vpName}-${i + 1}.jpg`);
        writeFileSync(file, jpeg);
        shots.push({ viewport: vpName, label: `${vpName} ${i + 1}/${slices} · ${y}–${y + h}px sur ${height}px`, file, jpeg });
      }
      if (opts.screenshots !== false && height > slices * vp.slice) {
        issues.push({
          rule: 'preview.truncated',
          severity: 'warning',
          viewport: vpName,
          message: `Seuls les ${slices * vp.slice}px du haut sont capturés (page de ${height}px). Augmenter max_slices pour voir la suite.`,
          samples: [],
        });
      }
      await page.close();
    }
  } finally {
    await browser?.close();
  }

  if (jsErrors.size) {
    issues.push({ rule: 'render.js-error', severity: 'error', viewport: 'all', message: 'Erreurs JavaScript à l’exécution (Alpine, Chart.js, script inline).', samples: [...jsErrors].slice(0, 8) });
  }
  if (failedRequests.size) {
    issues.push({ rule: 'render.request-failed', severity: 'warning', viewport: 'all', message: 'Ressources non chargées (réseau, CDN ou URL fautive).', samples: [...failedRequests].slice(0, 8) });
  }

  const merged = mergeIssues(issues);
  writeFileSync(path.join(dir, 'report.json'), JSON.stringify({ issues: merged, pageHeight, shots: shots.map((s) => s.file) }, null, 2));
  return { issues: merged, shots, pageHeight, dir };
}

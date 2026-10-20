import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { OUTPUT_DIR } from '../paths.js';
import { COLLECT_SCRIPT, type RawScan } from './collect.js';
import { analyzeScan, type ScanAnalysis } from './analyze.js';

/**
 * Scan d'une page publique avec le navigateur Chromium déjà installé (Edge ou Chrome).
 * Aucun contournement de protection anti-robots : si le site bloque, on le dit.
 */

const BROWSER_CANDIDATES = [
  process.env.HECATE_BROWSER,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/microsoft-edge',
];

export function findBrowser(): string {
  const found = BROWSER_CANDIDATES.find((p): p is string => !!p && existsSync(p));
  if (!found) throw new Error('Aucun navigateur Chromium trouvé. Définir HECATE_BROWSER avec le chemin de Chrome ou Edge.');
  return found;
}

export function validateScanUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    throw new Error(`URL invalide : ${input}`);
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Seules les URL http(s) peuvent être scannées.');
  return url;
}

export function scanSlug(url: URL): string {
  const p = url.pathname.replace(/\/+$/, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');
  return (url.hostname.replace(/^www\./, '') + (p ? `-${p}` : '')).replace(/[^a-zA-Z0-9.-]/g, '-').slice(0, 80);
}

/** Fait défiler la page pour déclencher le chargement différé et les animations d'apparition. */
async function scrollThrough(page: Page) {
  await page.evaluate(`(async () => {
    const step = Math.round(innerHeight * 0.8);
    const max = Math.min(document.documentElement.scrollHeight, 20000);
    for (let y = 0; y < max; y += step) { scrollTo(0, y); await new Promise(r => setTimeout(r, 160)); }
    scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 400));
  })()`);
}

async function googleFontsAvailable(family: string): Promise<boolean> {
  try {
    const res = await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}`, {
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface ScanResult {
  analysis: ScanAnalysis;
  fontsOnGoogle: Record<string, boolean>;
  dir: string;
  screenshots: { hero: string; full: string; mobile: string };
  heroJpeg: Buffer;
  blocked?: string;
}

export interface ScanOptions {
  outDir?: string;
  timeoutMs?: number;
}

export async function scanUrl(input: string, opts: ScanOptions = {}): Promise<ScanResult> {
  const url = validateScanUrl(input);
  const dir = path.join(opts.outDir ?? path.join(OUTPUT_DIR, 'scans'), scanSlug(url));
  mkdirSync(dir, { recursive: true });

  let browser: Browser | undefined;
  try {
    browser = await puppeteer.launch({
      executablePath: findBrowser(),
      headless: true,
      args: ['--hide-scrollbars', '--mute-audio', '--no-first-run', '--no-default-browser-check'],
      defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
    });
    const page = await browser.newPage();
    const response = await page.goto(url.href, { waitUntil: 'networkidle2', timeout: opts.timeoutMs ?? 45000 });
    const status = response?.status() ?? 0;
    await scrollThrough(page);
    await page.evaluate('document.fonts.ready');

    const raw = (await page.evaluate(COLLECT_SCRIPT)) as RawScan;
    const analysis = analyzeScan(raw);

    let blocked: string | undefined;
    if (status >= 400) blocked = `Le site a répondu ${status}.`;
    else if (raw.elements.length < 15 || /just a moment|attention required|access denied|captcha/i.test(raw.title)) {
      blocked = 'Page quasi vide ou page de vérification anti-robots : le scan n\u2019est sans doute pas représentatif.';
    }
    if (blocked) analysis.notes.unshift(blocked);

    const hero = path.join(dir, 'hero.jpg');
    const heroJpeg = Buffer.from(await page.screenshot({ type: 'jpeg', quality: 72 }));
    writeFileSync(hero, heroJpeg);

    const full = path.join(dir, 'full.jpg');
    const height = Math.min(raw.docHeight, 9000);
    await page.screenshot({ path: full as `${string}.jpeg`, type: 'jpeg', quality: 60, clip: { x: 0, y: 0, width: 1440, height } });

    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await new Promise((r) => setTimeout(r, 600));
    const mobile = path.join(dir, 'mobile.jpg');
    await page.screenshot({ path: mobile as `${string}.jpeg`, type: 'jpeg', quality: 65 });

    const families = [...new Set([analysis.fonts.display, analysis.fonts.body, analysis.fonts.mono].filter((f): f is string => !!f))];
    const fontsOnGoogle = Object.fromEntries(await Promise.all(families.map(async (f) => [f, await googleFontsAvailable(f)] as const)));
    const unavailable = families.filter((f) => !fontsOnGoogle[f]);
    if (unavailable.length) analysis.notes.push(`Polices absentes de Google Fonts (probablement sous licence) : ${unavailable.join(', ')}. Choisir un équivalent.`);

    writeFileSync(path.join(dir, 'scan.json'), JSON.stringify({ analysis, fontsOnGoogle, scannedAt: new Date().toISOString() }, null, 2));
    writeFileSync(path.join(dir, 'raw.json'), JSON.stringify(raw));

    return { analysis, fontsOnGoogle, dir, screenshots: { hero, full, mobile }, heroJpeg, blocked };
  } finally {
    await browser?.close();
  }
}

import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { loadLibrary } from '../src/dna/library.js';
import { getMode } from '../src/modes/modes.js';
import { wrapScreen } from '../src/screen/wrap.js';
import { previewScreen } from '../src/preview/preview.js';
import { exportPdf } from '../src/preview/pdf.js';
import { safePdfName } from '../src/screen/output.js';
import { findBrowser } from '../src/scan/scan.js';

let hasBrowser = true;
try {
  findBrowser();
} catch {
  hasBrowser = false;
}

const dna = loadLibrary().dnas.get('daylight-product')!;

test('preview : détecte débordement, contraste réel, cible tactile, image cassée et erreur JS', { skip: !hasBrowser && 'aucun navigateur' }, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'naos-preview-'));
  try {
    const body = `<main class="p-6"><h1 class="font-display text-4xl">Piège</h1>
      <div class="w-[1100px] bg-surface p-4">Bloc trop large</div>
      <p class="text-muted/40">Texte trop pâle</p>
      <button class="h-6 px-1 text-xs bg-accent text-accent-ink">ok</button>
      <img src="data:image/png;base64,AAAA" alt="Image cassée">
      <div x-data="{ ouvert: }"><span x-text="ouvert">x</span></div></main>`;
    const r = await previewScreen(wrapScreen(body, dna, { libs: ['alpine'] }), { name: 'piege', outDir: dir, maxSlices: 1 });
    const rules = r.issues.map((i) => i.rule);
    for (const rule of ['layout.overflow-x', 'render.contrast', 'render.tap-target', 'render.broken-image', 'render.js-error']) {
      assert.ok(rules.includes(rule), `règle manquante : ${rule} (${rules.join(', ')})`);
    }
    assert.equal(r.shots.filter((s) => s.viewport === 'desktop').length, 1);
    assert.ok(r.shots.every((s) => s.jpeg.length > 1000));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('preview : une diapo trop longue est signalée avec son numéro', { skip: !hasBrowser && 'aucun navigateur' }, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'naos-preview-'));
  try {
    const mode = getMode('presentation')!;
    // Diapo 2 volontairement plus haute que 1080px : le contenu est rogné par overflow-hidden,
    // ce que ni le défilement horizontal ni le contraste ne détectent.
    const body = `
      <section data-slide class="h-[1080px] p-24"><h1 class="text-title">Diapo courte</h1></section>
      <section data-slide class="h-[1080px] p-24"><h1 class="text-title">Diapo trop longue</h1><div class="mt-8 h-[1150px] bg-surface"></div></section>`;
    const r = await previewScreen(wrapScreen(body, dna, { mode: 'presentation' }), { name: 'diapos', mode, outDir: dir, screenshots: false });
    const issue = r.issues.find((i) => i.rule === 'render.frame-overflow');
    assert.ok(issue, `règle attendue (${r.issues.map((i) => i.rule).join(', ')})`);
    assert.equal(issue.severity, 'error');
    assert.equal(issue.samples.length, 1, 'seule la diapo 2 déborde');
    assert.match(issue.samples[0]!, /n° 2 · \d+px de trop/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('preview : un mode sans frameSelector ne contrôle aucun cadre', { skip: !hasBrowser && 'aucun navigateur' }, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'naos-preview-'));
  try {
    const body = `<section data-slide class="h-96 overflow-hidden p-6"><div class="h-[800px] bg-surface"></div></section>`;
    const r = await previewScreen(wrapScreen(body, dna, { mode: 'website' }), { name: 'sans-cadre', outDir: dir, screenshots: false });
    assert.ok(!r.issues.some((i) => i.rule === 'render.frame-overflow'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('preview : le runtime « slides » est neutralisé, les diapos restent empilées', { skip: !hasBrowser && 'aucun navigateur' }, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'naos-preview-'));
  try {
    const mode = getMode('presentation')!;
    const body = `
      <section data-slide class="h-[1080px] p-24"><h1 class="text-title">Une</h1></section>
      <section data-slide class="h-[1080px] p-24"><h1 class="text-title">Deux</h1></section>`;
    const html = wrapScreen(body, dna, { mode: 'presentation' });
    assert.match(html, /naos:slides/, 'la page produite porte bien le runtime');
    const r = await previewScreen(html, { name: 'diapo-runtime', mode, outDir: dir, screenshots: false });
    // Runtime actif, seule la diapo courante serait affichée et la page mesurerait 1080px.
    assert.equal(r.pageHeight.slide, 2160);
    assert.ok(!r.issues.some((i) => i.rule === 'render.js-error'));
    assert.ok(!r.issues.some((i) => i.rule === 'render.frame-overflow'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('export PDF : une page par diapo, à la taille du cadre, fonds imprimés', { skip: !hasBrowser && 'aucun navigateur' }, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'naos-pdf-'));
  try {
    const mode = getMode('presentation')!;
    const body = `
      <section data-slide class="h-[1080px] bg-base p-24"><h1 class="text-title">Une</h1></section>
      <section data-slide class="h-[1080px] bg-ink p-24 text-inverse"><h1 class="text-title">Deux</h1></section>
      <section data-slide class="h-[1080px] bg-base p-24"><h1 class="text-title">Trois</h1></section>`;
    const r = await exportPdf(wrapScreen(body, dna, { mode: 'presentation' }), { name: 'deck-test', mode, outDir: dir });
    assert.equal(r.frames, 3);
    assert.equal(r.pages, 3, 'ni page blanche finale, ni diapo coupée en deux');
    assert.equal(r.width, 1920);
    assert.equal(r.height, 1080);
    const pdf = readFileSync(r.file);
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.ok(pdf.length > 10000);
    assert.match(path.basename(r.file), /^deck-test\.pdf$/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('export PDF : notes orateur imprimées après chaque diapo', { skip: !hasBrowser && 'aucun navigateur' }, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'naos-pdf-'));
  try {
    const mode = getMode('presentation')!;
    const body = `
      <section data-slide class="h-[1080px] bg-base p-24" data-notes="Ouvrir sur le chiffre, sans le commenter.&#10;Laisser un silence."><h1 class="text-title">Une</h1></section>
      <section data-slide class="h-[1080px] bg-base p-24"><h1 class="text-title">Deux</h1></section>`;
    const html = wrapScreen(body, dna, { mode: 'presentation' });
    const r = await exportPdf(html, { name: 'deck-notes', mode, outDir: dir, notes: true });
    assert.equal(r.frames, 2);
    assert.equal(r.notes, 2, 'une page de notes par diapo, même sans note');
    assert.equal(r.pages, 4);
    assert.ok(readFileSync(r.file).length > 10000);

    // Sans l'option, le PDF reste un deck de deux pages.
    const plain = await exportPdf(html, { name: 'deck-sec', mode, outDir: dir });
    assert.equal(plain.notes, 0);
    assert.equal(plain.pages, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('runtime « slides » : clic, touches et panneau de notes pilotent la présentation', { skip: !hasBrowser && 'aucun navigateur' }, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'naos-runtime-'));
  let browser;
  try {
    const mode = getMode('presentation')!;
    const body = `
      <section data-slide class="h-[1080px] bg-base p-24" data-part="Ouverture" data-notes="Je m'appuie sur le chiffre de gauche."><h1 class="text-title">Une</h1></section>
      <section data-slide class="h-[1080px] bg-base p-24" data-part="Preuve"><h1 class="text-title">Deux</h1></section>
      <section data-slide class="h-[1080px] bg-base p-24" data-part="Preuve"><h1 class="text-title">Trois</h1></section>`;
    const file = path.join(dir, 'deck.html');
    writeFileSync(file, wrapScreen(body, dna, { mode: 'presentation' }));

    browser = await puppeteer.launch({ executablePath: findBrowser(), headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 900 });
    // Le runtime s'efface en mode piloté : on le réveille pour l'éprouver.
    await page.evaluateOnNewDocument('Object.defineProperty(navigator, "webdriver", { get: () => false });');
    await page.goto(`file://${file.replace(/\\/g, '/')}`, { waitUntil: 'load' });
    await page.waitForSelector('#naos-toggle');

    const visible = () =>
      page.evaluate(`Array.from(document.querySelectorAll('[data-slide]')).map((s) => s.style.display !== 'none')`);
    const notesOpen = () => page.evaluate(`!document.getElementById('naos-notes').hidden`);
    const notesText = () => page.evaluate(`document.querySelector('#naos-notes p').textContent`);

    assert.deepEqual(await visible(), [true, false, false]);
    await page.keyboard.press('ArrowRight');
    assert.deepEqual(await visible(), [false, true, false]);
    assert.equal(await page.$eval('#naos-part', (el) => el.textContent), 'Partie 2 / 2 · Preuve');

    // Clic sur la moitié droite puis sur la moitié gauche.
    await page.mouse.click(1500, 450);
    assert.deepEqual(await visible(), [false, false, true]);
    await page.mouse.click(100, 450);
    assert.deepEqual(await visible(), [false, true, false]);

    // Balayage : la tête n'a pas de doigt, on synthétise les TouchEvent (le runtime
    // n'écoute que touchstart/touchend sur le document, comme un vrai geste).
    await page.evaluate(`(() => {
      const touch = (x) => new Touch({ identifier: 1, target: document.body, clientX: x, clientY: 450 });
      document.body.dispatchEvent(new TouchEvent('touchstart', { touches: [touch(1200)], changedTouches: [touch(1200)], bubbles: true }));
      document.body.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [touch(600)], bubbles: true }));
    })()`);
    assert.deepEqual(await visible(), [false, false, true], 'balayage vers la gauche : diapo suivante');

    // Notes : touche N, contenu de la diapo courante, puis fermeture.
    await page.keyboard.press('Home');
    await page.keyboard.press('KeyN');
    assert.equal(await notesOpen(), true);
    assert.match(String(await notesText()), /chiffre de gauche/);
    await page.keyboard.press('KeyN');
    assert.equal(await notesOpen(), false);

    // La barre de progression n'est pas demandée par ce mode : pas de barre.
    assert.equal(await page.$('#naos-progress'), null);
  } finally {
    await browser?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('export PDF : le nom est assaini et l’extension forcée', () => {
  assert.equal(safePdfName('../../etc/passwd'), 'passwd.pdf');
  assert.equal(safePdfName('deck-été.html'), 'deck-ete.pdf');
  assert.throws(() => safePdfName('...'), /invalide/);
});

test('export PDF : un mode sans cadre donne une page à la taille du viewport', { skip: !hasBrowser && 'aucun navigateur' }, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'naos-pdf-'));
  try {
    const r = await exportPdf(wrapScreen('<main class="p-6"><h1 class="font-display text-4xl">Factures</h1></main>', dna, { mode: 'website' }), {
      name: 'page',
      mode: getMode('website')!,
      outDir: dir,
    });
    assert.equal(r.frames, 0);
    assert.equal(r.pages, 1);
    assert.equal(r.width, 1440);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('preview : une page propre ne lève aucune erreur', { skip: !hasBrowser && 'aucun navigateur' }, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'naos-preview-'));
  try {
    const body = `<main class="mx-auto max-w-3xl p-6"><h1 class="font-display text-4xl">Factures</h1>
      <p class="mt-4 text-muted">Trois factures arrivent à échéance cette semaine.</p>
      <span class="rounded-full bg-success/10 px-2 py-0.5 text-xs text-success">Payée</span>
      <a href="#" class="mt-6 inline-flex rounded-ui bg-accent px-5 py-3 font-medium text-accent-ink">Relancer les clients</a></main>`;
    const r = await previewScreen(wrapScreen(body, dna), { name: 'propre', outDir: dir, screenshots: false });
    assert.deepEqual(r.issues.filter((i) => i.severity === 'error'), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

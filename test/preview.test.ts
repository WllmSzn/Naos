import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
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

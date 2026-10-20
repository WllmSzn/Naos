import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadLibrary } from '../src/dna/library.js';
import { wrapScreen } from '../src/screen/wrap.js';
import { previewScreen } from '../src/preview/preview.js';
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

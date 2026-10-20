import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { analyzeScan } from '../src/scan/analyze.js';
import type { RawElement, RawScan } from '../src/scan/collect.js';
import { scanSlug, validateScanUrl } from '../src/scan/scan.js';
import { saveDna } from '../src/dna/library.js';
import { DnaSchema } from '../src/dna/schema.js';
import { contrastRatio } from '../src/color.js';
import { DNA_DIR } from '../src/paths.js';

function el(partial: Partial<RawElement>): RawElement {
  return { tag: 'div', role: 'other', area: 1000, top: 0, textLen: 0, ...partial };
}

/** Page claire typique : beaucoup de texte gris secondaire, peu de texte principal. */
const RAW: RawScan = {
  url: 'https://exemple.test/',
  title: 'Exemple',
  viewport: { w: 1440, h: 900 },
  docHeight: 4000,
  pageBg: '#FFFFFF',
  rootVars: { '--brand-blue': '#2255EE', '--space-4': '16px' },
  fonts: ['Inter 400'],
  elements: [
    el({ tag: 'h1', role: 'heading', textLen: 40, color: '#0A0A0A', font: 'Inter Tight', size: 64, weight: 600, lineHeight: 67, letterSpacing: -1.9 }),
    el({ tag: 'h2', role: 'heading', textLen: 30, color: '#0A0A0A', font: 'Inter Tight', size: 44, weight: 600, lineHeight: 48 }),
    el({ tag: 'p', textLen: 2000, color: '#777777', font: 'Inter', size: 16, weight: 400, lineHeight: 24 }),
    el({ tag: 'p', textLen: 300, color: '#0A0A0A', font: 'Inter', size: 16, weight: 400, lineHeight: 24 }),
    el({ tag: 'a', role: 'link', textLen: 12, bg: '#2255EE', bgAlpha: 1, color: '#FFFFFF', radius: 999, padY: 12, padX: 20, font: 'Inter', size: 15 }),
    el({ tag: 'a', role: 'link', textLen: 10, bg: '#2255EE', bgAlpha: 1, color: '#FFFFFF', radius: 999, padY: 12, padX: 20, font: 'Inter', size: 15 }),
    el({ tag: 'section', area: 1440 * 600, bg: '#F4F3F1', bgAlpha: 1 }),
    el({ tag: 'div', area: 120000, bg: '#F4F3F1', bgAlpha: 1, radius: 24, border: '#E6E4E1', borderWidth: 1 }),
    el({ tag: 'div', area: 120000, radius: 24, border: '#E6E4E1', borderWidth: 1, shadow: 'rgba(0, 0, 0, 0) 0px 0px 0px 0px' }),
  ],
};

test('analyse : rôles de couleur déduits', () => {
  const a = analyzeScan(RAW);
  const t = a.draft.tokens;
  assert.equal(a.theme, 'light');
  assert.equal(t.base, '#FFFFFF');
  assert.equal(t.surface, '#F4F3F1');
  assert.equal(t.ink, '#0A0A0A', 'le texte principal est le plus contrasté, pas le plus abondant');
  assert.equal(t.accent, '#2255EE');
  assert.equal(t.line, '#E6E4E1');
  assert.ok(contrastRatio(t.muted, t.base) >= 4.5, 'muted corrigé pour la lisibilité');
  assert.ok(a.draft.adjusted.muted, 'la correction est signalée');
});

test('analyse : typographie, formes, ombres et variables', () => {
  const a = analyzeScan(RAW);
  assert.equal(a.draft.fonts.display, 'Inter Tight');
  assert.equal(a.draft.fonts.body, 'Inter');
  assert.equal(a.headings.h1?.size, 64);
  assert.equal(a.headings.h1?.letterSpacingEm, -0.03);
  assert.equal(a.draft.shape.radius, '9999px', 'bouton pilule');
  assert.equal(a.draft.shape.radiusLarge, '1.5rem');
  assert.equal(a.draft.elevation.card, 'none', 'ombres transparentes ignorées');
  assert.deepEqual(a.rootColorVars, { '--brand-blue': '#2255EE' });
});

test('analyse : le brouillon complété par du texte passe le schéma', () => {
  const { adjusted, ...draft } = analyzeScan(RAW).draft;
  void adjusted;
  const res = DnaSchema.safeParse({
    id: 'exemple-scan',
    name: 'Exemple',
    summary: 'Brouillon complété pour le test.',
    bestFor: ['a', 'b', 'c'],
    mood: ['x', 'y'],
    modes: { website: { signature: "Un grand titre et rien d'autre." } },
    rules: { do: ['a'], dont: ['b'] },
    ...draft,
  });
  assert.equal(res.success, true, JSON.stringify(res.error?.issues));
});

test('analyse : thème sombre et site monochrome', () => {
  const a = analyzeScan({
    ...RAW,
    pageBg: '#0B0B0C',
    elements: [
      el({ tag: 'p', textLen: 500, color: '#F2F2F2', font: 'Geist', size: 16 }),
      el({ tag: 'p', textLen: 400, color: '#9A9AA0', font: 'Geist', size: 16 }),
    ],
  });
  assert.equal(a.theme, 'dark');
  assert.equal(a.draft.tokens.ink, '#F2F2F2');
  assert.ok(a.notes.some((n) => /monochrome/.test(n)));
});

test('URL de scan : validation et nom de dossier', () => {
  assert.equal(validateScanUrl('exemple.com').href, 'https://exemple.com/');
  assert.throws(() => validateScanUrl('file:///C:/secret.txt'), /http/);
  assert.throws(() => validateScanUrl('javascript:alert(1)'));
  assert.equal(scanSlug(new URL('https://www.exemple.com/fr/produit/')), 'exemple.com-fr-produit');
});

test('saveDna : valide, enregistre, refuse d\u2019écraser sans overwrite', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'naos-dna-'));
  try {
    const dna = JSON.parse(readFileSync(path.join(DNA_DIR, 'daylight-product.json'), 'utf8'));
    const first = saveDna({ ...dna, id: 'copie-test' }, { dir });
    assert.equal(first.replaced, false);
    assert.throws(() => saveDna({ ...dna, id: 'copie-test' }, { dir }), /existe déjà/);
    assert.equal(saveDna({ ...dna, id: 'copie-test' }, { dir, overwrite: true }).replaced, true);
    assert.throws(() => saveDna({ ...dna, id: 'invalide', tokens: { ...dna.tokens, muted: '#EEEEEE' } }, { dir }), /contraste/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

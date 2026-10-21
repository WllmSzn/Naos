import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { loadLibrary, googleFontsUrl } from '../src/dna/library.js';
import { DnaSchema } from '../src/dna/schema.js';
import { suggestDna } from '../src/dna/suggest.js';
import { contrastRatio } from '../src/color.js';
const lib = loadLibrary();
const dnas = [...lib.dnas.values()];
const fileOf = (id: string) => lib.locations.get(id)!.file;

test('toutes les DNA de la bibliothèque de test sont valides et rangées par famille', () => {
  assert.deepEqual(lib.errors, []);
  assert.ok(lib.dnas.size >= 9, `${lib.dnas.size} DNA`);
  for (const dna of dnas) {
    const loc = lib.locations.get(dna.id)!;
    assert.ok(loc.family, `${dna.id} sans famille`);
    assert.equal(path.basename(loc.dir), dna.id, 'le dossier porte l’id');
    assert.equal(JSON.parse(readFileSync(loc.file, 'utf8')).id, dna.id);
  }
});

test('contrasteRatio : valeurs de référence WCAG', () => {
  assert.equal(contrastRatio('#000000', '#FFFFFF').toFixed(1), '21.0');
  assert.equal(contrastRatio('#777', '#777'), 1);
});

test('le schéma rejette un contraste insuffisant', () => {
  const base = JSON.parse(readFileSync(fileOf('linen-ledger'), 'utf8'));
  const bad = { ...base, tokens: { ...base.tokens, muted: '#CFCAC0' } };
  const res = DnaSchema.safeParse(bad);
  assert.equal(res.success, false);
  assert.match(JSON.stringify(res.error?.issues), /contraste muted\/base/);
});

test('le schéma rejette un hex invalide et un id mal formé', () => {
  const base = JSON.parse(readFileSync(fileOf('linen-ledger'), 'utf8'));
  assert.equal(DnaSchema.safeParse({ ...base, id: 'Linen Ledger' }).success, false);
  assert.equal(DnaSchema.safeParse({ ...base, tokens: { ...base.tokens, ink: 'black' } }).success, false);
});

test('googleFontsUrl fusionne les familles identiques', () => {
  const graphite = lib.dnas.get('graphite-console')!;
  const url = googleFontsUrl(graphite);
  assert.equal(url.match(/family=Manrope/g)?.length, 1);
  assert.match(url, /family=Manrope:wght@400;500;600;700/);
  assert.match(url, /family=JetBrains\+Mono:wght@400;500/);
});

const cases: Array<[string, Parameters<typeof suggestDna>[1]]> = [
  ['linen-ledger', { product: 'tableau de bord de facturation pour cabinet comptable' }],
  ['betterstack-dark', { product: 'console de monitoring pour équipe devops' }],
  ['signal-clinic', { product: 'portail patient de téléconsultation', mood: 'rassurant' }],
  ['poster-block', { product: 'landing page pour un festival de musique', mood: 'audacieux' }],
  ['gallery-noir', { product: 'portfolio de photographe', theme: 'dark' }],
  ['field-notes', { product: 'boutique en ligne de produits locaux' }],
  ['signal-clinic', { product: 'application de réservation pour kinés', mood: 'rassurant' }],
  ['linen-ledger', { product: 'gestion de la paie', mood: 'sobre et fiable' }],
  ['gallery-noir', { product: 'site pour un hôtel haut de gamme' }],
];

for (const [expected, query] of cases) {
  test(`suggestDna : « ${query.product} » → ${expected}`, () => {
    const [top] = suggestDna(dnas, query);
    assert.equal(top?.id, expected, JSON.stringify(suggestDna(dnas, query), null, 1));
  });
}

test('suggestDna : le thème imposé pénalise les DNA de l’autre thème', () => {
  const ranked = suggestDna(dnas, { product: 'site vitrine', theme: 'dark' }, 6);
  assert.equal(ranked[0]?.theme, 'dark');
});

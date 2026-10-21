import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadLibrary } from '../src/dna/library.js';
import { applyOverrides } from '../src/dna/overrides.js';
import { extractBody, readMeta, tailwindConfig, wrapScreen } from '../src/screen/wrap.js';
import { retheme } from '../src/screen/retheme.js';
import { safeScreenName, saveScreen } from '../src/screen/output.js';
import { DnaSchema } from '../src/dna/schema.js';

const lib = loadLibrary().dnas;
const linen = lib.get('linen-ledger')!;
const graphite = lib.get('graphite-console')!;
const resolve = (id: string) => lib.get(id);

const BODY = '<main class="p-6"><h1 class="text-ink">Solde</h1><span style="--c:#1F5A46">x</span></main>';

test('wrapScreen produit un document complet et relisible', () => {
  const html = wrapScreen(BODY, linen, { title: 'Trésorerie & co', libs: ['chartjs', 'alpine'] });
  assert.match(html, /^<!DOCTYPE html>\n<html lang="fr">/);
  assert.match(html, /<title>Trésorerie &amp; co<\/title>/);
  assert.match(html, /cdn\.tailwindcss\.com\/3\.4\.17/);
  assert.match(html, /chart\.js@4\.4\.9/);
  assert.match(html, /alpinejs@3\.14\.9/);
  assert.match(html, /family=Instrument\+Serif/);
  assert.equal(extractBody(html), BODY);

  const meta = readMeta(html);
  assert.equal(meta.dnaId, 'linen-ledger');
  assert.deepEqual(meta.libs, ['chartjs', 'alpine']);
  assert.equal(meta.title, 'Trésorerie & co');
});

test('la config Tailwind ne déclare pas de couleur « base » globale (conflit avec text-base)', () => {
  const cfg = tailwindConfig(linen).theme.extend;
  assert.equal('base' in cfg.colors, false);
  assert.equal(cfg.backgroundColor.base, linen.tokens.base);
  assert.equal(cfg.colors.inverse, linen.tokens.base);
  assert.equal(cfg.colors['accent-ink'], linen.tokens.accentInk);
});

test('retheme : nouveau head, corps conservé, couleurs littérales converties', () => {
  const original = wrapScreen(BODY, linen, { title: 'Solde', libs: ['chartjs'] });
  const r = retheme(original, graphite, resolve);
  assert.equal(r.from, 'linen-ledger');
  assert.equal(r.to, 'graphite-console');
  assert.equal(r.hexReplaced, 1);
  assert.match(r.html, /<meta name="naos-dna" content="graphite-console">/);
  assert.match(r.html, /family=Manrope/);
  assert.match(r.html, /chart\.js@4\.4\.9/, 'les libs sont conservées');
  assert.match(r.html, /<title>Solde<\/title>/);
  assert.match(extractBody(r.html), /--c:#F2A93B/);
});

test('runtime « slides » : injecté par le mode, conservé au retheme, absent ailleurs', () => {
  const daylight = lib.get('daylight-product')!;
  const cobalt = lib.get('cobalt-night')!;
  const deck = '<section data-slide class="h-[1080px]"><h1>Une</h1></section>';
  const withRuntime = wrapScreen(deck, daylight, { mode: 'presentation', title: 'Deck' });
  assert.match(withRuntime, /naos:slides/);
  assert.match(withRuntime, /\[data-slide\]/);
  assert.doesNotMatch(wrapScreen(deck, cobalt, { mode: 'website' }), /naos:slides/, 'pas de runtime sans réglage de mode');
  assert.doesNotMatch(wrapScreen(deck, cobalt), /naos:slides/, 'pas de mode, pas de runtime');

  // Le retheme réenveloppe le corps : le script doit être reconstruit, pas perdu.
  const rethemed = retheme(withRuntime, cobalt, resolve).html;
  assert.equal(rethemed.match(/naos:slides/g)?.length, 1, 'un seul runtime après retheme');
  assert.match(rethemed, /<meta name="naos-mode" content="presentation">/);
  assert.equal(extractBody(rethemed), extractBody(withRuntime));
});

test('retheme aller-retour : on retrouve le document d\u2019origine', () => {
  const original = wrapScreen(BODY, linen, { title: 'Solde' });
  const back = retheme(retheme(original, graphite, resolve).html, linen, resolve).html;
  assert.equal(back, original);
});

test('surcharges : appliquées, mémorisées et prises en compte au retheme suivant', () => {
  const overrides = { tokens: { accent: '#0B4F8A' } };
  const custom = retheme(wrapScreen('<p style="--a:#1F5A46">x</p>', linen), linen, resolve, { overrides });
  assert.match(custom.html, /"accent":"#0B4F8A"/);
  assert.deepEqual(readMeta(custom.html).overrides, overrides);
  assert.match(extractBody(custom.html), /--a:#0B4F8A/);

  // L'accent surchargé doit être reconnu comme l'accent d'origine au retheme suivant.
  const next = retheme(custom.html, graphite, resolve);
  assert.match(extractBody(next.html), /--a:#F2A93B/);
  assert.equal(readMeta(next.html).overrides, undefined);
});

test('surcharges qui cassent le contraste : refusées', () => {
  assert.throws(() => applyOverrides(linen, { tokens: { accent: '#F2F2F2' } }), /contraste accentInk\/accent/);
});

test('noms de fichiers de sortie assainis', () => {
  assert.equal(safeScreenName('../../etc/Écran Factures!.html'), 'Ecran-Factures.html');
  assert.equal(safeScreenName('C:\\temp\\demo'), 'demo.html');
  assert.throws(() => safeScreenName('...'));
});

test('saveScreen écrit dans le dossier demandé', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'naos-'));
  try {
    const file = saveScreen('demo', '<p>x</p>', dir);
    assert.equal(file, path.join(dir, 'demo.html'));
    assert.equal(readFileSync(file, 'utf8'), '<p>x</p>');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('DNA de produit : couleurs métier, racine 15 px et police système', () => {
  const artefact = lib.get('artefact-dark')!;
  const html = wrapScreen('<p class="text-sev-critical">x</p>', artefact);
  assert.match(html, /html\{font-size:15px\}/);
  assert.match(html, /"sev-critical":"#/, 'couleur métier dans la config Tailwind');
  assert.doesNotMatch(html, /family=ui-monospace/, 'police système jamais demandée à Google Fonts');
  assert.match(html, /family=Jost/);
  assert.match(html, /family=Kufam/);
});

test('couleurs métier : noms réservés refusés', () => {
  const base = { ...lib.get('artefact-dark')! };
  assert.equal(DnaSchema.safeParse({ ...base, extraColors: { red: '#FF0000' } }).success, false);
  assert.equal(DnaSchema.safeParse({ ...base, extraColors: { muted: '#888888' } }).success, false);
  assert.equal(DnaSchema.safeParse({ ...base, extraColors: { 'sev-x': '#FF577B' } }).success, true);
});

test('pages produites avant le renommage (Hecate) : toujours relues et rethémées', () => {
  const legacy = wrapScreen('<h1>Ancienne</h1><script>new Chart(c, { data: { datasets: [{ backgroundColor: HECATE.dataPalette[0] }] } })</script>', linen, { title: 'Ancienne' })
    .replace(/naos:body:/g, 'hecate:body:')
    .replace(/name="naos-/g, 'name="hecate-');
  assert.equal(readMeta(legacy).dnaId, 'linen-ledger');
  assert.match(extractBody(legacy), /^<h1>Ancienne<\/h1>/);
  const r = retheme(legacy, graphite, resolve);
  assert.equal(r.from, 'linen-ledger');
  assert.match(r.html, /<meta name="naos-dna" content="graphite-console">/);
  assert.match(r.html, /window\.HECATE = window\.NAOS/, 'les anciens scripts de graphique fonctionnent');
});

import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { blockMeta, findBlocks, loadBlocks } from '../src/blocks/library.js';
import { hostSection } from '../src/blocks/host.js';
import { getModes } from '../src/modes/modes.js';
import { lintScreen } from '../src/screen/lint.js';
import { getWorkflow } from '../src/workflows.js';

const { blocks, errors } = loadBlocks();
const all = [...blocks.values()];
const modes = getModes().modes;

const META = (meta: Record<string, unknown>) => `<!-- ${JSON.stringify(meta)} -->\n<div class="text-ink">x</div>\n`;
const baseMeta = { id: 'essai', name: 'Essai', kind: 'figure', description: 'Bloc de test pour les erreurs.', minWidth: 200 };

/** Un dossier de modes temporaire, avec les fichiers de blocs donnés. */
function tempMode(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'naos-blocks-'));
  mkdirSync(path.join(dir, 'presentation', 'blocks'), { recursive: true });
  for (const [name, content] of Object.entries(files)) writeFileSync(path.join(dir, 'presentation', 'blocks', name), content);
  return dir;
}

test('tous les blocs se chargent et appartiennent à un mode', () => {
  assert.deepEqual(errors, []);
  assert.ok(blocks.size >= 2, `${blocks.size} blocs`);
  for (const b of all) {
    assert.ok(modes.has(b.mode), `${b.id} : mode ${b.mode}`);
    assert.doesNotMatch(b.html, /<!--\s*\{/, `${b.id} : le commentaire de métadonnées est retiré du HTML`);
  }
});

test('chaque bloc porte un type déclaré par son mode', () => {
  for (const b of all) assert.ok(modes.get(b.mode)!.blockKinds.includes(b.kind), `${b.id} : ${b.kind}`);
});

test('les schémas de présentation sont livrés avec leurs variantes et leurs connecteurs', () => {
  const diagrams = ['branch', 'merge', 'labeled-flow', 'hub-cycle', 'step-chain'];
  for (const id of diagrams) {
    const b = blocks.get(id);
    assert.ok(b, `${id} manquant`);
    assert.equal(b.kind, 'diagram', `${id} : type diagram`);
    assert.ok(b.slots.length >= 2, `${id} : emplacements déclarés`);
    assert.ok(b.minWidth >= 320 && b.minWidth <= 560, `${id} : largeur minimale`);
    assert.doesNotMatch(b.html, /absolute/, `${id} : aucun placement en position absolue`);
  }
  assert.deepEqual(blocks.get('branch')!.variants.map((v) => v.name), ['merge']);
  assert.deepEqual(blocks.get('hub-cycle')!.variants.map((v) => v.name), ['absent']);
  assert.deepEqual(blocks.get('labeled-flow')!.variants.map((v) => v.name), ['dashed']);
  // Les connecteurs se dessinent dans une colonne ou une rangée : rien ne s'étire avec le texte.
  for (const id of ['branch', 'merge', 'labeled-flow', 'hub-cycle']) {
    const html = blocks.get(id)!.html;
    assert.match(html, /preserveAspectRatio="none"/, `${id} : le connecteur remplit sa cellule`);
    assert.match(html, /vector-effect="non-scaling-stroke"/, `${id} : le trait garde son épaisseur`);
    assert.match(html, /stroke="currentColor"[\s\S]*text-connector|text-connector[\s\S]*stroke="currentColor"/, `${id} : le trait suit la DNA`);
    assert.match(html, /aria-hidden="true"/, `${id} : SVG décoratif masqué aux lecteurs`);
  }
});

test('un bloc de la bibliothèque hérite de sa famille, un bloc de mode reste commun', () => {
  const family = blocks.get('fixture-figure');
  assert.ok(family, 'bloc de famille chargé');
  assert.deepEqual(family.dna, ['artefact-dark', 'artefact-light']);
  assert.equal(family.mode, 'presentation');
  assert.equal(blocks.get('key-figure')?.dna, undefined);
});

for (const theme of ['light', 'dark'] as const) {
  test(`chaque bloc passe le lint de son mode sans erreur ni correction (thème ${theme})`, () => {
    for (const b of all) {
      const r = lintScreen(b.html, { theme, profile: { ...modes.get(b.mode)!.lint, fragment: true } });
      const errs = r.violations.filter((v) => v.severity === 'error');
      assert.deepEqual(errs, [], `${b.id} : ${JSON.stringify(errs)}`);
      assert.deepEqual(r.fixes.filter((f) => f.rule !== 'a11y.image-slot'), [], `${b.id} devrait déjà être en tokens`);
    }
  });
}

test('profil block : le fragment n’exige pas de h1 mais refuse titre, cadre et texte trop petit', () => {
  const profile = { ...modes.get('presentation')!.lint, fragment: true };
  const clean = lintScreen('<p class="text-body text-ink">42 %</p>', { profile });
  assert.ok(!clean.violations.some((v) => v.rule === 'a11y.h1'), 'pas d’exigence de h1');

  const rules = (html: string) => lintScreen(html, { profile }).violations.map((v) => v.rule);
  assert.ok(rules('<h2 class="text-title text-ink">Titre</h2>').includes('a11y.block-heading'));
  assert.ok(rules('<section data-slide><p class="text-body text-ink">x</p></section>').includes('structure.block-frame'));
  assert.ok(rules('<p class="text-xs text-ink">x</p>').includes('type.under-caption'));
  assert.ok(rules('<svg width="8" height="8"></svg>').includes('a11y.svg-role'));
  assert.ok(!rules('<svg aria-hidden="true" width="8" height="8"></svg>').includes('a11y.svg-role'));
  assert.ok(!rules('<svg role="img" aria-label="Flux" width="8" height="8"></svg>').includes('a11y.svg-role'));
});

test('findBlocks : cloisonné par mode', () => {
  const pres = findBlocks(all, { mode: 'presentation', limit: 100 });
  assert.ok(pres.length && pres.every((b) => b.mode === 'presentation'));
  assert.deepEqual(findBlocks(all, { mode: 'website', limit: 100 }), []);
});

test('findBlocks : par ids, types et mots-clés', () => {
  assert.deepEqual(findBlocks(all, { mode: 'presentation', ids: ['key-figure'] }).map((b) => b.id), ['key-figure']);
  assert.ok(findBlocks(all, { mode: 'presentation', kinds: ['figure'], limit: 50 }).every((b) => b.kind === 'figure'));
  assert.equal(findBlocks(all, { mode: 'presentation', query: 'chiffre clé' })[0]?.id, 'key-figure');
});

test('findBlocks : un bloc de famille n’apparaît que pour ses DNA, et en tête', () => {
  const withDna = findBlocks(all, { mode: 'presentation', dna: 'artefact-light', kinds: ['figure'], limit: 50 });
  assert.equal(withDna[0]?.id, 'fixture-figure', 'bloc propre en tête');
  const other = findBlocks(all, { mode: 'presentation', dna: 'field-notes', kinds: ['figure'], limit: 50 });
  assert.ok(!other.some((b) => b.id === 'fixture-figure'), 'bloc masqué pour une autre DNA');
});

test('blockMeta ne transporte pas le HTML', () => {
  const meta = blockMeta(all[0]!);
  assert.ok(!('html' in meta));
  assert.ok(meta.id && meta.name && meta.kind);
});

test('le workflow propose les blocs seulement aux modes qui en déclarent', () => {
  const deck = getWorkflow('ui_screen')!.render({ brief: 'Soutenance de projet', mode: 'presentation' });
  assert.match(deck, /get_blocks/);
  assert.match(deck, /diagram, figure, grid, media, meta/);
  const site = getWorkflow('ui_screen')!.render({ brief: 'Landing pour une boulangerie', mode: 'website' });
  assert.doesNotMatch(site, /get_blocks/);
});

test('hostSection : le cadre vient du mode, le titre de la section hôte', () => {
  const block = blocks.get('key-figure')!;
  const deck = hostSection(block, modes.get('presentation')!, 'text-title');
  assert.match(deck, /<section data-slide class="[^"]*h-\[1080px\] overflow-hidden"/);
  assert.match(deck, /<h2 class="font-display text-ink text-title">Chiffre clé<\/h2>/);
  const app = hostSection(block, modes.get('product-desktop')!);
  assert.doesNotMatch(app, /data-slide/);
  assert.match(app, /h-\[800px\] overflow-hidden/, 'la hauteur du premier viewport du mode');
});

test('un bloc mal formé est signalé, pas silencieusement ignoré', () => {
  const dir = tempMode({
    'sans-meta.html': '<div class="text-ink">x</div>\n',
    'mauvais-type.html': META({ ...baseMeta, id: 'mauvais-type', kind: 'inconnu' }),
    'mauvais-nom.html': META({ ...baseMeta, id: 'autre-id' }),
    'essai.html': META(baseMeta),
  });
  // Un id déjà pris par un bloc de bibliothèque : le conflit est signalé, pas écrasé.
  const lib = mkdtempSync(path.join(tmpdir(), 'naos-blocks-lib-'));
  mkdirSync(path.join(lib, 'fam', 'essai-dna'), { recursive: true });
  writeFileSync(path.join(lib, 'fam', 'essai-dna', 'dna.json'), '{}');
  mkdirSync(path.join(lib, 'fam', 'blocks', 'presentation'), { recursive: true });
  writeFileSync(path.join(lib, 'fam', 'blocks', 'presentation', 'essai.html'), META(baseMeta));

  const r = loadBlocks(dir, [lib]);
  const issues = r.errors.map((e) => `${e.file} : ${e.issue}`).join('\n');
  assert.match(issues, /sans-meta\.html : commentaire de métadonnées JSON manquant/);
  assert.match(issues, /mauvais-type\.html : type « inconnu » inconnu du mode presentation/);
  assert.match(issues, /mauvais-nom\.html : l'id « autre-id » ne correspond pas au nom de fichier/);
  assert.match(issues, /essai\.html : id en double/);
  assert.equal(r.blocks.size, 1);
});

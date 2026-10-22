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

test('le lot données et contenu est livré, rangé par type', () => {
  const expected: Record<string, string[]> = {
    figure: ['bar-series', 'before-after', 'gauge', 'key-figure', 'split-bar'],
    grid: ['callout', 'comparison-table', 'logo-row', 'module-grid', 'numbered-points', 'person-card', 'tag-cloud'],
    meta: ['contact', 'slide-footer'],
  };
  for (const [kind, ids] of Object.entries(expected)) {
    const got = all.filter((b) => b.mode === 'presentation' && b.kind === kind && !b.dna).map((b) => b.id).sort();
    for (const id of ids) assert.ok(got.includes(id), `${id} manquant en ${kind}`);
    assert.deepEqual(got, ids, `${kind} : liste inattendue`);
  }
  for (const id of Object.values(expected).flat()) {
    const b = blocks.get(id)!;
    assert.ok(b.description.length >= 40, `${id} : description pour le modèle`);
    assert.ok(b.minWidth >= 320, `${id} : largeur minimale déclarée`);
    assert.ok(b.fits.length, `${id} : sections hôtes déclarées`);
  }
});

test('le lot 2 est livré : matrices, arbres, frises et médias', () => {
  const expected: Record<string, string[]> = {
    diagram: ['decision-tree', 'matrix-2x2', 'platform-stack', 'timeline'],
    media: ['annotated-shot', 'ui-mock-card'],
  };
  for (const [kind, ids] of Object.entries(expected)) {
    const got = all.filter((b) => b.mode === 'presentation' && b.kind === kind && !b.dna).map((b) => b.id).sort();
    for (const id of ids) assert.ok(got.includes(id), `${id} manquant en ${kind}`);
    for (const id of ids) {
      const b = blocks.get(id)!;
      assert.ok(b.slots.length >= 2, `${id} : emplacements déclarés`);
      assert.ok(b.minWidth >= 320, `${id} : largeur minimale déclarée`);
      assert.ok(b.fits.length, `${id} : sections hôtes déclarées`);
    }
  }

  // La matrice place ses points en pourcentage : leur position est le propos.
  const matrix = blocks.get('matrix-2x2')!.html;
  assert.equal((matrix.match(/style="left:\d+%;top:\d+%"/g) ?? []).length, 4);
  assert.match(matrix, /border-2 border-emphasis/, 'un seul point mis en avant');
  assert.match(matrix, /Gains rapides[\s\S]*Chantiers de fond[\s\S]*Petits pas[\s\S]*À écarter/, 'quatre quadrants titrés');

  // L'arbre garde le chemin retenu en trait plein, les autres en pointillés.
  const tree = blocks.get('decision-tree')!.html;
  assert.match(tree, /stroke-dasharray="6 6"/);
  assert.equal((tree.match(/stroke-dasharray/g) ?? []).length, 2, 'deux branches écartées');
  assert.match(tree, /OUI[\s\S]*NON/, 'le sens se lit dans les cartes, pas dans la couleur');

  // La frise dit l'état en toutes lettres, avec ou sans calendrier.
  const timeline = blocks.get('timeline')!.html;
  for (const state of ['Fait', 'En cours', 'À venir']) assert.ok(timeline.includes(`>${state}<`), `état ${state}`);
  assert.doesNotMatch(timeline, /\b(19|20)\d\d\b/, 'aucune date promise');

  // Le tableau porte un mot par cellule : une icône seule ne dirait rien à un lecteur d'écran.
  const table = blocks.get('comparison-table')!.html;
  assert.match(table, /<table/);
  assert.match(table, /<th scope="col"/);
  assert.match(table, /<th scope="row"/);
  assert.equal((table.match(/<iconify-icon[^>]*aria-hidden="true"/g) ?? []).length, (table.match(/<iconify-icon/g) ?? []).length);
  assert.match(table, /Inclus<\/span>|Inclus\n/, 'le mot accompagne la coche');

  // Les repères d'une capture renvoient à une légende, ils ne flottent pas seuls.
  const shot = blocks.get('annotated-shot')!.html;
  assert.match(shot, /data-image="Capture/);
  assert.match(shot, /role="img" aria-label="Capture/);
  assert.equal((shot.match(/<span aria-hidden="true"[^>]*style="left:/g) ?? []).length, 3);

  // La carte d'interface se tient à l'échelle d'une diapo et garde ses deux actions.
  const mock = blocks.get('ui-mock-card')!.html;
  assert.match(mock, /max-w-\[560px\]/);
  assert.match(mock, /bg-accent[^"]*text-accent-ink/);
  assert.match(mock, /rounded-ui border border-line/);
});

test('les blocs de données portent leurs variantes et leurs sources', () => {
  assert.deepEqual(blocks.get('key-figure')!.variants.map((v) => v.name), ['tendance', 'inversé']);
  assert.deepEqual(blocks.get('before-after')!.variants.map((v) => v.name), ['large']);
  assert.deepEqual(blocks.get('numbered-points')!.variants.map((v) => v.name), ['pair']);
  assert.deepEqual(blocks.get('module-grid')!.variants.map((v) => v.name), ['duo']);
  assert.deepEqual(blocks.get('slide-footer')!.variants.map((v) => v.name), ['inverse', 'alt']);
  // La valeur de repli existe vraiment : la variante change la taille, pas seulement l'étiquette.
  assert.match(blocks.get('before-after')!.html, /group-data-\[variant=large\]:!text-title/);
  assert.match(blocks.get('key-figure')!.html, /group-data-\[variant=trend\]:flex/);
  // Un chiffre clé sans source n'est pas une preuve.
  assert.match(blocks.get('key-figure')!.html, /text-caption text-muted/);
});

test('aucun faux logo, aucun visage aléatoire dans les blocs de contenu', () => {
  const logos = blocks.get('logo-row')!.html;
  assert.doesNotMatch(logos, /<img/, 'un logo passe par un emplacement décrit');
  assert.match(logos, /data-image="Logo /);
  assert.match(blocks.get('person-card')!.html, /rounded-full/, 'les initiales remplacent le visage');
  assert.doesNotMatch(blocks.get('person-card')!.html, /<img/);
});

test('le pied de diapo est un bloc meta, identifié pour le lint et l’audit', () => {
  const footer = blocks.get('slide-footer')!;
  assert.equal(footer.kind, 'meta');
  assert.match(footer.html, /^<footer data-slide-footer class="/);
  assert.match(footer.html, /text-caption tabular-nums">\d{2} \/ \d{2}</, 'le numéro est écrit n / total');
  assert.ok(footer.fits.includes('title') && footer.fits.includes('closing'), 'les sections hôtes sont déclarées');
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

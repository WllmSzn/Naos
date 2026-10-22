import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findPatterns, loadPatterns } from '../src/patterns/library.js';
import { getModes } from '../src/modes/modes.js';
import { lintScreen } from '../src/screen/lint.js';
import { getWorkflow, WORKFLOWS } from '../src/workflows.js';

const { patterns, errors } = loadPatterns();
const all = [...patterns.values()];
const modes = getModes().modes;

test('toutes les sections se chargent et appartiennent à un mode', () => {
  assert.deepEqual(errors, []);
  assert.ok(patterns.size >= 40, `${patterns.size} sections`);
  for (const p of all) assert.ok(modes.has(p.mode), `${p.id} : mode ${p.mode}`);
});

test('chaque section porte un type déclaré par son mode', () => {
  for (const p of all) assert.ok(modes.get(p.mode)!.patternKinds.includes(p.kind), `${p.id} : ${p.kind}`);
});

for (const theme of ['light', 'dark'] as const) {
  test(`chaque section passe le lint de son mode sans erreur ni correction (thème ${theme})`, () => {
    for (const p of all) {
      const r = lintScreen(p.html, { theme, profile: modes.get(p.mode)!.lint });
      const errs = r.violations.filter((v) => v.severity === 'error');
      assert.deepEqual(errs, [], `${p.id} : ${JSON.stringify(errs)}`);
      const fixes = r.fixes.filter((f) => f.rule !== 'a11y.image-slot');
      assert.deepEqual(fixes, [], `${p.id} devrait déjà être en tokens : ${JSON.stringify(fixes)}`);
    }
  });
}

test('aucune section n’utilise d’image aléatoire', () => {
  for (const p of all) assert.doesNotMatch(p.html, /src="[^"]*(?:picsum|placehold|unsplash)/i, p.id);
});

test('findPatterns : cloisonné par mode', () => {
  const web = findPatterns(all, { mode: 'website', limit: 100 });
  const app = findPatterns(all, { mode: 'product-desktop', limit: 100 });
  assert.ok(web.length && web.every((p) => p.mode === 'website'));
  assert.ok(app.length && app.every((p) => p.mode === 'product-desktop'));
  assert.deepEqual(findPatterns(all, { mode: 'product-desktop', ids: ['hero-split'] }), [], 'une section web n’est pas proposée en produit');
});

test('findPatterns : par ids, types et mots-clés', () => {
  assert.deepEqual(findPatterns(all, { mode: 'website', ids: ['faq-split', 'hero-giant'] }).map((p) => p.id), ['faq-split', 'hero-giant']);
  assert.ok(findPatterns(all, { mode: 'website', kinds: ['hero'] }).every((p) => p.kind === 'hero'));
  assert.equal(findPatterns(all, { mode: 'website', query: 'onglets interactifs' })[0]?.id, 'feature-tabs');
  assert.equal(findPatterns(all, { mode: 'website', query: 'tarifs formules' })[0]?.id, 'pricing-tiers');
});

test('findPatterns : chaque type demandé est couvert avant les variantes', () => {
  const kinds = ['nav', 'hero', 'stats', 'feature', 'testimonial', 'pricing', 'faq', 'cta', 'footer'];
  const picked = findPatterns(all, { mode: 'website', kinds, limit: 9 });
  assert.deepEqual(picked.map((p) => p.kind), kinds);
});

test('findPatterns : sections propres à une DNA réservées à cette DNA, et en tête', () => {
  const own = all.filter((p) => p.dna?.length);
  for (const p of own) {
    const dna = p.dna![0]!;
    const withDna = findPatterns(all, { mode: p.mode, dna, kinds: [p.kind], limit: 50 });
    assert.equal(withDna[0]?.id, p.id, `${p.id} en tête pour ${dna}`);
    const other = findPatterns(all, { mode: p.mode, dna: 'une-autre-dna', kinds: [p.kind], limit: 50 });
    assert.ok(!other.some((x) => x.id === p.id), `${p.id} masquée pour une autre DNA`);
  }
});

test('findPatterns : les types de présentation sont couverts, y compris les nouveaux', () => {
  const kinds = ['agenda', 'divider', 'quote', 'comparison', 'transition', 'appendix'];
  const picked = findPatterns(all, { mode: 'presentation', kinds, limit: kinds.length });
  assert.deepEqual(picked.map((p) => p.kind), kinds);
  const comparisons = findPatterns(all, { mode: 'presentation', kinds: ['comparison'], limit: 4 }).map((p) => p.id);
  assert.deepEqual(comparisons.sort(), ['comparison-before-after', 'comparison-options']);
});

test('chaque diapo porte le même pied, seul le texte et le variant changent', () => {
  const slides = all.filter((p) => p.mode === 'presentation');
  const shapes = new Set<string>();
  for (const p of slides) {
    const footers = p.html.match(/<footer data-slide-footer[\s\S]*?<\/footer>/g) ?? [];
    assert.equal(footers.length, 1, `${p.id} : exactement un pied de diapo`);
    // Forme du pied : même balise, mêmes classes, mêmes enfants — la variante exceptée.
    const shape = footers[0]!
      .replace(/\s*data-variant="[^"]*"/, '')
      .replace(/>[^<]+</g, '><');
    shapes.add(shape);
    assert.match(footers[0]!, /text-caption tabular-nums">\d{2} \/ \d{2}</, `${p.id} : numéro « n / total »`);
  }
  assert.equal(shapes.size, 1, `le pied doit être identique partout :\n${[...shapes].join('\n---\n')}`);
});

test('les pieds sur fond inversé ou alterné passent par la variante du bloc', () => {
  const byId = new Map(all.filter((p) => p.mode === 'presentation').map((p) => [p.id, p.html]));
  assert.match(byId.get('closing')!, /<section[^>]*bg-ink[\s\S]*data-variant="inverse"/, 'clôture : pied inversé');
  assert.match(byId.get('divider')!, /<section[^>]*bg-alt[\s\S]*data-variant="alt"/, 'intercalaire : pied alterné');
});

test('workflows : le mode pilote les instructions', () => {
  assert.deepEqual(WORKFLOWS.map((w) => w.name), ['ui_screen', 'ui_component', 'ui_review', 'dna_from_sites']);
  const site = getWorkflow('ui_screen')!.render({ brief: 'Landing pour une boulangerie', mode: 'website', dna: 'field-notes' });
  assert.match(site, /Landing pour une boulangerie/);
  assert.match(site, /get_dna avec id "field-notes" et mode "website"/);
  assert.match(site, /moment fort/);
  const app = getWorkflow('ui_screen')!.render({ brief: 'Détail d’une alerte', mode: 'product-desktop' });
  assert.match(app, /h-ctl/);
  assert.match(app, /1280, 1440, 1920/);
  assert.doesNotMatch(app, /sur-titre, titre, phrase d'appui/);
  const noMode = getWorkflow('ui_screen')!.render({ brief: 'x' });
  assert.match(noMode, /Choisis d'abord le mode/);
  assert.doesNotMatch(noMode, /## 2\. Choisir la DNA/);
});

test('workflow ui_component : planche avec tous les états', () => {
  const text = getWorkflow('ui_component')!.render({ component: 'ligne d’alerte', dna: 'artefact-dark' });
  assert.match(text, /mode "product-desktop"/);
  for (const s of ['repos', 'survol', 'focus visible', 'désactivé', 'chargement', 'erreur', 'vide']) assert.match(text, new RegExp(s));
});

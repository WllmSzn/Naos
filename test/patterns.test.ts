import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findPatterns, loadPatterns, PATTERN_KINDS } from '../src/patterns/library.js';
import { lintScreen } from '../src/screen/lint.js';
import { getWorkflow, WORKFLOWS } from '../src/workflows.js';

const { patterns, errors } = loadPatterns();
const all = [...patterns.values()];

test('toutes les sections se chargent', () => {
  assert.deepEqual(errors, []);
  assert.ok(patterns.size >= 20, `${patterns.size} sections`);
});

test('chaque type de section a au moins une référence', () => {
  for (const kind of PATTERN_KINDS) assert.ok(all.some((p) => p.kind === kind), `type sans section : ${kind}`);
});

for (const theme of ['light', 'dark'] as const) {
  test(`chaque section passe le lint sans erreur ni correction (thème ${theme})`, () => {
    for (const p of all) {
      const r = lintScreen(p.html, { theme });
      const errs = r.violations.filter((v) => v.severity === 'error');
      assert.deepEqual(errs, [], `${p.id} : ${JSON.stringify(errs)}`);
      // Seules corrections tolérées : l'ajout d'attributs d'accessibilité aux emplacements d'image.
      const fixes = r.fixes.filter((f) => f.rule !== 'a11y.image-slot');
      assert.deepEqual(fixes, [], `${p.id} devrait déjà être en tokens : ${JSON.stringify(fixes)}`);
    }
  });
}

test('aucune section n’utilise d’image aléatoire', () => {
  for (const p of all) assert.doesNotMatch(p.html, /src="[^"]*(?:picsum|placehold|unsplash)/i, p.id);
});

test('findPatterns : par ids, types, plateforme et mots-clés', () => {
  assert.deepEqual(findPatterns(all, { ids: ['faq-split', 'hero-giant'] }).map((p) => p.id), ['faq-split', 'hero-giant']);
  assert.ok(findPatterns(all, { kinds: ['hero'] }).every((p) => p.kind === 'hero'));
  assert.ok(findPatterns(all, { platform: 'app', limit: 50 }).every((p) => p.platform === 'app'));
  assert.equal(findPatterns(all, { query: 'onglets interactifs' })[0]?.id, 'feature-tabs');
  assert.equal(findPatterns(all, { query: 'tarifs formules' })[0]?.id, 'pricing-tiers');
});

test('findPatterns : chaque type demandé est couvert avant les variantes', () => {
  const kinds = ['nav', 'hero', 'stats', 'feature', 'testimonial', 'pricing', 'faq', 'cta', 'footer'];
  const picked = findPatterns(all, { kinds, platform: 'web', limit: 9 });
  assert.deepEqual(picked.map((p) => p.kind), kinds);
});

test('workflows : arguments rendus dans les instructions', () => {
  assert.deepEqual(WORKFLOWS.map((w) => w.name), ['ui_screen', 'ui_review', 'dna_from_sites']);
  const text = getWorkflow('ui_screen')!.render({ brief: 'Landing pour une boulangerie', dna: 'field-notes', platform: 'web' });
  assert.match(text, /Landing pour une boulangerie/);
  assert.match(text, /get_dna avec "field-notes"/);
  assert.match(text, /wrap_screen/);
  assert.doesNotMatch(getWorkflow('ui_screen')!.render({ brief: 'x' }), /DNA imposée/);
});

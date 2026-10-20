import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadModes, getModes, readModeRules } from '../src/modes/modes.js';
import { checkDnaModes, defaultMode, loadLibrary } from '../src/dna/library.js';
import { DnaSchema } from '../src/dna/schema.js';
import { lintScreen } from '../src/screen/lint.js';
import { readMeta, tailwindConfig, wrapScreen } from '../src/screen/wrap.js';
import { retheme } from '../src/screen/retheme.js';

const lib = loadLibrary().dnas;

test('les modes livrés se chargent', () => {
  const { modes, errors } = getModes();
  assert.deepEqual(errors, []);
  assert.ok(modes.has('website'));
  assert.ok(modes.has('product-desktop'));
  assert.match(readModeRules('product-desktop'), /densité/i);
  assert.match(readModeRules('website'), /moment fort/i);
});

test('un nouveau mode s’ajoute par un simple dossier', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'naos-modes-'));
  try {
    const mobile = JSON.parse(readFileSync(path.join(process.cwd(), 'content/modes/product-desktop/mode.json'), 'utf8'));
    mkdirSync(path.join(dir, 'product-mobile'));
    writeFileSync(
      path.join(dir, 'product-mobile', 'mode.json'),
      JSON.stringify({ ...mobile, id: 'product-mobile', name: 'Produit mobile', viewports: [{ name: 'mobile', width: 390, height: 844, mobile: true }] }),
    );
    mkdirSync(path.join(dir, 'cassé'));
    writeFileSync(path.join(dir, 'cassé', 'mode.json'), '{"id":"cassé"}');
    const { modes, errors } = loadModes(dir);
    assert.deepEqual([...modes.keys()], ['product-mobile']);
    assert.equal(modes.get('product-mobile')!.viewports[0]!.slice, 1400, 'valeurs par défaut appliquées');
    assert.equal(errors.length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('toutes les DNA sont valides et servent au moins un mode connu', () => {
  assert.ok(lib.size >= 18);
  for (const dna of lib.values()) assert.deepEqual(checkDnaModes(dna), [], dna.id);
});

test('une DNA doit fournir les champs exigés par ses modes', () => {
  const artefact = lib.get('artefact-dark')!;
  const { sizes: _s, ...block } = artefact.modes['product-desktop']!;
  const broken = DnaSchema.parse({ ...artefact, modes: { 'product-desktop': block } });
  assert.match(checkDnaModes(broken).join(), /sizes : requis/);
  const unknown = DnaSchema.parse({ ...artefact, modes: { 'mode-inexistant': {} } });
  assert.match(checkDnaModes(unknown).join(), /mode inconnu/);
});

test('mode par défaut d’une DNA', () => {
  assert.equal(defaultMode(lib.get('artefact-dark')!), 'product-desktop');
  assert.equal(defaultMode(lib.get('field-notes')!), 'website');
  assert.equal(defaultMode(lib.get('field-notes')!, 'product-desktop'), 'website', 'mode non servi ignoré');
});

test('dimensions sémantiques : générées depuis le bloc de mode, neutres sinon', () => {
  const artefact = lib.get('artefact-dark')!;
  const product = tailwindConfig(artefact, 'product-desktop').theme.extend.spacing;
  assert.equal(product.ctl, '2.25rem');
  assert.equal(product.row, '2.5rem');
  assert.equal(product.sidebar, '224px');
  const neutral = tailwindConfig(lib.get('field-notes')!, 'website').theme.extend.spacing;
  assert.equal(neutral.ctl, '2.5rem');
});

test('le mode est inscrit dans la page et relu', () => {
  const html = wrapScreen('<h1>x</h1>', lib.get('artefact-dark')!, { mode: 'product-desktop' });
  assert.equal(readMeta(html).mode, 'product-desktop');
});

test('profil de lint : libellés et formules marketing selon le mode', () => {
  const body = '<h1>Règles</h1><p>Une expérience seamless.</p><button>Valider</button><button>OK</button>';
  const web = lintScreen(body, { profile: getModes().modes.get('website')!.lint });
  const app = lintScreen(body, { profile: getModes().modes.get('product-desktop')!.lint });
  const rules = (r: ReturnType<typeof lintScreen>) => Object.fromEntries(r.violations.map((v) => [v.rule, v.count]));
  assert.equal(rules(web)['content.generic-cta'], 2);
  assert.ok(rules(web)['content.banned-word']);
  assert.equal(rules(app)['content.generic-cta'], 1, '« Valider » est correct en produit, pas « OK »');
  assert.equal(rules(app)['content.banned-word'], undefined);
});

test('retheme : refuse une DNA qui ne sert pas le mode de la page', () => {
  const page = wrapScreen('<h1>x</h1>', lib.get('artefact-dark')!, { mode: 'product-desktop' });
  assert.throws(() => retheme(page, lib.get('field-notes')!, (id) => lib.get(id)), /ne sert pas le mode « product-desktop »/);
  const ok = retheme(page, lib.get('artefact-light')!, (id) => lib.get(id));
  assert.equal(ok.mode, 'product-desktop');
  assert.equal(readMeta(ok.html).mode, 'product-desktop');
});

test('les sections déclarées par une DNA existent, dans le bon mode, et lui sont ouvertes', async () => {
  const { loadPatterns } = await import('../src/patterns/library.js');
  const { patterns } = loadPatterns();
  for (const dna of lib.values()) {
    for (const [mode, block] of Object.entries(dna.modes)) {
      for (const id of block.patterns ?? []) {
        const p = patterns.get(id);
        assert.ok(p, `${dna.id} : section inconnue ${id}`);
        assert.equal(p.mode, mode, `${dna.id} : ${id} n'est pas une section du mode ${mode}`);
        assert.ok(!p.dna || p.dna.includes(dna.id), `${dna.id} : ${id} est réservée à d'autres DNA`);
      }
    }
  }
});

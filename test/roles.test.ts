import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getLibrary } from '../src/dna/library.js';
import { DnaSchema, type Dna } from '../src/dna/schema.js';
import { checkRoles, colorAllowance, resolveRoles } from '../src/dna/roles.js';
import { tailwindConfig, wrapScreen } from '../src/screen/wrap.js';
import { lintScreen } from '../src/screen/lint.js';
import { retheme } from '../src/screen/retheme.js';

const lib = getLibrary().dnas;
const dark = lib.get('artefact-dark')!;
const light = lib.get('daylight-product')!;

function clone(dna: Dna): Dna {
  return structuredClone(dna);
}

test('rôles : défauts quand la DNA n’en déclare pas', () => {
  const dna = clone(dark);
  delete dna.modes.presentation!.roles;
  const r = resolveRoles(dna, 'presentation');
  assert.equal(r.alt, dna.tokens.base.toUpperCase(), 'l’alternance est désactivée');
  assert.equal(r.onAlt, dna.tokens.ink.toUpperCase());
  assert.equal(r.highlight, (dna.tokens.accentText ?? dna.tokens.accent).toUpperCase());
  assert.equal(r.emphasis, dna.tokens.accent.toUpperCase());
  assert.equal(r.connector, dna.tokens.line.toUpperCase());
  assert.equal(r.brandFrom, dna.tokens.accent.toUpperCase());
  assert.equal(r.brandTo, dna.tokens.accent2.toUpperCase());
});

test('rôles : références de token, d’extraColor et dégradé à trois arrêts', () => {
  const dna = clone(dark);
  dna.modes.presentation!.roles = {
    alt: 'ref:surface',
    onAlt: 'ref:ink',
    highlight: 'ref:status-investigation',
    brand: { from: 'ref:accent2', via: 'ref:accent-ui', to: 'ref:accent' },
  };
  const r = resolveRoles(dna, 'presentation');
  assert.equal(r.alt, dna.tokens.surface.toUpperCase());
  assert.equal(r.highlight, dna.extraColors!['status-investigation']!.toUpperCase());
  assert.equal(r.brandVia, dna.extraColors!['accent-ui']!.toUpperCase());
});

test('rôles : une référence inconnue est refusée au chargement', () => {
  const dna = clone(dark);
  dna.modes.presentation!.roles = { alt: 'ref:paper-introuvable' };
  const parsed = DnaSchema.safeParse(dna);
  assert.equal(parsed.success, false);
  assert.match(JSON.stringify(parsed.error?.issues), /ne désigne ni un token ni une extraColor/);
});

test('rôles : onAlt sur alt sous 7 est refusé, avec une valeur proposée', () => {
  const dna = clone(light);
  dna.modes.presentation!.roles = { alt: '#FFFFFF', onAlt: '#8A8A8A', onAltMuted: '#333333' };
  const parsed = DnaSchema.safeParse(dna);
  assert.equal(parsed.success, false);
  const text = JSON.stringify(parsed.error?.issues);
  assert.match(text, /roles\.onAlt/);
  assert.match(text, /valeur proche admissible : #[0-9A-F]{6}/);
});

test('rôles : une DNA sans roles se charge et garde les défauts', () => {
  const dna = clone(dark);
  delete dna.modes.presentation!.roles;
  assert.equal(DnaSchema.safeParse(dna).success, true);
  assert.deepEqual(checkRoles(undefined, dna, 'presentation'), []);
});

test('wrap : les classes des rôles sont générées et exposées à la page', () => {
  const dna = clone(dark);
  dna.modes.presentation!.roles = {
    alt: 'ref:raised',
    onAlt: 'ref:ink',
    onAltMuted: 'ref:muted',
    highlight: 'ref:accent2',
    emphasis: 'ref:accent',
    connector: 'ref:line',
    brand: { from: 'ref:accent', to: 'ref:accent2' },
  };
  const cfg = tailwindConfig(dna, 'presentation') as {
    theme: { extend: { colors: Record<string, string>; backgroundColor: Record<string, string>; textColor: Record<string, string>; borderColor: Record<string, string>; backgroundImage: Record<string, string> } };
  };
  const e = cfg.theme.extend;
  assert.equal(e.backgroundColor.alt, dna.tokens.raised.toUpperCase());
  assert.equal(e.textColor['on-alt'], dna.tokens.ink.toUpperCase());
  assert.equal(e.textColor['on-alt-muted'], dna.tokens.muted.toUpperCase());
  assert.equal(e.colors.highlight, dna.tokens.accent2.toUpperCase());
  assert.equal(e.borderColor.emphasis, dna.tokens.accent.toUpperCase());
  assert.equal(e.textColor.connector, dna.tokens.line.toUpperCase());
  assert.match(e.backgroundImage.brand, /linear-gradient\(180deg/);

  const html = wrapScreen('<p class="text-ink">x</p>', dna, { mode: 'presentation' });
  assert.match(html, /"roles":\{/);
  assert.match(html, /"highlight":"#CC6BFF"/i);
});

test('wrap : un mode sans dnaRoles n’expose aucun rôle', () => {
  const dna = clone(dark);
  const cfg = tailwindConfig(dna, 'website') as { theme: { extend: { backgroundColor: Record<string, string> } } };
  assert.equal(cfg.theme.extend.backgroundColor.alt, undefined);
});

test('retheme : un corps en rôles ne perd rien entre deux DNA du mode', () => {
  const body = [
    '<section data-slide class="bg-alt px-24"><h2 class="text-on-alt">Titre</h2></section>',
    '<section data-slide class="bg-base"><p class="text-highlight">52 %</p>',
    '<div class="border-emphasis"></div><svg class="text-connector"><path d="M0 0" /></svg>',
    '<div class="bg-brand"></div></section>',
  ].join('\n');
  const source = clone(dark);
  source.modes.presentation!.roles = {
    alt: 'ref:raised',
    onAlt: 'ref:ink',
    highlight: 'ref:accent2',
    emphasis: 'ref:accent',
    connector: 'ref:line',
    brand: { from: 'ref:accent', to: 'ref:accent2' },
  };
  const doc = wrapScreen(body, source, { mode: 'presentation' });
  for (const target of [dark, light]) {
    const r = retheme(doc, target, () => source, { mode: 'presentation' });
    assert.deepEqual(r.missingClasses, [], `${target.id} : ${JSON.stringify(r.missingClasses)}`);
  }
});

test('retheme : une extraColor absente de la cible est signalée avec un exemple', () => {
  const source = clone(dark);
  source.extraColors = { ...source.extraColors, paper: '#F2F2F6' };
  const target = clone(dark);
  const doc = wrapScreen('<section data-slide class="bg-paper text-ink"><p>Preuve</p></section>', source, { mode: 'presentation' });
  const r = retheme(doc, target, () => source, { mode: 'presentation' });
  assert.deepEqual(r.missingClasses.map((c) => c.class), ['bg-paper']);
  assert.equal(r.missingClasses[0]?.count, 1);
  assert.match(r.missingClasses[0]?.sample ?? '', /bg-paper/);
});

test('lint : color.unknown distingue rôles, tokens et couleurs inventées', () => {
  const dna = clone(dark);
  const colors = colorAllowance(dna, ['alt', 'highlight', 'emphasis', 'connector', 'brand'], ['display', 'title', 'subtitle', 'body', 'caption']);
  const ok = lintScreen(
    '<section class="bg-alt text-on-alt bg-highlight/10 border-emphasis text-connector bg-brand text-display">' +
      '<div class="bg-cover bg-center text-center border-dashed ring-offset-2 text-2xl"></div></section>',
    { theme: dna.theme, colors },
  );
  assert.deepEqual(ok.violations.filter((v) => v.rule === 'color.unknown'), []);

  const bad = lintScreen('<section class="bg-paper text-ink-ghost border-sev-nowhere"></section>', { theme: dna.theme, colors });
  const unknown = bad.violations.find((v) => v.rule === 'color.unknown');
  assert.ok(unknown, 'color.unknown attendu');
  assert.equal(unknown.severity, 'error');
  assert.match(unknown.samples.join(' '), /bg-paper/);
  assert.match(unknown.samples.join(' '), /text-ink-ghost/);
});

import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inlineIcons, parseAttributes } from '../src/screen/icons.js';

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path d="M4 4h16" stroke="currentColor" fill="none"/></svg>';

/** Faux CDN : aucun test ne dépend du réseau ni de la disponibilité d'Iconify. */
const fakeFetch = async (prefix: string, name: string) => {
  if (name === 'absent') throw new Error('introuvable');
  return SVG;
};

test('inlineIcons : la balise devient un SVG qui garde classe, rôle et aria', async () => {
  const html = '<p><iconify-icon icon="lucide:arrow-right" aria-hidden="true" class="size-icon"></iconify-icon> Suite</p>';
  const r = await inlineIcons(html, fakeFetch);
  assert.deepEqual(r.inlined, ['lucide:arrow-right']);
  assert.deepEqual(r.missing, []);
  assert.match(r.html, /^<p><svg /);
  assert.match(r.html, /class="size-icon"/);
  assert.match(r.html, /aria-hidden="true"/);
  assert.doesNotMatch(r.html, /iconify-icon/);
  assert.match(r.html, /Suite<\/p>$/, 'le reste du texte est intact');
});

test('inlineIcons : balise auto-fermée, attributs booléens et nom invalide', async () => {
  const r = await inlineIcons('<div><iconify-icon icon="lucide:check" role="img" aria-label="Fait"/></div>', fakeFetch);
  assert.match(r.html, /<svg [^>]*role="img" aria-label="Fait"/);
  assert.deepEqual(parseAttributes(' icon="lucide:x" hidden '), { icon: 'lucide:x', hidden: '' });
  const bad = await inlineIcons('<iconify-icon icon="n’importe quoi"></iconify-icon>', fakeFetch);
  assert.deepEqual(bad.inlined, []);
  assert.deepEqual(bad.missing, ['n’importe quoi']);
  assert.match(bad.html, /iconify-icon/);
});

test('inlineIcons : une icône introuvable reste une balise, le reste est remplacé', async () => {
  const html = '<iconify-icon icon="lucide:absent"></iconify-icon><iconify-icon icon="lucide:check"></iconify-icon>';
  const r = await inlineIcons(html, fakeFetch);
  assert.deepEqual(r.missing, ['lucide:absent']);
  assert.deepEqual(r.inlined, ['lucide:check']);
  assert.match(r.html, /iconify-icon icon="lucide:absent"/);
  assert.equal((r.html.match(/<svg /g) ?? []).length, 1);
});

test('inlineIcons : sans icône, le HTML est rendu tel quel', async () => {
  const html = '<h1>Rien à faire</h1>';
  const r = await inlineIcons(html, fakeFetch);
  assert.equal(r.html, html);
  assert.deepEqual([r.inlined.length, r.missing.length], [0, 0]);
});

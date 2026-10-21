import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lintScreen } from '../src/screen/lint.js';

const rules = (r: ReturnType<typeof lintScreen>) => r.violations.map((v) => v.rule);
const fixed = (r: ReturnType<typeof lintScreen>) => r.fixes.map((f) => f.rule);

test('un écran propre ne lève aucune erreur', () => {
  const r = lintScreen(`
    <main class="p-6">
      <h1 class="font-display text-2xl text-ink">Factures en attente</h1>
      <p class="text-muted">3 factures arrivent à échéance cette semaine.</p>
      <label for="q" class="text-sm">Rechercher</label>
      <input id="q" class="border border-line rounded-ui">
      <button class="bg-accent text-accent-ink rounded-ui">Relancer les clients</button>
      <img src="https://example.com/a.jpg" alt="">
    </main>`);
  assert.equal(r.errorCount, 0, JSON.stringify(r.violations, null, 1));
  assert.equal(r.needsRepair, false);
});

test('gris Tailwind convertis selon le thème clair, variantes et opacité conservées', () => {
  const r = lintScreen('<h1 class="text-gray-900 md:hover:bg-gray-100 border-slate-200 bg-white/80 text-sm">Titre</h1>', { theme: 'light' });
  assert.match(r.html, /class="text-ink md:hover:bg-raised border-line bg-surface\/80 text-sm"/);
  assert.ok(fixed(r).includes('tokens.color'));
  assert.equal(r.errorCount, 0);
});

test('gris Tailwind convertis selon le thème sombre', () => {
  const r = lintScreen('<h1 class="bg-gray-950 text-gray-100 text-gray-400 border-zinc-800">x</h1>', { theme: 'dark' });
  assert.match(r.html, /class="bg-base text-ink text-muted border-line"/);
});

test('sans thème connu, les gris restent signalés', () => {
  const r = lintScreen('<h1 class="text-gray-900">x</h1>');
  assert.ok(rules(r).includes('tokens.named-color'));
});

test('text-white dépend du fond de l’élément', () => {
  const r = lintScreen('<button class="bg-accent text-white">Payer</button><div class="bg-ink text-white">x</div><p class="text-white">y</p>', { theme: 'light' });
  assert.match(r.html, /bg-accent text-accent-ink/);
  assert.match(r.html, /bg-ink text-inverse/);
  assert.ok(rules(r).includes('tokens.named-color')); // le <p> isolé reste à corriger
});

test('couleurs vives, arbitraires et en ligne sont des erreurs', () => {
  const r = lintScreen('<h1 class="bg-gradient-to-r from-purple-500 to-indigo-600 text-[#ff0000]" style="color: red">x</h1>', { theme: 'light' });
  assert.ok(rules(r).includes('tokens.named-color'));
  assert.ok(rules(r).includes('tokens.arbitrary-color'));
  assert.ok(rules(r).includes('tokens.inline-color'));
  assert.equal(r.needsRepair, true);
});

test('arrondis, ombres et familles de police ramenés aux tokens', () => {
  const r = lintScreen('<h1 class="rounded-lg rounded-t-2xl rounded-full shadow-md shadow-xl font-sans">x</h1>');
  assert.match(r.html, /class="rounded-ui rounded-t-card rounded-full shadow-card shadow-overlay font-body"/);
});

test('emojis retirés, symboles typographiques conservés', () => {
  const r = lintScreen('<h1>Lancement 🚀 réussi ✓ → suite 👍🏽</h1>');
  assert.match(r.html, /<h1>Lancement réussi ✓ → suite <\/h1>/);
  assert.equal(r.fixes.find((f) => f.rule === 'content.emoji')?.count, 2);
});

test('texte de remplissage et formules creuses', () => {
  const r = lintScreen('<h1>Titre ici</h1><p>Lorem ipsum dolor</p><p>Débloquez une expérience seamless.</p>');
  assert.ok(rules(r).includes('content.placeholder'));
  assert.ok(rules(r).includes('content.banned-word'));
});

test('accessibilité : alt, noms de boutons et de liens, libellés de champs', () => {
  const r = lintScreen(`
    <h1>Profil</h1>
    <img src="a.jpg">
    <button><iconify-icon icon="lucide:x"></iconify-icon></button>
    <button aria-label="Fermer"><iconify-icon icon="lucide:x"></iconify-icon></button>
    <a href="/"></a>
    <input placeholder="Email">
    <label>Nom <input></label>
    <input type="hidden" name="t">`);
  const v = Object.fromEntries(r.violations.map((x) => [x.rule, x.count]));
  assert.equal(v['a11y.img-alt'], 1);
  assert.equal(v['a11y.button-name'], 1);
  assert.equal(v['a11y.link-name'], 1);
  assert.equal(v['a11y.label'], 1);
});

test('structure des titres et éléments cliquables non interactifs', () => {
  const r = lintScreen('<h2>A</h2><h4>B</h4><div @click="open = true">Ouvrir</div>');
  assert.ok(rules(r).includes('a11y.h1'));
  assert.ok(rules(r).includes('a11y.heading-order'));
  assert.ok(rules(r).includes('a11y.clickable-div'));
});

test('un document complet est ramené à son corps, balises de head et scripts externes retirés', () => {
  const r = lintScreen('<!DOCTYPE html><html><head><title>x</title></head><body><link rel="stylesheet" href="a.css"><script src="https://cdn.tailwindcss.com"></script><h1>Ok</h1></body></html>');
  assert.equal(r.html, '<h1>Ok</h1>');
  assert.deepEqual(fixed(r).sort(), ['structure.external-script', 'structure.head-tag', 'structure.unwrap']);
});

test('hex dans un script de graphique : avertissement', () => {
  const r = lintScreen('<h1>KPI</h1><canvas id="c"></canvas><script>new Chart(c,{data:{datasets:[{backgroundColor:"#3B82F6"}]}})</script>');
  assert.ok(rules(r).includes('tokens.script-hex'));
});

test('images aléatoires signalées, emplacements décrits rendus accessibles', () => {
  const r = lintScreen('<h1>x</h1><img src="https://picsum.photos/400" alt=""><div data-image="Boulangère qui sort le pain du four" class="aspect-video"></div><div data-image=""></div>');
  const rules = r.violations.map((v) => v.rule);
  assert.ok(rules.includes('content.random-image'));
  assert.ok(rules.includes('content.image-slot'), 'description vide');
  assert.match(r.html, /role="img" aria-label="Boulangère qui sort le pain du four"/);
});

test('rounded-ui sur un conteneur ou une image : avertissement', () => {
  const r = lintScreen('<h1>x</h1><div data-image="Capture" class="aspect-[4/3] rounded-ui"></div><button class="rounded-ui">Valider la commande</button>');
  const v = r.violations.find((x) => x.rule === 'tokens.radius-role');
  assert.equal(v?.count, 1, 'le bouton n’est pas concerné');
});

test('autofix désactivé : HTML inchangé, problèmes signalés', () => {
  const input = '<h1 class="rounded-lg">Salut 🎉</h1>';
  const r = lintScreen(input, { autofix: false });
  assert.equal(r.html, input);
  assert.ok(rules(r).includes('tokens.fixable'));
  assert.ok(rules(r).includes('content.emoji'));
});

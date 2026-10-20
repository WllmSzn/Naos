/**
 * Audit de rendu : toutes les sections de la bibliothèque, avec chaque DNA, dans un vrai navigateur.
 * Détecte ce que le lint ne voit pas (contraste réel, débordement mobile, cibles tactiles, erreurs JS).
 *
 *   npm run audit                 → toutes les DNA
 *   npm run audit -- cobalt-night → une seule
 */
import { loadLibrary } from '../src/dna/library.js';
import { loadPatterns } from '../src/patterns/library.js';
import { wrapScreen } from '../src/screen/wrap.js';
import { previewScreen } from '../src/preview/preview.js';

const { dnas } = loadLibrary();
const { patterns } = loadPatterns();
const only = process.argv.slice(2);

const pages = (['web', 'app'] as const).map((platform) => {
  const list = [...patterns.values()].filter((p) => p.platform === platform);
  return {
    platform,
    body: list.map((p) => `<!-- ${p.id} -->\n${p.html}`).join('\n'),
    libs: [...new Set(list.flatMap((p) => p.libs))],
  };
});

let total = 0;
for (const dna of dnas.values()) {
  if (only.length && !only.includes(dna.id)) continue;
  for (const page of pages) {
    const html = wrapScreen(page.body, dna, { title: `Audit ${dna.id} ${page.platform}`, libs: page.libs });
    const r = await previewScreen(html, { name: `audit-${dna.id}-${page.platform}`, screenshots: false });
    const errors = r.issues.filter((i) => i.severity === 'error');
    const warnings = r.issues.filter((i) => i.severity === 'warning');
    total += errors.length;
    console.log(`${dna.id.padEnd(18)} ${page.platform.padEnd(4)} ${errors.length ? `${errors.length} erreur(s)` : 'ok'}${warnings.length ? `, ${warnings.length} avertissement(s)` : ''}`);
    for (const i of r.issues) console.log(`    ${i.severity === 'error' ? '✖' : '·'} ${i.rule} [${i.viewport}] ${i.samples.slice(0, 4).join(' | ')}`);
  }
}
process.exitCode = total ? 1 : 0;

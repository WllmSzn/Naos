/**
 * Audit de rendu : pour chaque DNA et chacun de ses modes, toutes les sections du mode
 * (génériques + propres à la DNA) dans un vrai navigateur, aux largeurs et seuils du mode.
 * Détecte ce que le lint ne voit pas (contraste réel, débordement, cibles, erreurs JS).
 *
 *   npm run audit                 → toutes les DNA
 *   npm run audit -- cobalt-night → une seule
 */
import { loadLibrary } from '../src/dna/library.js';
import { getModes } from '../src/modes/modes.js';
import { loadPatterns } from '../src/patterns/library.js';
import { wrapScreen } from '../src/screen/wrap.js';
import { previewScreen } from '../src/preview/preview.js';

const { dnas } = loadLibrary();
const { patterns } = loadPatterns();
const modes = getModes().modes;
const only = process.argv.slice(2);

let total = 0;
for (const dna of dnas.values()) {
  if (only.length && !only.includes(dna.id)) continue;
  for (const modeId of Object.keys(dna.modes)) {
    const mode = modes.get(modeId);
    if (!mode) continue;
    const list = [...patterns.values()].filter((p) => p.mode === mode.id && (!p.dna || p.dna.includes(dna.id)));
    if (!list.length) continue;
    const body = list.map((p) => `<!-- ${p.id} -->\n${p.html}`).join('\n');
    const libs = [...new Set(list.flatMap((p) => p.libs))];
    const html = wrapScreen(body, dna, { title: `Audit ${dna.id} ${mode.id}`, libs, mode: mode.id });
    const r = await previewScreen(html, { name: `audit-${dna.id}-${mode.id}`, mode, screenshots: false });
    const errors = r.issues.filter((i) => i.severity === 'error');
    const warnings = r.issues.filter((i) => i.severity === 'warning');
    total += errors.length;
    console.log(`${dna.id.padEnd(18)} ${mode.id.padEnd(16)} ${list.length} sections  ${errors.length ? `${errors.length} erreur(s)` : 'ok'}${warnings.length ? `, ${warnings.length} avertissement(s)` : ''}`);
    for (const i of r.issues) console.log(`    ${i.severity === 'error' ? '✖' : '·'} ${i.rule} [${i.viewport}] ${i.samples.slice(0, 4).join(' | ')}`);
  }
}
process.exitCode = total ? 1 : 0;

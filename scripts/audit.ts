/**
 * Audit de rendu : pour chaque DNA et chacun de ses modes, toutes les sections du mode
 * (génériques + propres à la DNA) et tous ses blocs (dans une section hôte), dans un vrai
 * navigateur, aux largeurs et seuils du mode. Détecte ce que le lint ne voit pas
 * (contraste réel, débordement du cadre, cibles tactiles, erreurs JS).
 *
 *   npm run audit                 → toutes les DNA
 *   npm run audit -- cobalt-night → une seule
 */
import { loadLibrary } from '../src/dna/library.js';
import { getModes } from '../src/modes/modes.js';
import { loadPatterns } from '../src/patterns/library.js';
import { loadBlocks } from '../src/blocks/library.js';
import { hostSection } from '../src/blocks/host.js';
import { wrapScreen } from '../src/screen/wrap.js';
import { previewScreen } from '../src/preview/preview.js';
import type { Mode } from '../src/modes/modes.js';
import type { Dna } from '../src/dna/schema.js';

const { dnas } = loadLibrary();
const { patterns } = loadPatterns();
const { blocks } = loadBlocks();
const modes = getModes().modes;
const only = process.argv.slice(2);

let total = 0;

for (const dna of dnas.values()) {
  if (only.length && !only.includes(dna.id)) continue;
  for (const modeId of Object.keys(dna.modes)) {
    const mode = modes.get(modeId);
    if (!mode) continue;

    const sections = [...patterns.values()].filter((p) => p.mode === mode.id && (!p.dna || p.dna.includes(dna.id)));
    if (sections.length) {
      const body = sections.map((p) => `<!-- ${p.id} -->\n${p.html}`).join('\n');
      await report(dna, mode, sections.length, 'sections', body, [...new Set(sections.flatMap((p) => p.libs))]);
    }

    const list = [...blocks.values()].filter((b) => b.mode === mode.id && (!b.dna || b.dna.includes(dna.id)));
    if (list.length) {
      const titleClass = dna.modes[mode.id]?.typeScale ? 'text-title' : '';
      const body = list.map((b) => `<!-- ${b.id} -->\n${hostSection(b, mode, titleClass)}`).join('\n');
      await report(dna, mode, list.length, 'blocs', body, [...new Set(list.flatMap((b) => b.libs))]);
    }
  }
}

async function report(dna: Dna, mode: Mode, count: number, kind: string, body: string, libs: string[]) {
  const html = wrapScreen(body, dna, { title: `Audit ${dna.id} ${mode.id}`, libs, mode: mode.id });
  const r = await previewScreen(html, { name: `audit-${dna.id}-${mode.id}-${kind}`, mode, screenshots: false });
  const errors = r.issues.filter((i) => i.severity === 'error');
  const warnings = r.issues.filter((i) => i.severity === 'warning');
  total += errors.length;
  console.log(
    `${dna.id.padEnd(18)} ${mode.id.padEnd(16)} ${String(count).padStart(2)} ${kind.padEnd(8)} ${errors.length ? `${errors.length} erreur(s)` : 'ok'}${warnings.length ? `, ${warnings.length} avertissement(s)` : ''}`,
  );
  for (const i of r.issues) console.log(`    ${i.severity === 'error' ? '✖' : '·'} ${i.rule} [${i.viewport}] ${i.samples.slice(0, 4).join(' | ')}`);
}

process.exitCode = total ? 1 : 0;

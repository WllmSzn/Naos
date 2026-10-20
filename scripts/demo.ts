/**
 * Génère les écrans d'exemple pour chaque DNA qui sert leur mode, dans output/ :
 * même corps HTML, une page par DNA. Utile pour juger une DNA nouvelle ou modifiée.
 *
 *   npm run demo                 → toutes les DNA
 *   npm run demo -- linen-ledger → une seule
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { loadLibrary } from '../src/dna/library.js';
import { getMode } from '../src/modes/modes.js';
import { lintScreen } from '../src/screen/lint.js';
import { wrapScreen, type Lib } from '../src/screen/wrap.js';
import { saveScreen } from '../src/screen/output.js';
import { PROJECT_ROOT } from '../src/paths.js';

const EXAMPLES: Array<{ prefix: string; file: string; title: string; mode: string; libs: Lib[] }> = [
  { prefix: 'landing', file: 'landing.body.html', title: 'Orée', mode: 'website', libs: [] },
  { prefix: 'demo', file: 'invoices-dashboard.body.html', title: 'Factures', mode: 'product-desktop', libs: ['chartjs'] },
  { prefix: 'soc', file: 'soc-alerts.body.html', title: 'Alertes', mode: 'product-desktop', libs: [] },
];

const { dnas, errors } = loadLibrary();
for (const e of errors) console.error(`DNA invalide ${e.file} : ${e.issues.join(' ; ')}`);

const only = process.argv.slice(2);
for (const example of EXAMPLES) {
  const mode = getMode(example.mode);
  if (!mode) continue;
  const body = readFileSync(path.join(PROJECT_ROOT, 'examples', example.file), 'utf8');
  for (const dna of dnas.values()) {
    if (only.length && !only.includes(dna.id)) continue;
    if (!(mode.id in dna.modes)) continue;
    const report = lintScreen(body, { theme: dna.theme, profile: mode.lint });
    const file = saveScreen(
      `${example.prefix}-${dna.id}`,
      wrapScreen(report.html, dna, { title: `${example.title} · ${dna.name}`, libs: example.libs, mode: mode.id }),
    );
    const status = report.needsRepair ? `${report.errorCount} erreur(s) : ${report.violations.filter((v) => v.severity === 'error').map((v) => v.rule).join(', ')}` : 'ok';
    console.log(`${example.prefix.padEnd(8)} ${mode.id.padEnd(16)} ${dna.id.padEnd(18)} ${status.padEnd(12)} ${file}`);
  }
}

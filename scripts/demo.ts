/**
 * Génère les écrans d'exemple pour chaque DNA dans output/ :
 * même corps HTML, une page par DNA. Utile pour juger une DNA nouvelle ou modifiée.
 *
 *   npm run demo                 → toutes les DNA
 *   npm run demo -- linen-ledger → une seule
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { loadLibrary } from '../src/dna/library.js';
import { lintScreen } from '../src/screen/lint.js';
import { wrapScreen, type Lib } from '../src/screen/wrap.js';
import { saveScreen } from '../src/screen/output.js';
import { PROJECT_ROOT } from '../src/paths.js';

const EXAMPLES: Array<{ prefix: string; file: string; title: string; libs: Lib[] }> = [
  { prefix: 'demo', file: 'invoices-dashboard.body.html', title: 'Factures', libs: ['chartjs'] },
  { prefix: 'landing', file: 'landing.body.html', title: 'Orée', libs: [] },
];

const { dnas, errors } = loadLibrary();
for (const e of errors) console.error(`DNA invalide ${e.file} : ${e.issues.join(' ; ')}`);

const only = process.argv.slice(2);
for (const example of EXAMPLES) {
  const body = readFileSync(path.join(PROJECT_ROOT, 'examples', example.file), 'utf8');
  for (const dna of dnas.values()) {
    if (only.length && !only.includes(dna.id)) continue;
    const report = lintScreen(body, { theme: dna.theme });
    const file = saveScreen(
      `${example.prefix}-${dna.id}`,
      wrapScreen(report.html, dna, { title: `${example.title} · ${dna.name}`, libs: example.libs }),
    );
    const status = report.needsRepair ? `${report.errorCount} erreur(s) : ${report.violations.filter((v) => v.severity === 'error').map((v) => v.rule).join(', ')}` : 'ok';
    console.log(`${example.prefix.padEnd(8)} ${dna.id.padEnd(18)} ${status.padEnd(12)} ${file}`);
  }
}

/**
 * Migration ponctuelle (2026-10-20) : DNA « à plat » → identité commune + blocs par mode.
 * - DNA de site : signature et règles passent telles quelles dans modes.website.
 * - DNA ARTEFACT : règles d'identité au niveau racine, règles d'écran dans modes["product-desktop"].
 * Idempotent : une DNA qui a déjà un champ modes est laissée intacte.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const dir = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..', 'content', 'dna');

// Règles ARTEFACT d'identité (vraies dans tous les modes), repérées par leur début.
const ARTEFACT_IDENTITY_DO = ['Une seule action principale', 'Liens textuels', 'Sévérité :', 'Focus visible'];
const ARTEFACT_IDENTITY_DONT = ['Pas de couleur codée', 'Pas de rose de marque', 'Pas de rouge, orange', 'Pas de Kufam'];
const pick = (list, starts) => list.filter((r) => starts.some((s) => r.startsWith(s)));
const omit = (list, starts) => list.filter((r) => !starts.some((s) => r.startsWith(s)));

const ARTEFACT_PRODUCT = {
  density: 'compact',
  // Mesuré dans le code d'ARTEFACT (racine 15 px) : ui/button.tsx, ui/table.tsx, hooks/useSidebarResize.ts.
  sizes: { control: '2.25rem', controlSm: '2rem', row: '2.5rem', sidebar: '224px', icon: '1rem' },
  states: {
    selected: 'bg-accent-ui/10 border-l-[3px] border-l-accent-ui font-semibold',
    hover: 'hover:bg-raised',
    focus: 'focus-visible:ring-[3px] focus-visible:ring-accent-ui',
    disabled: 'opacity-50 cursor-not-allowed',
  },
};

let migrated = 0;
for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const full = path.join(dir, file);
  const dna = JSON.parse(readFileSync(full, 'utf8'));
  if (dna.modes) continue;
  const { signature, rules, ...rest } = dna;
  let out;
  if (dna.id === 'artefact-dark' || dna.id === 'artefact-light') {
    out = {
      ...rest,
      rules: { do: pick(rules.do, ARTEFACT_IDENTITY_DO), dont: pick(rules.dont, ARTEFACT_IDENTITY_DONT) },
      modes: {
        'product-desktop': {
          signature,
          ...ARTEFACT_PRODUCT,
          rules: { do: omit(rules.do, ARTEFACT_IDENTITY_DO), dont: omit(rules.dont, ARTEFACT_IDENTITY_DONT) },
        },
      },
    };
  } else {
    out = { ...rest, modes: { website: { signature, rules } } };
  }
  writeFileSync(full, JSON.stringify(out, null, 2) + '\n');
  migrated++;
  console.log(`migrée : ${dna.id} → ${Object.keys(out.modes).join(', ')}`);
}
console.log(`${migrated} DNA migrée(s).`);

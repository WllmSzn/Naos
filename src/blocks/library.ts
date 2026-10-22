import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { normalize } from '../dna/suggest.js';
import { getModes, MODES_DIR, type Mode } from '../modes/modes.js';
import { LIBRARY_DIRS } from '../paths.js';
import { scanLibraryRoot } from '../dna/library.js';

/**
 * Blocs : fragments réutilisables insérés DANS une section (schéma, chiffre clé,
 * grille, emplacement média), par opposition aux sections qui sont une diapo entière.
 * Même convention que les patterns : un commentaire JSON en première ligne, puis le HTML.
 *
 *   content/modes/<mode>/blocks/<id>.html
 *   <famille>/blocks/<mode>/<id>.html            (partagé par la famille)
 *   <famille>/<id>/blocks/<mode>/<id>.html       (propre à une DNA)
 */

const kebab = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'id en kebab-case');

export const BlockSlotSchema = z.object({
  name: z.string().min(1).describe('Nom de l’emplacement, ex. "branches"'),
  description: z.string().min(3).describe('Ce qu’on écrit dedans'),
  constraint: z.string().min(1).optional().describe('Longueur ou nombre attendu, ex. "2 à 4 branches"'),
});

export const BlockVariantSchema = z.object({
  name: z.string().min(1).describe('Nom de la variante, ex. "merge"'),
  attribute: z.string().min(1).describe('Attribut ou classe qui l’active, ex. "data-variant=\\"merge\\""'),
});

export const BlockMetaSchema = z.object({
  id: kebab,
  name: z.string().min(1),
  kind: kebab,
  description: z.string().min(10),
  tags: z.array(z.string()).default([]),
  libs: z.array(z.enum(['alpine', 'chartjs'])).default([]),
  slots: z.array(BlockSlotSchema).default([]),
  variants: z.array(BlockVariantSchema).default([]),
  fits: z.array(z.string()).default([]).describe('Sections hôtes conseillées'),
  minWidth: z.number().int().min(120).describe('Largeur en px sous laquelle le bloc se dégrade'),
  dna: z.array(z.string()).optional().describe('Réservé à ces DNA'),
});

export type BlockMeta = z.infer<typeof BlockMetaSchema> & { mode: string };
export interface Block extends BlockMeta {
  html: string;
}

const META_RE = /^\s*<!--\s*(\{[\s\S]*?\})\s*-->\s*/;

export interface BlockLibrary {
  blocks: Map<string, Block>;
  errors: Array<{ file: string; issue: string }>;
}

function loadModeBlocks(mode: Mode, dir: string, out: BlockLibrary, prefix = mode.id, defaultDna?: string[]) {
  if (!existsSync(dir)) return;
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.html')).sort()) {
    const label = `${prefix}/${file}`;
    const source = readFileSync(path.join(dir, file), 'utf8');
    const match = source.match(META_RE);
    if (!match?.[1]) {
      out.errors.push({ file: label, issue: 'commentaire de métadonnées JSON manquant en première ligne' });
      continue;
    }
    let meta: z.infer<typeof BlockMetaSchema>;
    try {
      const parsed = BlockMetaSchema.safeParse(JSON.parse(match[1]));
      if (!parsed.success) {
        out.errors.push({ file: label, issue: parsed.error.issues.map((i) => `${i.path.join('.')} : ${i.message}`).join(' ; ') });
        continue;
      }
      meta = parsed.data;
    } catch (e) {
      out.errors.push({ file: label, issue: `JSON illisible : ${(e as Error).message}` });
      continue;
    }
    if (`${meta.id}.html` !== file) {
      out.errors.push({ file: label, issue: `l'id « ${meta.id} » ne correspond pas au nom de fichier` });
      continue;
    }
    if (!mode.blockKinds.includes(meta.kind)) {
      const known = mode.blockKinds.length ? mode.blockKinds.join(', ') : 'aucun type de bloc déclaré';
      out.errors.push({ file: label, issue: `type « ${meta.kind} » inconnu du mode ${mode.id} (${known})` });
      continue;
    }
    if (out.blocks.has(meta.id)) {
      out.errors.push({ file: label, issue: `id en double : ${meta.id}` });
      continue;
    }
    const dna = meta.dna ?? defaultDna;
    out.blocks.set(meta.id, { ...meta, ...(dna ? { dna } : {}), mode: mode.id, html: source.slice(match[0].length).trim() });
  }
}

function loadLibraryBlocks(blocksDir: string, out: BlockLibrary, prefix: string, defaultDna: string[]) {
  if (!existsSync(blocksDir)) return;
  const modes = getModes().modes;
  for (const modeId of readdirSync(blocksDir).sort()) {
    const mode = modes.get(modeId);
    if (!mode) {
      out.errors.push({ file: `${prefix}/blocks/${modeId}`, issue: `mode inconnu (disponibles : ${[...modes.keys()].join(', ')})` });
      continue;
    }
    loadModeBlocks(mode, path.join(blocksDir, modeId), out, `${prefix}/blocks/${modeId}`, defaultDna);
  }
}

export function loadBlocks(modesDir: string = MODES_DIR, libraryRoots: string[] = LIBRARY_DIRS): BlockLibrary {
  const out: BlockLibrary = { blocks: new Map(), errors: [] };
  for (const mode of getModes().modes.values()) loadModeBlocks(mode, path.join(modesDir, mode.id, 'blocks'), out);

  for (const root of libraryRoots) {
    const locations = scanLibraryRoot(root).filter((l) => l.family);
    const families = [...new Set(locations.map((l) => l.family!))];
    for (const family of families) {
      const members = locations.filter((l) => l.family === family).map((l) => path.basename(l.dir));
      loadLibraryBlocks(path.join(root, ...family.split('/'), 'blocks'), out, family, members);
    }
    for (const loc of locations) {
      const id = path.basename(loc.dir);
      loadLibraryBlocks(path.join(loc.dir, 'blocks'), out, `${loc.family}/${id}`, [id]);
    }
  }
  return out;
}

let cached: BlockLibrary | null = null;
export function getBlocks(): BlockLibrary {
  cached ??= loadBlocks();
  return cached;
}
export function reloadBlockLibrary(): BlockLibrary {
  cached = loadBlocks();
  return cached;
}

export interface BlockQuery {
  mode: string;
  dna?: string;
  ids?: string[];
  kinds?: string[];
  query?: string;
  limit?: number;
}

/** Sélection d'un mode : blocs propres à la DNA d'abord, puis pertinence et type. */
export function findBlocks(all: Iterable<Block>, q: BlockQuery): Block[] {
  const visible = [...all].filter((b) => b.mode === q.mode && (!b.dna || (q.dna !== undefined && b.dna.includes(q.dna))));
  if (q.ids?.length) return q.ids.map((id) => visible.find((b) => b.id === id)).filter((b): b is Block => !!b);

  const words = q.query ? normalize(q.query).split(' ').filter((w) => w.length > 2) : [];
  const kindOrder = (k: string) => {
    const i = q.kinds?.indexOf(k) ?? -1;
    return i === -1 ? 999 : i;
  };
  return visible
    .filter((b) => !q.kinds?.length || q.kinds.includes(b.kind))
    .map((b) => {
      const hay = ` ${normalize([b.id, b.name, b.description, ...b.tags, ...b.fits].join(' '))} `;
      return { b, score: words.filter((w) => hay.includes(w)).length };
    })
    .filter((x) => !words.length || x.score > 0)
    .sort((a, b) => b.score - a.score || Number(!!b.b.dna) - Number(!!a.b.dna) || kindOrder(a.b.kind) - kindOrder(b.b.kind))
    .slice(0, q.limit ?? 12)
    .map((x) => x.b);
}

export function blockMeta({ html: _html, ...meta }: Block): BlockMeta {
  return meta;
}

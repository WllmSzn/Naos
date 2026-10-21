import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { normalize } from '../dna/suggest.js';
import { getModes, MODES_DIR, type Mode } from '../modes/modes.js';
import { LIBRARY_DIRS } from '../paths.js';
import { scanLibraryRoot } from '../dna/library.js';

/**
 * Sections de référence : structure en classes sémantiques, rangées par mode
 * (content/modes/<mode>/patterns/<id>.html). Le modèle les adapte, il ne les colle pas.
 * Métadonnées JSON dans un commentaire en première ligne. Une section peut être propre
 * à certaines DNA (champ dna) : elle n'est alors proposée qu'avec ces DNA.
 */

export const PatternMetaSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(1),
  kind: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().min(10),
  tags: z.array(z.string()).default([]),
  libs: z.array(z.enum(['alpine', 'chartjs'])).default([]),
  dna: z.array(z.string()).optional().describe('Réservée à ces DNA'),
});

export type PatternMeta = z.infer<typeof PatternMetaSchema> & { mode: string };
export interface Pattern extends PatternMeta {
  html: string;
}

const META_RE = /^\s*<!--\s*(\{[\s\S]*?\})\s*-->\s*/;

export interface PatternLibrary {
  patterns: Map<string, Pattern>;
  errors: Array<{ file: string; issue: string }>;
}

/**
 * @param defaultDna DNA auxquelles réserver une section qui ne le précise pas
 *                   (sections rangées avec une DNA ou dans une famille de la bibliothèque).
 */
function loadModePatterns(mode: Mode, dir: string, out: PatternLibrary, prefix = mode.id, defaultDna?: string[]) {
  if (!existsSync(dir)) return;
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.html')).sort()) {
    const label = `${prefix}/${file}`;
    const source = readFileSync(path.join(dir, file), 'utf8');
    const match = source.match(META_RE);
    if (!match?.[1]) {
      out.errors.push({ file: label, issue: 'commentaire de métadonnées JSON manquant en première ligne' });
      continue;
    }
    let meta: z.infer<typeof PatternMetaSchema>;
    try {
      const parsed = PatternMetaSchema.safeParse(JSON.parse(match[1]));
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
    if (!mode.patternKinds.includes(meta.kind)) {
      out.errors.push({ file: label, issue: `type « ${meta.kind} » inconnu du mode ${mode.id} (${mode.patternKinds.join(', ')})` });
      continue;
    }
    if (out.patterns.has(meta.id)) {
      out.errors.push({ file: label, issue: `id en double : ${meta.id}` });
      continue;
    }
    const dna = meta.dna ?? defaultDna;
    out.patterns.set(meta.id, { ...meta, ...(dna ? { dna } : {}), mode: mode.id, html: source.slice(match[0].length).trim() });
  }
}

/** Sections d'un dossier patterns/<mode>/ de la bibliothèque (DNA ou famille). */
function loadLibraryPatterns(patternsDir: string, out: PatternLibrary, prefix: string, defaultDna: string[]) {
  if (!existsSync(patternsDir)) return;
  const modes = getModes().modes;
  for (const modeId of readdirSync(patternsDir).sort()) {
    const mode = modes.get(modeId);
    if (!mode) {
      out.errors.push({ file: `${prefix}/patterns/${modeId}`, issue: `mode inconnu (disponibles : ${[...modes.keys()].join(', ')})` });
      continue;
    }
    loadModePatterns(mode, path.join(patternsDir, modeId), out, `${prefix}/patterns/${modeId}`, defaultDna);
  }
}

/**
 * Sections génériques des modes (content/modes/<mode>/patterns/), puis sections de la bibliothèque :
 *   <famille>/patterns/<mode>/   partagées par les DNA de la famille (ou celles listées dans « dna ») ;
 *   <famille>/<id>/patterns/<mode>/   propres à une DNA.
 */
export function loadPatterns(modesDir: string = MODES_DIR, libraryRoots: string[] = LIBRARY_DIRS): PatternLibrary {
  const out: PatternLibrary = { patterns: new Map(), errors: [] };
  for (const mode of getModes().modes.values()) loadModePatterns(mode, path.join(modesDir, mode.id, 'patterns'), out);

  for (const root of libraryRoots) {
    const locations = scanLibraryRoot(root).filter((l) => l.family);
    const families = [...new Set(locations.map((l) => l.family!))];
    for (const family of families) {
      const members = locations.filter((l) => l.family === family).map((l) => path.basename(l.dir));
      loadLibraryPatterns(path.join(root, ...family.split('/'), 'patterns'), out, family, members);
    }
    for (const loc of locations) {
      const id = path.basename(loc.dir);
      loadLibraryPatterns(path.join(loc.dir, 'patterns'), out, `${loc.family}/${id}`, [id]);
    }
  }
  return out;
}

let cached: PatternLibrary | null = null;
export function getPatterns() {
  cached ??= loadPatterns();
  return cached;
}
export function reloadPatterns() {
  cached = loadPatterns();
  return cached;
}

export interface PatternQuery {
  mode: string;
  /** DNA en cours : ses sections propres sont incluses et passent en tête ; celles des autres DNA sont exclues. */
  dna?: string;
  ids?: string[];
  kinds?: string[];
  query?: string;
  limit?: number;
}

/** Sélection dans un mode par ids, types et mots-clés (nom, description, tags). */
export function findPatterns(all: Iterable<Pattern>, q: PatternQuery): Pattern[] {
  const visible = [...all].filter((p) => p.mode === q.mode && (!p.dna || (q.dna !== undefined && p.dna.includes(q.dna))));
  if (q.ids?.length) return q.ids.map((id) => visible.find((p) => p.id === id)).filter((p): p is Pattern => !!p);

  const kindOrder = (k: string) => {
    const i = q.kinds?.indexOf(k) ?? -1;
    return i === -1 ? 999 : i;
  };
  const words = q.query ? normalize(q.query).split(' ').filter((w) => w.length > 2) : [];
  const scored = visible
    .filter((p) => !q.kinds?.length || q.kinds.includes(p.kind))
    .map((p) => {
      const hay = ` ${normalize([p.id, p.name, p.description, ...p.tags].join(' '))} `;
      return { p, score: words.filter((w) => hay.includes(w)).length };
    })
    .filter((x) => !words.length || x.score > 0)
    // Pertinence, puis sections propres à la DNA d'abord, puis ordre des types demandés.
    .sort((a, b) => b.score - a.score || Number(!!b.p.dna) - Number(!!a.p.dna) || kindOrder(a.p.kind) - kindOrder(b.p.kind));
  const limit = q.limit ?? 6;

  // Types demandés : chaque type est couvert avant qu'un type n'obtienne une deuxième variante.
  if (q.kinds && q.kinds.length > 1) {
    const byKind = q.kinds.map((k) => scored.filter((x) => x.p.kind === k).map((x) => x.p));
    const picked: Pattern[] = [];
    for (let round = 0; picked.length < limit && byKind.some((list) => list.length > round); round++) {
      for (const list of byKind) if (list[round] && picked.length < limit) picked.push(list[round]!);
    }
    return picked;
  }
  return scored.slice(0, limit).map((x) => x.p);
}

export function patternMeta({ html: _html, ...meta }: Pattern): PatternMeta {
  return meta;
}

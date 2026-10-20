import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { normalize } from '../dna/suggest.js';
import { getModes, MODES_DIR, type Mode } from '../modes/modes.js';

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

function loadModePatterns(mode: Mode, dir: string, out: PatternLibrary) {
  if (!existsSync(dir)) return;
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.html')).sort()) {
    const label = `${mode.id}/${file}`;
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
    out.patterns.set(meta.id, { ...meta, mode: mode.id, html: source.slice(match[0].length).trim() });
  }
}

export function loadPatterns(modesDir: string = MODES_DIR): PatternLibrary {
  const out: PatternLibrary = { patterns: new Map(), errors: [] };
  for (const mode of getModes().modes.values()) loadModePatterns(mode, path.join(modesDir, mode.id, 'patterns'), out);
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

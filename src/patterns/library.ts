import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { CONTENT_DIR } from '../paths.js';
import { normalize } from '../dna/suggest.js';

/**
 * Bibliothèque de sections : références de STRUCTURE en classes sémantiques.
 * Le modèle les adapte (contenu, proportions, règles de la DNA), il ne les colle pas.
 * Format : content/patterns/<id>.html, métadonnées JSON dans un commentaire en première ligne.
 */

export const PATTERNS_DIR = path.join(CONTENT_DIR, 'patterns');

export const PATTERN_KINDS = [
  'nav', 'hero', 'logos', 'intro', 'feature', 'stats', 'testimonial', 'pricing', 'faq', 'cta', 'footer',
  'app-shell', 'kpi', 'table', 'form', 'empty',
] as const;

export const PatternMetaSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(1),
  kind: z.enum(PATTERN_KINDS),
  platform: z.enum(['web', 'app']),
  description: z.string().min(10),
  tags: z.array(z.string()).default([]),
  libs: z.array(z.enum(['alpine', 'chartjs'])).default([]),
});

export type PatternMeta = z.infer<typeof PatternMetaSchema>;
export interface Pattern extends PatternMeta {
  html: string;
}

const META_RE = /^\s*<!--\s*(\{[\s\S]*?\})\s*-->\s*/;

export function loadPatterns(dir: string = PATTERNS_DIR): { patterns: Map<string, Pattern>; errors: Array<{ file: string; issue: string }> } {
  const patterns = new Map<string, Pattern>();
  const errors: Array<{ file: string; issue: string }> = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.html')).sort()) {
    const source = readFileSync(path.join(dir, file), 'utf8');
    const match = source.match(META_RE);
    if (!match?.[1]) {
      errors.push({ file, issue: 'commentaire de métadonnées JSON manquant en première ligne' });
      continue;
    }
    let meta: PatternMeta;
    try {
      const parsed = PatternMetaSchema.safeParse(JSON.parse(match[1]));
      if (!parsed.success) {
        errors.push({ file, issue: parsed.error.issues.map((i) => `${i.path.join('.')} : ${i.message}`).join(' ; ') });
        continue;
      }
      meta = parsed.data;
    } catch (e) {
      errors.push({ file, issue: `JSON illisible : ${(e as Error).message}` });
      continue;
    }
    if (`${meta.id}.html` !== file) {
      errors.push({ file, issue: `l'id « ${meta.id} » ne correspond pas au nom de fichier` });
      continue;
    }
    patterns.set(meta.id, { ...meta, html: source.slice(match[0].length).trim() });
  }
  return { patterns, errors };
}

let cached: ReturnType<typeof loadPatterns> | null = null;
export function getPatterns() {
  cached ??= loadPatterns();
  return cached;
}
export function reloadPatterns() {
  cached = loadPatterns();
  return cached;
}

export interface PatternQuery {
  ids?: string[];
  kinds?: string[];
  platform?: 'web' | 'app';
  query?: string;
  limit?: number;
}

/** Sélection par ids, types, plateforme et mots-clés (nom, description, tags). */
export function findPatterns(all: Iterable<Pattern>, q: PatternQuery): Pattern[] {
  const list = [...all];
  if (q.ids?.length) return q.ids.map((id) => list.find((p) => p.id === id)).filter((p): p is Pattern => !!p);

  const words = q.query ? normalize(q.query).split(' ').filter((w) => w.length > 2) : [];
  const scored = list
    .filter((p) => (!q.kinds?.length || q.kinds.includes(p.kind)) && (!q.platform || p.platform === q.platform))
    .map((p) => {
      const hay = ` ${normalize([p.id, p.name, p.description, ...p.tags].join(' '))} `;
      return { p, score: words.filter((w) => hay.includes(w)).length };
    })
    .filter((x) => !words.length || x.score > 0)
    .sort((a, b) => b.score - a.score || PATTERN_KINDS.indexOf(a.p.kind) - PATTERN_KINDS.indexOf(b.p.kind));
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

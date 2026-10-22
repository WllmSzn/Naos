import type { Dna } from '../dna/schema.js';
import { applyOverrides, type DnaOverrides } from '../dna/overrides.js';
import { ROLE_GROUPS, roleClassNames } from '../dna/roles.js';
import { extractBody, readMeta, wrapScreen, type Lib } from './wrap.js';

/**
 * Retheme sans LLM : le corps ne contient que des classes sémantiques, il suffit
 * de le réenvelopper avec le <head> de la nouvelle DNA. Une passe de correspondance
 * hex rattrape les couleurs littérales restantes (anciens graphiques, SVG).
 */

export interface RethemeOptions {
  /** DNA d'origine, si le document ne la mentionne pas (fragment brut). */
  source?: Dna;
  overrides?: DnaOverrides;
  libs?: readonly Lib[];
  title?: string;
  /** Mode de la page ; par défaut celui inscrit dans le document. */
  mode?: string;
}

export interface RethemeResult {
  html: string;
  from?: string;
  to: string;
  mode?: string;
  hexReplaced: number;
  /** Classes de couleur du corps qui n'existent pas dans la DNA cible. */
  missingClasses: Array<{ class: string; count: number; sample: string }>;
}

/** Canaux porteurs d'un nom de couleur (même forme que le lint, sans cheerio). */
const COLOR_TOKEN_RE = /^(?:[a-z0-9-]+:)*!?(?:bg|text|border(?:-[xytrblse])?|from|via|to|fill|stroke|ring|outline|divide|placeholder|caret|accent|decoration)-([a-z][a-z0-9-]*)(?:\/\S+)?$/;

/**
 * Repère les classes qui portaient une extraColor de la DNA source absente de la
 * cible. Avant les rôles, c'était le trou du retheme : bg-paper restait sans couleur,
 * sans que rien ne le signale.
 */
function missingColorClasses(
  body: string,
  source: Dna | undefined,
  target: Dna,
): Array<{ class: string; count: number; sample: string }> {
  if (!source) return [];
  const sourceExtras = new Set(Object.keys(source.extraColors ?? {}));
  if (!sourceExtras.size) return [];
  const targetNames = new Set([
    ...Object.keys(target.extraColors ?? {}),
    ...Object.keys(target.tokens),
    ...roleClassNames(ROLE_GROUPS),
  ]);
  const suspects = [...sourceExtras].filter((n) => !targetNames.has(n));
  if (!suspects.length) return [];

  const found = new Map<string, { count: number; sample: string }>();
  for (const line of body.split('\n')) {
    for (const attr of line.matchAll(/class="([^"]*)"/g)) {
      for (const token of (attr[1] ?? '').split(/\s+/).filter(Boolean)) {
        const name = token.match(COLOR_TOKEN_RE)?.[1];
        if (!name || !suspects.includes(name)) continue;
        const plain = token.replace(/^(?:[a-z0-9-]+:)*!?/, '');
        const entry = found.get(plain) ?? { count: 0, sample: line.trim().slice(0, 140) };
        entry.count++;
        found.set(plain, entry);
      }
    }
  }
  return [...found].map(([cls, v]) => ({ class: cls, count: v.count, sample: v.sample }));
}

function hexMap(from: Dna, to: Dna): Map<string, string> {
  const map = new Map<string, string>();
  for (const key of Object.keys(from.tokens) as Array<keyof Dna['tokens']>) {
    const source = from.tokens[key];
    const target = to.tokens[key] ?? (key === 'accentText' ? to.tokens.accent : undefined);
    if (source && target) map.set(source.toLowerCase(), target);
  }
  for (const [name, source] of Object.entries(from.extraColors ?? {})) {
    const target = to.extraColors?.[name];
    if (target && !map.has(source.toLowerCase())) map.set(source.toLowerCase(), target);
  }
  from.dataPalette.forEach((hex, i) => {
    const target = to.dataPalette[i % to.dataPalette.length];
    if (target && !map.has(hex.toLowerCase())) map.set(hex.toLowerCase(), target);
  });
  return map;
}

/**
 * @param resolveSource retrouve la DNA d'origine à partir de l'id inscrit dans le document.
 */
export function retheme(
  html: string,
  target: Dna,
  resolveSource: (id: string) => Dna | undefined,
  opts: RethemeOptions = {},
): RethemeResult {
  const meta = readMeta(html);
  const baseSource = opts.source ?? (meta.dnaId ? resolveSource(meta.dnaId) : undefined);
  const source = baseSource ? applyOverrides(baseSource, meta.overrides) : undefined;
  const mode = opts.mode ?? meta.mode;
  if (mode && !(mode in target.modes)) {
    throw new Error(`La DNA « ${target.id} » ne sert pas le mode « ${mode} » (modes : ${Object.keys(target.modes).join(', ')}).`);
  }
  const effective = applyOverrides(target, opts.overrides);

  let body = extractBody(html);
  let hexReplaced = 0;
  if (source) {
    const map = hexMap(source, effective);
    body = body.replace(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g, (hex) => {
      const next = map.get(hex.toLowerCase());
      if (!next || next.toLowerCase() === hex.toLowerCase()) return hex;
      hexReplaced++;
      return next;
    });
  }

  return {
    html: wrapScreen(body, effective, {
      title: opts.title ?? meta.title,
      lang: meta.lang,
      libs: opts.libs ?? meta.libs,
      overrides: opts.overrides,
      mode,
    }),
    from: meta.dnaId ?? opts.source?.id,
    to: target.id,
    mode,
    hexReplaced,
    missingClasses: missingColorClasses(body, source, effective),
  };
}

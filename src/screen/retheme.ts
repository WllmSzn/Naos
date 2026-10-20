import type { Dna } from '../dna/schema.js';
import { applyOverrides, type DnaOverrides } from '../dna/overrides.js';
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
}

export interface RethemeResult {
  html: string;
  from?: string;
  to: string;
  hexReplaced: number;
}

function hexMap(from: Dna, to: Dna): Map<string, string> {
  const map = new Map<string, string>();
  for (const key of Object.keys(from.tokens) as Array<keyof Dna['tokens']>) {
    const source = from.tokens[key];
    const target = to.tokens[key] ?? (key === 'accentText' ? to.tokens.accent : undefined);
    if (source && target) map.set(source.toLowerCase(), target);
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
    }),
    from: meta.dnaId ?? opts.source?.id,
    to: target.id,
    hexReplaced,
  };
}

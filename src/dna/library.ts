import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DNA_DIR } from '../paths.js';
import { DnaSchema, isSystemFont, type Dna, type ModeBlock } from './schema.js';
import { getModes, type ModeRegistry } from '../modes/modes.js';

export interface LibraryError {
  file: string;
  issues: string[];
}

export interface Library {
  dnas: Map<string, Dna>;
  errors: LibraryError[];
}

/**
 * Cohérence entre une DNA et les modes installés : chaque bloc doit viser un mode
 * existant et fournir les champs que ce mode exige (dnaRequires).
 */
export function checkDnaModes(dna: Dna, registry: ModeRegistry = getModes()): string[] {
  const issues: string[] = [];
  for (const [modeId, block] of Object.entries(dna.modes)) {
    const mode = registry.modes.get(modeId);
    if (!mode) {
      issues.push(`modes.${modeId} : mode inconnu (disponibles : ${[...registry.modes.keys()].join(', ')})`);
      continue;
    }
    for (const field of mode.dnaRequires) {
      const value = (block as Record<string, unknown>)[field];
      if (value === undefined || (typeof value === 'object' && value !== null && !Object.keys(value).length)) {
        issues.push(`modes.${modeId}.${field} : requis par le mode « ${mode.name} »`);
      }
    }
  }
  return issues;
}

/**
 * Charge et valide toutes les DNA de content/dna/*.json.
 * Une DNA invalide est écartée et signalée, sans empêcher le serveur de démarrer.
 */
export function loadLibrary(dir: string = DNA_DIR): Library {
  const dnas = new Map<string, Dna>();
  const errors: LibraryError[] = [];

  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  for (const file of files) {
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(path.join(dir, file), 'utf8'));
    } catch (e) {
      errors.push({ file, issues: [`JSON illisible : ${(e as Error).message}`] });
      continue;
    }
    const parsed = DnaSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push({
        file,
        issues: parsed.error.issues.map((i) => `${i.path.join('.') || '(racine)'} : ${i.message}`),
      });
      continue;
    }
    if (dnas.has(parsed.data.id)) {
      errors.push({ file, issues: [`id en double : ${parsed.data.id}`] });
      continue;
    }
    const modeIssues = checkDnaModes(parsed.data);
    if (modeIssues.length) {
      errors.push({ file, issues: modeIssues });
      continue;
    }
    dnas.set(parsed.data.id, parsed.data);
  }
  return { dnas, errors };
}

export function dnaModes(dna: Dna): string[] {
  return Object.keys(dna.modes);
}

export function supportsMode(dna: Dna, mode: string): boolean {
  return mode in dna.modes;
}

export function modeBlock(dna: Dna, mode: string): ModeBlock | undefined {
  return dna.modes[mode];
}

/**
 * Mode à utiliser quand l'appelant n'en précise pas : celui demandé s'il est servi,
 * sinon le seul mode de la DNA, sinon « website » s'il existe, sinon le premier.
 */
export function defaultMode(dna: Dna, requested?: string): string {
  if (requested && supportsMode(dna, requested)) return requested;
  const modes = dnaModes(dna);
  if (modes.length === 1) return modes[0]!;
  return modes.includes('website') ? 'website' : modes[0]!;
}

/**
 * Valide puis enregistre une DNA dans content/dna/<id>.json.
 * Refuse d'écraser un fichier existant sans overwrite explicite.
 */
export function saveDna(input: unknown, { overwrite = false, dir = DNA_DIR } = {}): { dna: Dna; file: string; replaced: boolean } {
  const parsed = DnaSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`DNA invalide : ${parsed.error.issues.map((i) => `${i.path.join('.') || '(racine)'} : ${i.message}`).join(' ; ')}`);
  }
  const modeIssues = checkDnaModes(parsed.data);
  if (modeIssues.length) throw new Error(`DNA invalide : ${modeIssues.join(' ; ')}`);
  const file = path.join(dir, `${parsed.data.id}.json`);
  const replaced = existsSync(file);
  if (replaced && !overwrite) throw new Error(`La DNA « ${parsed.data.id} » existe déjà. Passer overwrite: true pour la remplacer.`);
  writeFileSync(file, JSON.stringify(parsed.data, null, 2) + '\n', 'utf8');
  return { dna: parsed.data, file, replaced };
}

let cached: Library | null = null;

export function getLibrary(): Library {
  cached ??= loadLibrary();
  return cached;
}

export function reloadLibrary(): Library {
  cached = loadLibrary();
  return cached;
}

/** URL Google Fonts couvrant les trois familles de la DNA. */
export function googleFontsUrl(dna: Dna): string {
  const weights = new Map<string, Set<number>>();
  const add = (family: string, ws: number[]) => {
    if (isSystemFont(family)) return;
    const set = weights.get(family) ?? new Set<number>();
    ws.forEach((w) => set.add(w));
    weights.set(family, set);
  };
  add(dna.fonts.display, dna.fonts.displayWeights);
  add(dna.fonts.body, dna.fonts.bodyWeights);
  add(dna.fonts.mono, [400, 500]);
  if (dna.fonts.accent) add(dna.fonts.accent, [400]);

  if (!weights.size) return '';
  const params = [...weights].map(([family, ws]) => {
    const list = [...ws].sort((a, b) => a - b).join(';');
    return `family=${family.trim().replace(/\s+/g, '+')}:wght@${list}`;
  });
  return `https://fonts.googleapis.com/css2?${params.join('&')}&display=swap`;
}

/** Vue compacte pour les catalogues (évite d'envoyer toutes les règles). */
export function dnaSummary(dna: Dna) {
  return {
    id: dna.id,
    name: dna.name,
    theme: dna.theme,
    summary: dna.summary,
    mood: dna.mood,
    bestFor: dna.bestFor,
    modes: dnaModes(dna),
    fonts: `${dna.fonts.display} / ${dna.fonts.body}${dna.fonts.accent ? ` (+ accent ${dna.fonts.accent})` : ''}`,
    accent: dna.tokens.accent,
  };
}

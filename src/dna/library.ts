import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { LIBRARY_DIRS } from '../paths.js';
import { DnaSchema, isSystemFont, type Dna, type ModeBlock } from './schema.js';
import { getModes, type ModeRegistry } from '../modes/modes.js';

export interface LibraryError {
  file: string;
  issues: string[];
}

/** Où vit une DNA : sa bibliothèque, sa famille (dossier) et son fichier. */
export interface DnaLocation {
  root: string;
  family?: string;
  dir: string;
  file: string;
}

export interface Library {
  dnas: Map<string, Dna>;
  locations: Map<string, DnaLocation>;
  errors: LibraryError[];
}

/** Fichier d'une DNA rangée dans une bibliothèque : <famille>/<id>/dna.json. */
export const DNA_FILE = 'dna.json';
// Dossiers d'une famille qui ne sont pas des DNA.
const RESERVED_DIRS = new Set(['patterns', 'previews']);

const isDir = (p: string) => existsSync(p) && statSync(p).isDirectory();
const subdirs = (p: string) =>
  isDir(p) ? readdirSync(p).filter((d) => !d.startsWith('.') && !RESERVED_DIRS.has(d) && isDir(path.join(p, d))).sort() : [];

/**
 * Inventaire des fichiers DNA d'une bibliothèque : les fichiers à plat (ancien content/dna)
 * et les dossiers <famille>/<id>/dna.json.
 */
export function scanLibraryRoot(root: string): DnaLocation[] {
  if (!isDir(root)) return [];
  const flat = readdirSync(root)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({ root, dir: root, file: path.join(root, f) }));
  // Un dossier qui contient dna.json est une DNA ; le chemin qui y mène est sa famille
  // (« artefact », « clients/acme »…). Profondeur bornée pour ne pas errer dans un dépôt.
  const nested: DnaLocation[] = [];
  const walk = (dir: string, family: string[], depth: number) => {
    for (const name of subdirs(dir)) {
      const sub = path.join(dir, name);
      if (existsSync(path.join(sub, DNA_FILE))) {
        if (family.length) nested.push({ root, family: family.join('/'), dir: sub, file: path.join(sub, DNA_FILE) });
      } else if (depth < 4) {
        walk(sub, [...family, name], depth + 1);
      }
    }
  };
  walk(root, [], 0);
  return [...flat, ...nested];
}

/** Familles d'une bibliothèque : chemins (« artefact », « clients/acme ») qui contiennent au moins une DNA. */
export function libraryFamilies(root: string): string[] {
  return [...new Set(scanLibraryRoot(root).map((l) => l.family).filter((f): f is string => !!f))].sort();
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
 * Charge et valide les DNA de toutes les bibliothèques configurées (voir LIBRARY_DIRS).
 * Une DNA invalide est écartée et signalée, sans empêcher le serveur de démarrer.
 * En cas d'id en double, la première bibliothèque l'emporte.
 */
export function loadLibrary(roots: string | string[] = LIBRARY_DIRS): Library {
  const dnas = new Map<string, Dna>();
  const locations = new Map<string, DnaLocation>();
  const errors: LibraryError[] = [];

  for (const loc of (Array.isArray(roots) ? roots : [roots]).flatMap(scanLibraryRoot)) {
    const label = path.relative(loc.root, loc.file) || loc.file;
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(loc.file, 'utf8'));
    } catch (e) {
      errors.push({ file: label, issues: [`JSON illisible : ${(e as Error).message}`] });
      continue;
    }
    const parsed = DnaSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push({ file: label, issues: parsed.error.issues.map((i) => `${i.path.join('.') || '(racine)'} : ${i.message}`) });
      continue;
    }
    const id = parsed.data.id;
    const expected = loc.family ? path.basename(loc.dir) : path.basename(loc.file, '.json');
    if (expected !== id) {
      errors.push({ file: label, issues: [`l'id « ${id} » ne correspond pas à son emplacement (« ${expected} »)`] });
      continue;
    }
    if (dnas.has(id)) {
      errors.push({ file: label, issues: [`id en double : ${id} (déjà chargée depuis ${locations.get(id)!.file})`] });
      continue;
    }
    const modeIssues = checkDnaModes(parsed.data);
    if (modeIssues.length) {
      errors.push({ file: label, issues: modeIssues });
      continue;
    }
    dnas.set(id, parsed.data);
    locations.set(id, loc);
  }
  return { dnas, locations, errors };
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
 * sinon le premier bloc déclaré. L'ordre des blocs dans le JSON porte donc le mode
 * principal : une DNA produit (ARTEFACT) sert aussi le site et la présentation, mais
 * reste d'abord un thème d'application.
 */
export function defaultMode(dna: Dna, requested?: string): string {
  if (requested && supportsMode(dna, requested)) return requested;
  return dnaModes(dna)[0]!;
}

export interface SaveOptions {
  overwrite?: boolean;
  /** Famille (dossier) où ranger une nouvelle DNA : « artefact », « inspirations », « clients/acme »… */
  family?: string;
  /** Bibliothèque cible : la première configurée par défaut. */
  root?: string;
}

/**
 * Valide puis enregistre une DNA.
 * - DNA existante : réécrite à son emplacement actuel (overwrite requis).
 * - Nouvelle DNA : <bibliothèque>/<famille>/<id>/dna.json ; la famille est exigée,
 *   sauf dans l'ancien dossier à plat (content/dna) qui n'en a pas.
 */
export function saveDna(input: unknown, opts: SaveOptions = {}): { dna: Dna; file: string; family?: string; replaced: boolean } {
  const parsed = DnaSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`DNA invalide : ${parsed.error.issues.map((i) => `${i.path.join('.') || '(racine)'} : ${i.message}`).join(' ; ')}`);
  }
  const modeIssues = checkDnaModes(parsed.data);
  if (modeIssues.length) throw new Error(`DNA invalide : ${modeIssues.join(' ; ')}`);
  const dna = parsed.data;
  const root = opts.root ?? LIBRARY_DIRS[0]!;
  const existing = loadLibrary(opts.root ? [opts.root] : LIBRARY_DIRS).locations.get(dna.id);

  if (existing && !opts.overwrite) {
    throw new Error(`La DNA « ${dna.id} » existe déjà (${existing.file}). Passer overwrite: true pour la remplacer.`);
  }
  let file: string;
  let family: string | undefined;
  if (existing) {
    file = existing.file;
    family = existing.family;
  } else {
    const flat = scanLibraryRoot(root).some((l) => !l.family) && !opts.family;
    if (flat) {
      file = path.join(root, `${dna.id}.json`);
    } else {
      if (!opts.family) {
        const families = libraryFamilies(root);
        throw new Error(`Préciser la famille de la nouvelle DNA « ${dna.id} »${families.length ? ` (existantes : ${families.join(', ')})` : ''}.`);
      }
      const safe = opts.family.split(/[\\/]/).map((s) => s.trim()).filter((s) => /^[a-z0-9][a-z0-9-]*$/.test(s));
      if (!safe.length || safe.length !== opts.family.split(/[\\/]/).filter(Boolean).length) {
        throw new Error(`Famille invalide : « ${opts.family} » (minuscules, chiffres et tirets, ex. « clients/acme »).`);
      }
      family = safe.join('/');
      file = path.join(root, ...safe, dna.id, DNA_FILE);
      mkdirSync(path.dirname(file), { recursive: true });
    }
  }
  writeFileSync(file, JSON.stringify(dna, null, 2) + '\n', 'utf8');
  return { dna, file, family, replaced: !!existing };
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

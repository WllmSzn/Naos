import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Ce fichier vit à la racine de src/ (ou de dist/ une fois compilé) :
// la racine du projet est donc toujours son dossier parent.
export const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url));

export const CONTENT_DIR = process.env.NAOS_CONTENT_DIR ?? path.join(PROJECT_ROOT, 'content');
/** Ancien emplacement des DNA (fichiers à plat), utilisé quand aucune bibliothèque n'est configurée. */
export const DNA_DIR = path.join(CONTENT_DIR, 'dna');
export const RULES_DIR = path.join(CONTENT_DIR, 'rules');
export const OUTPUT_DIR = process.env.NAOS_OUTPUT_DIR ?? path.join(PROJECT_ROOT, 'output');

/** Fichier de configuration local (propre à la machine, hors git). */
export const CONFIG_FILE = path.join(PROJECT_ROOT, 'naos.config.json');

/**
 * Bibliothèques de DNA, dans l'ordre de priorité :
 *   1. NAOS_LIBRARY : un ou plusieurs dossiers, séparés par « ; » (Windows) ou « : » ;
 *   2. naos.config.json : { "library": ["C:/Users/…/naos-library"] } (chemins relatifs à Naos) ;
 *   3. content/dna, l'ancien emplacement.
 * Une bibliothèque se range en <famille>/<id>/dna.json ; content/dna reste lu à plat.
 */
export function resolveLibraryDirs(): string[] {
  const fromEnv = process.env.NAOS_LIBRARY?.split(path.delimiter).map((p) => p.trim()).filter(Boolean);
  if (fromEnv?.length) return fromEnv.map((p) => path.resolve(p));
  if (existsSync(CONFIG_FILE)) {
    try {
      const config = JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) as { library?: string | string[] };
      const dirs = typeof config.library === 'string' ? [config.library] : config.library;
      if (dirs?.length) return dirs.map((p) => path.resolve(PROJECT_ROOT, p));
    } catch {
      // Configuration illisible : on retombe sur l'ancien emplacement plutôt que d'empêcher le démarrage.
    }
  }
  return [DNA_DIR];
}

export const LIBRARY_DIRS = resolveLibraryDirs();

import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Ce fichier vit à la racine de src/ (ou de dist/ une fois compilé) :
// la racine du projet est donc toujours son dossier parent.
export const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url));

export const CONTENT_DIR = process.env.NAOS_CONTENT_DIR ?? path.join(PROJECT_ROOT, 'content');
export const DNA_DIR = path.join(CONTENT_DIR, 'dna');
export const RULES_DIR = path.join(CONTENT_DIR, 'rules');
export const OUTPUT_DIR = process.env.NAOS_OUTPUT_DIR ?? path.join(PROJECT_ROOT, 'output');

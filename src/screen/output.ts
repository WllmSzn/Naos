import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { OUTPUT_DIR } from '../paths.js';

/**
 * Base de nom de fichier sûre dans le dossier de sortie : pas de chemin, pas de « .. »,
 * pas d'extension. Le serveur n'écrit et ne lit jamais ailleurs.
 */
export function safeBaseName(name: string): string {
  const base = path.basename(name.replace(/\\/g, '/')).replace(/\.(html?|pdf)$/i, '');
  const clean = base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '');
  if (!clean) throw new Error(`Nom de fichier invalide : « ${name} »`);
  return clean;
}

/** Nom d'une page HTML (extension .html forcée). */
export function safeScreenName(name: string): string {
  return `${safeBaseName(name)}.html`;
}

/** Nom d'un export PDF (extension .pdf forcée). */
export function safePdfName(name: string): string {
  return `${safeBaseName(name)}.pdf`;
}

export function saveScreen(name: string, html: string, dir: string = OUTPUT_DIR): string {
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, safeScreenName(name));
  writeFileSync(file, html, 'utf8');
  return file;
}

export function loadScreen(name: string, dir: string = OUTPUT_DIR): string {
  return readFileSync(path.join(dir, safeScreenName(name)), 'utf8');
}

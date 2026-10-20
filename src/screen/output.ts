import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { OUTPUT_DIR } from '../paths.js';

/**
 * Nom de fichier sûr dans le dossier de sortie : pas de chemin, pas de « .. »,
 * extension .html forcée. Le serveur n'écrit et ne lit jamais ailleurs.
 */
export function safeScreenName(name: string): string {
  const base = path.basename(name.replace(/\\/g, '/')).replace(/\.html?$/i, '');
  const clean = base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '');
  if (!clean) throw new Error(`Nom de fichier invalide : « ${name} »`);
  return `${clean}.html`;
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

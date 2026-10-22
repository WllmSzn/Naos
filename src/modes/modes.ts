import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { CONTENT_DIR } from '../paths.js';
import { ROLE_GROUPS } from '../dna/roles.js';

/**
 * Un mode = un métier de conception (site web, produit desktop, produit mobile…).
 * Il est entièrement décrit par un dossier content/modes/<id>/ :
 *   mode.json      réglages du moteur (captures, seuils, lint, workflow, attentes envers la DNA)
 *   rules.md       règles propres au mode, ajoutées au socle commun
 *   patterns/      sections de référence du mode
 * Ajouter un mode ne demande aucun code.
 */

export const MODES_DIR = path.join(CONTENT_DIR, 'modes');

const kebab = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'id en kebab-case');

export const ViewportSchema = z.object({
  name: kebab.describe('Nom court, ex. "desktop-1440"'),
  width: z.number().int().min(280).max(3840),
  height: z.number().int().min(400).max(2400),
  mobile: z.boolean().default(false),
  scale: z.number().min(0.25).max(3).default(1).describe('Facteur de capture (< 1 : image plus légère)'),
  slice: z.number().int().min(400).max(4000).default(1400).describe('Hauteur CSS d’une tranche de capture'),
});

export const ModeSchema = z.object({
  id: kebab,
  name: z.string().min(1),
  description: z.string().min(10),
  viewports: z.array(ViewportSchema).min(1),
  preview: z.object({
    controlMinHeight: z.number().min(0).describe('Hauteur minimale d’un contrôle (px)'),
    linkMinHeight: z.number().min(0).describe('Hauteur minimale d’un lien isolé (px)'),
    tapTargetViewports: z.array(z.string()).default([]).describe('Viewports où contrôler les cibles ; vide = tous'),
    frameSelector: z
      .string()
      .min(1)
      .optional()
      .describe('Cadres à contenu borné (ex. "[data-slide]") : le rendu signale ceux dont le contenu dépasse la hauteur'),
  }),
  lint: z.object({
    bannedWords: z.boolean().describe('Signaler les formules marketing creuses'),
    genericCta: z.array(z.string()).describe('Libellés d’action jugés trop vagues dans ce mode'),
    requireH1: z.boolean(),
    notes: z
      .boolean()
      .default(false)
      .describe('Avertir quand moins de la moitié des diapos portent des notes orateur (data-notes)'),
  }),
  dnaRequires: z.array(z.string()).describe('Champs obligatoires du bloc de mode dans une DNA'),
  dnaRoles: z
    .array(z.enum(ROLE_GROUPS))
    .default([])
    .describe('Rôles visuels exposés par ce mode (bg-alt, bg-highlight, border-emphasis, text-connector, bg-brand)'),
  patternKinds: z.array(kebab).min(1).describe('Types de sections propres au mode, dans l’ordre de lecture'),
  blockKinds: z
    .array(kebab)
    .default([])
    .describe('Types de blocs du mode (fragments insérés dans une section : diagram, figure, grid, media, meta)'),
  /**
   * Comportement de la page produite. Générique : n'importe quel mode peut demander
   * un runtime ; le code ne teste jamais un id de mode.
   */
  wrap: z
    .object({
      runtime: z
        .enum(['none', 'slides'])
        .default('none')
        .describe('Script injecté par l’enveloppe : "slides" = navigation clavier, plein écran, diapo mise à l’échelle en 16:9'),
      /**
       * Réglages du runtime « slides ». Ils vivent ici et non dans le code : un mode
       * montre des diapos sans forcément vouloir la navigation au doigt ni les notes.
       */
      nav: z
        .object({
          click: z.boolean().default(true).describe('Clic sur la moitié gauche ou droite = diapo précédente ou suivante'),
          swipe: z.boolean().default(true).describe('Balayage horizontal au doigt (seuil ~40 px)'),
          progress: z
            .enum(['none', 'bar', 'part'])
            .default('none')
            .describe('Repère de progression : barre fine, ou « partie n / total » lu dans data-part'),
        })
        .default({ click: true, swipe: true, progress: 'none' }),
      notes: z.boolean().default(true).describe('Panneau de notes orateur (data-notes), touche N'),
    })
    .optional(),
  workflow: z.object({
    unit: z.string().describe('Ce qu’on produit, avec son article : « une page », « un écran »…'),
    frame: z.string().describe('Questions de cadrage'),
    structure: z.string().describe('Comment structurer'),
    compose: z.string().describe('Consignes de composition'),
    review: z.string().describe('Ce qu’il faut regarder sur les captures'),
  }),
});

export type Mode = z.infer<typeof ModeSchema>;
export type Viewport = z.infer<typeof ViewportSchema>;

export interface ModeRegistry {
  modes: Map<string, Mode>;
  errors: Array<{ mode: string; issues: string[] }>;
}

export function loadModes(dir: string = MODES_DIR): ModeRegistry {
  const modes = new Map<string, Mode>();
  const errors: ModeRegistry['errors'] = [];
  if (!existsSync(dir)) return { modes, errors };
  for (const id of readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
    const file = path.join(dir, id, 'mode.json');
    if (!existsSync(file)) {
      errors.push({ mode: id, issues: ['mode.json manquant'] });
      continue;
    }
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
      errors.push({ mode: id, issues: [`JSON illisible : ${(e as Error).message}`] });
      continue;
    }
    const parsed = ModeSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push({ mode: id, issues: parsed.error.issues.map((i) => `${i.path.join('.')} : ${i.message}`) });
      continue;
    }
    if (parsed.data.id !== id) {
      errors.push({ mode: id, issues: [`l'id « ${parsed.data.id} » ne correspond pas au dossier`] });
      continue;
    }
    modes.set(id, parsed.data);
  }
  return { modes, errors };
}

let cached: ModeRegistry | null = null;
export function getModes(): ModeRegistry {
  cached ??= loadModes();
  return cached;
}
export function reloadModes(): ModeRegistry {
  cached = loadModes();
  return cached;
}

export function getMode(id: string): Mode | undefined {
  return getModes().modes.get(id);
}

/** Règles du mode (rules.md), chaîne vide si absentes. */
export function readModeRules(id: string, dir: string = MODES_DIR): string {
  const file = path.join(dir, id, 'rules.md');
  return existsSync(file) ? readFileSync(file, 'utf8') : '';
}

export function modePatternsDir(id: string, dir: string = MODES_DIR): string {
  return path.join(dir, id, 'patterns');
}

export function modeSummary(m: Mode) {
  return {
    id: m.id,
    name: m.name,
    description: m.description,
    viewports: m.viewports.map((v) => `${v.name} (${v.width}px)`),
    patternKinds: m.patternKinds,
    ...(m.blockKinds.length ? { blockKinds: m.blockKinds } : {}),
  };
}

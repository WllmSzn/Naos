import { z } from 'zod';
import { HEX_RE, contrastRatio, mixHex } from '../color.js';
import { RolesSchema, ROLE_GROUPS, checkRoles, roleClassNames } from './roles.js';

const hex = z.string().regex(HEX_RE, 'couleur hex attendue (#RGB ou #RRGGBB)');

/**
 * Tokens sémantiques. Les écrans générés n'utilisent QUE ces noms
 * (bg-base, text-ink, border-line...) : c'est ce qui rend le retheme gratuit.
 */
export const TokensSchema = z.object({
  base: hex.describe('Fond de page'),
  surface: hex.describe('Cartes, panneaux'),
  raised: hex.describe('Surfaces imbriquées, puits, zones de saisie'),
  line: hex.describe('Séparateurs et bordures'),
  ink: hex.describe('Texte principal'),
  muted: hex.describe('Texte secondaire'),
  accent: hex.describe('Action principale, focus'),
  accentInk: hex.describe('Texte posé sur accent'),
  accent2: hex.describe('Accent secondaire, usage rare'),
  accentText: hex
    .optional()
    .describe('Accent utilisé comme couleur de TEXTE (text-accent) si accent, pensé comme aplat, n’est pas lisible sur base'),
  success: hex,
  warning: hex,
  danger: hex,
});

export const FontsSchema = z.object({
  display: z.string().min(1).describe('Titres (famille Google Fonts)'),
  body: z.string().min(1).describe('Texte courant'),
  mono: z.string().min(1).describe('Chiffres tabulaires, code, métadonnées'),
  accent: z.string().min(1).optional().describe('Police d’accent pour un ou deux mots d’un titre (classe font-accent)'),
  displayWeights: z.array(z.number().int().min(100).max(900)).min(1).default([600, 700]),
  bodyWeights: z.array(z.number().int().min(100).max(900)).min(1).default([400, 500, 600]),
});

/** Familles fournies par le système : jamais chargées depuis Google Fonts. */
export function isSystemFont(family: string): boolean {
  return /^(ui-[a-z-]+|system-ui|-apple-system|sans-serif|serif|monospace)$/i.test(family.trim());
}

// Noms interdits pour une couleur métier : ils entreraient en collision avec un token
// sémantique ou une famille de couleurs Tailwind (et le lint les refuserait).
const RESERVED_COLOR_NAMES = new Set([
  'base', 'surface', 'raised', 'line', 'ink', 'muted', 'accent', 'accent-ink', 'accent2', 'success', 'warning', 'danger', 'inverse',
  // Rôles de l'échelle typographique : text-<rôle> ne doit pas désigner une couleur.
  'display', 'title', 'subtitle', 'body', 'caption',
  // Rôles visuels génériques : leurs classes sont générées par wrap, une extraColor du
  // même nom écraserait le rôle (bg-brand d'une DNA contre le dégradé de marque).
  'alt', 'on-alt', 'on-alt-muted', 'highlight', 'emphasis', 'connector', 'connector-muted', 'brand', 'brand-radial',
  'white', 'black', 'transparent', 'current', 'inherit',
  'slate', 'gray', 'zinc', 'neutral', 'stone', 'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan',
  'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
]);

export const RulesSchema = z.object({
  do: z.array(z.string().min(1)).min(1),
  dont: z.array(z.string().min(1)).min(1),
});

const cssLength = z.string().regex(/^\d+(?:\.\d+)?(?:px|rem)$/, 'longueur en px ou rem');

/**
 * Dimensions sémantiques d'un mode produit. Elles deviennent des classes
 * (h-ctl, h-ctl-sm, h-row, w-sidebar, h-header, size-icon) : la densité se règle
 * dans la DNA et suit le retheme, comme les couleurs.
 */
export const SizesSchema = z
  .object({
    control: cssLength.describe('Hauteur d’un contrôle standard (bouton, champ) → h-ctl'),
    controlSm: cssLength.describe('Hauteur d’un contrôle compact → h-ctl-sm'),
    row: cssLength.describe('Hauteur d’une ligne de tableau ou de liste → h-row'),
    sidebar: cssLength.describe('Largeur de la barre latérale → w-sidebar'),
    header: cssLength.describe('Hauteur de l’en-tête d’application → h-header'),
    icon: cssLength.describe('Taille d’icône standard → size-icon'),
  })
  .partial();

/**
 * Échelle typographique d'un mode : des tailles nommées, rendues en classes
 * text-display, text-title, text-subtitle, text-body, text-caption.
 *
 * Une diapo se lit de loin et exige des titres très grands ; un site ou un écran
 * produit se contente des tailles Tailwind. Le réglage est donc générique : il ne
 * dépend pas de l'id du mode, seulement du fait que sa DNA le déclare.
 */
export const TypeScaleSchema = z
  .object({
    display: cssLength.describe('Titre le plus grand, pour une affirmation ou un chiffre → text-display'),
    title: cssLength.describe('Titre de diapo ou de section → text-title'),
    subtitle: cssLength.describe('Sous-titre, chapô, unité d’un chiffre → text-subtitle'),
    body: cssLength.describe('Texte courant → text-body'),
    caption: cssLength.describe('Source, mention, numéro de diapo → text-caption'),
  })
  .partial();

/** Ce qu'une DNA apporte à un mode donné. Les champs exigés dépendent du mode (dnaRequires). */
export const ModeBlockSchema = z.object({
  signature: z.string().min(10).optional().describe('Le moment fort de l’écran'),
  density: z.enum(['compact', 'comfortable', 'spacious']).optional(),
  sizes: SizesSchema.optional(),
  typeScale: TypeScaleSchema.optional().describe('Tailles de texte du mode (text-display, text-title…)'),
  states: z.record(z.string(), z.string()).optional().describe('Classes des états récurrents (selected, hover…)'),
  rules: RulesSchema.optional(),
  patterns: z.array(z.string()).optional().describe('Sections propres à cette DNA, à privilégier dans ce mode'),
  roles: RolesSchema.optional().describe('Rôles visuels du mode (fond alterné, mise en avant, dégradé) que la DNA remplit'),
});

export type ModeBlock = z.infer<typeof ModeBlockSchema>;

/** Réglages par défaut des titres h1-h3, appliqués par l'enveloppe (les classes du corps restent prioritaires). */
export const HeadingsSchema = z.object({
  weight: z.number().int().min(100).max(900),
  tracking: z.string().describe('letter-spacing, ex. "-0.025em"'),
  leading: z.string().describe('line-height, ex. "1.05"'),
});

export const DnaSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'id en kebab-case'),
    name: z.string().min(1),
    version: z.number().int().positive().default(1),
    theme: z.enum(['light', 'dark']),
    summary: z.string().min(10).describe('Une phrase : la personnalité du système'),
    bestFor: z.array(z.string().min(1)).min(3).describe('Types de produits adaptés (mots-clés)'),
    mood: z.array(z.string().min(1)).min(2).describe('Adjectifs d’ambiance'),
    tokens: TokensSchema,
    extraColors: z
      .record(
        z
          .string()
          .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/, 'nom en kebab-case')
          .refine((n) => !RESERVED_COLOR_NAMES.has(n), 'nom réservé (token sémantique ou couleur Tailwind)'),
        hex,
      )
      .optional()
      .describe('Couleurs métier nommées (ex. "sev-critical") : classes text-/bg-/border-<nom>, opacités comprises'),
    rootFontSize: z
      .string()
      .regex(/^\d+(?:\.\d+)?px$/, 'taille en px, ex. "15px"')
      .optional()
      .describe('Taille de police racine du produit (1rem). 16px par défaut'),
    dataPalette: z.array(hex).min(3).max(6).describe('Couleurs de séries pour graphiques, dans l’ordre'),
    fonts: FontsSchema,
    headings: HeadingsSchema.optional(),
    shape: z.object({
      radius: z.string().describe('Rayon standard (boutons, champs)'),
      radiusLarge: z.string().describe('Rayon des cartes et conteneurs'),
      borderWidth: z.string().default('1px'),
    }),
    elevation: z.object({
      card: z.string().describe('box-shadow des cartes, ou "none"'),
      overlay: z.string().describe('box-shadow des popovers, menus, modales'),
    }),
    rules: RulesSchema.optional().describe('Règles d’identité, valables dans tous les modes'),
    modes: z
      .record(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), ModeBlockSchema)
      .refine((m) => Object.keys(m).length > 0, 'au moins un mode')
      .describe('Un bloc par mode servi par la DNA (website, product-desktop…)'),
  })
  .superRefine((dna, ctx) => {
    // Rôles déclarés : contrastes vérifiés, et références « ref:… » résolues.
    // Les rôles non déclarés retombent sur des défauts qui ne cassent aucune DNA.
    for (const [modeId, block] of Object.entries(dna.modes)) {
      for (const message of checkRoles(block.roles, dna, modeId)) {
        ctx.addIssue({ code: 'custom', path: ['modes', modeId, 'roles'], message });
      }
    }

    // Garde-fous d'accessibilité vérifiés à chaque chargement.
    const checks: Array<[keyof typeof dna.tokens, keyof typeof dna.tokens, number]> = [
      ['ink', 'base', 7],
      ['ink', 'surface', 7],
      ['muted', 'base', 4.5],
      ['muted', 'surface', 4.5],
      ['accentInk', 'accent', 4.5],
      // Les couleurs d'état servent aussi de couleur de texte (badges, messages).
      ['success', 'surface', 4.5],
      ['success', 'base', 4.5],
      ['warning', 'surface', 4.5],
      ['warning', 'base', 4.5],
      ['danger', 'surface', 4.5],
      ['danger', 'base', 4.5],
    ];
    const t = dna.tokens as Record<string, string | undefined>;
    for (const [fg, bg, min] of checks) {
      // Un hex invalide est déjà signalé par la validation de champ.
      if (!HEX_RE.test(t[fg] ?? '') || !HEX_RE.test(t[bg] ?? '')) continue;
      const ratio = contrastRatio(t[fg]!, t[bg]!);
      if (ratio < min) {
        ctx.addIssue({
          code: 'custom',
          path: ['tokens', fg],
          message: `contraste ${fg}/${bg} = ${ratio.toFixed(2)} (minimum ${min})`,
        });
      }
    }

    // Couleurs métier : au minimum lisibles comme indicateur (point, bordure) sur les fonds,
    // soit 3:1 (WCAG 1.4.11). Leur usage en texte est vérifié au rendu (preview_screen, npm run audit).
    for (const [name, value] of Object.entries(dna.extraColors ?? {})) {
      if (!HEX_RE.test(value) || !HEX_RE.test(t.base ?? '') || !HEX_RE.test(t.surface ?? '')) continue;
      const worst = Math.min(contrastRatio(value, t.base!), contrastRatio(value, t.surface!));
      if (worst < 3) {
        ctx.addIssue({ code: 'custom', path: ['extraColors', name], message: `contraste ${name} sur le fond = ${worst.toFixed(2)} (minimum 3 pour un indicateur)` });
      }
    }

    // Texte coloré sur sa propre teinte (badges : text-success sur bg-success/10, jusqu'à /15).
    // Et text-accent, qui utilise accentText s'il existe.
    const accentText = t.accentText ?? t.accent;
    const tinted: Array<[string, string | undefined, string | undefined]> = [
      ['success', t.success, t.success],
      ['warning', t.warning, t.warning],
      ['danger', t.danger, t.danger],
      [t.accentText ? 'accentText' : 'accent', accentText, t.accent],
    ];
    for (const [name, text, tintOf] of tinted) {
      if (!text || !tintOf || ![text, tintOf, t.base, t.surface].every((c) => HEX_RE.test(c ?? ''))) continue;
      for (const bgName of ['base', 'surface'] as const) {
        const bg = t[bgName]!;
        const worst = Math.min(contrastRatio(text, bg), contrastRatio(text, mixHex(bg, tintOf, 0.15)));
        if (worst < 4.5) {
          ctx.addIssue({
            code: 'custom',
            path: ['tokens', name],
            message: `contraste ${name} en texte sur ${bgName} ou sur sa teinte (/15) = ${worst.toFixed(2)} (minimum 4.5)`,
          });
          break;
        }
      }
    }
  });

export type Dna = z.infer<typeof DnaSchema>;
export type DnaInput = z.input<typeof DnaSchema>;

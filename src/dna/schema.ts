import { z } from 'zod';
import { HEX_RE, contrastRatio, mixHex } from '../color.js';

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
    signature: z.string().min(10).describe('Le moment fort autorisé, un seul par écran'),
    rules: z.object({
      do: z.array(z.string().min(1)).min(3),
      dont: z.array(z.string().min(1)).min(3),
    }),
  })
  .superRefine((dna, ctx) => {
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

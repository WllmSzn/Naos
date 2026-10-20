import { z } from 'zod';
import { DnaSchema, TokensSchema, type Dna } from './schema.js';
import { HEX_RE } from '../color.js';

/** Ajustements ponctuels d'une DNA (couleur de marque, police imposée…). */
export const DnaOverridesSchema = z
  .object({
    tokens: TokensSchema.partial().optional(),
    dataPalette: z.array(z.string().regex(HEX_RE)).min(3).max(6).optional(),
    fonts: z
      .object({ display: z.string().min(1), body: z.string().min(1), mono: z.string().min(1), accent: z.string().min(1) })
      .partial()
      .optional(),
    shape: z.object({ radius: z.string(), radiusLarge: z.string(), borderWidth: z.string() }).partial().optional(),
  })
  .strict();

export type DnaOverrides = z.infer<typeof DnaOverridesSchema>;

export function hasOverrides(o: DnaOverrides | undefined): o is DnaOverrides {
  return !!o && Object.values(o).some((v) => v !== undefined && (Array.isArray(v) ? v.length > 0 : Object.keys(v).length > 0));
}

/**
 * Applique des surcharges et revalide le tout : une couleur de marque qui casse
 * le contraste est refusée avec un message explicite.
 */
export function applyOverrides(dna: Dna, overrides: DnaOverrides | undefined): Dna {
  if (!hasOverrides(overrides)) return dna;
  const merged = {
    ...dna,
    tokens: { ...dna.tokens, ...overrides.tokens },
    dataPalette: overrides.dataPalette ?? dna.dataPalette,
    fonts: { ...dna.fonts, ...overrides.fonts },
    shape: { ...dna.shape, ...overrides.shape },
  };
  const parsed = DnaSchema.safeParse(merged);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')} : ${i.message}`).join(' ; ');
    throw new Error(`Surcharges refusées pour « ${dna.id} » : ${issues}`);
  }
  return parsed.data;
}

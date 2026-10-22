import { z } from 'zod';
import { HEX_RE, contrastRatio, ensureContrast, mixHex } from '../color.js';

/**
 * Rôles visuels génériques.
 *
 * Le problème réglé : une présentation a besoin d'un fond alterné, d'une mise en
 * avant, d'un trait de schéma et d'un dégradé de marque. Sans nom commun, chaque DNA
 * les exprimait avec ses extraColors (bg-paper, bg-brand-indigo…), et un retheme vers
 * une DNA qui ne les a pas laissait des classes sans couleur. Les rôles donnent un
 * vocabulaire stable que chaque DNA remplit avec ses propres valeurs.
 *
 * Un mode expose les groupes dont il a besoin (`dnaRoles` dans mode.json) ; le code
 * ne connaît aucun id de mode.
 */

export const ROLE_GROUPS = ['alt', 'highlight', 'emphasis', 'connector', 'brand'] as const;
export type RoleGroup = (typeof ROLE_GROUPS)[number];

/** Une valeur de rôle : un hex, ou une référence à un token / une extraColor de la même DNA. */
export const COLOR_REF_RE = /^(?:#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6}|ref:[a-z][a-z0-9]*(?:-[a-z0-9]+)*)$/;
const colorRef = z.string().regex(COLOR_REF_RE, 'couleur hex (#RRGGBB) ou référence "ref:<token>"');

export const RolesSchema = z.object({
  alt: colorRef.optional().describe('Fond de diapo alterné → bg-alt'),
  onAlt: colorRef.optional().describe('Texte sur alt → text-on-alt'),
  onAltMuted: colorRef.optional().describe('Texte secondaire sur alt → text-on-alt-muted'),
  highlight: colorRef.optional().describe('Mise en avant hors action → bg-highlight, text-highlight, border-highlight'),
  emphasis: colorRef.optional().describe('Trait de l’élément retenu → border-emphasis'),
  connector: colorRef.optional().describe('Liens de schéma actifs → text-connector (SVG en currentColor)'),
  connectorMuted: colorRef.optional().describe('Liens faibles, en pointillés → text-connector-muted'),
  brand: z
    .object({ from: colorRef, to: colorRef, via: colorRef.optional() })
    .optional()
    .describe('Dégradé de marque (sphère, orbe) → bg-brand (vertical) et bg-brand-radial'),
});

export type Roles = z.infer<typeof RolesSchema>;

/** Structure minimale dont la résolution a besoin (évite un cycle avec schema.ts). */
export interface RoleCarrier {
  id?: string;
  tokens: Record<string, string | undefined>;
  extraColors?: Record<string, string>;
  modes: Record<string, { roles?: Roles } | undefined>;
}

export interface ResolvedRoles {
  alt: string;
  onAlt: string;
  onAltMuted: string;
  highlight: string;
  emphasis: string;
  connector: string;
  connectorMuted: string;
  brandFrom: string;
  brandVia?: string;
  brandTo: string;
}

/** Noms de classes produits par chaque groupe, tels que le lint et le corps les voient. */
const GROUP_CLASSES: Record<RoleGroup, string[]> = {
  alt: ['alt', 'on-alt', 'on-alt-muted'],
  highlight: ['highlight'],
  emphasis: ['emphasis'],
  connector: ['connector', 'connector-muted'],
  brand: ['brand', 'brand-radial'],
};

/** « accent-ink » et « accentInk » désignent le même token : on accepte les deux écritures. */
function tokenLookup(tokens: Record<string, string | undefined>, name: string): string | undefined {
  const camel = name.replace(/-([a-z0-9])/g, (_m, c: string) => c.toUpperCase());
  return tokens[name] ?? tokens[camel];
}

/** Résout une valeur de rôle en hex. Une référence inconnue est une erreur de schéma. */
export function resolveColorRef(value: string, dna: RoleCarrier): string {
  if (HEX_RE.test(value)) return value.toUpperCase();
  const name = value.slice('ref:'.length);
  const found = tokenLookup(dna.tokens, name) ?? dna.extraColors?.[name];
  if (!found) {
    throw new Error(`« ${value} » ne désigne ni un token ni une extraColor de « ${dnaRef(dna)} »`);
  }
  return found.toUpperCase();
}

function dnaRef(dna: RoleCarrier): string {
  return dna.id ?? 'cette DNA';
}

/**
 * Valeurs effectives d'une DNA pour un mode. Sans bloc de rôles, les défauts désactivent
 * l'alternance (alt = base) et font retomber chaque mise en avant sur l'accent de la DNA.
 */
export function resolveRoles(dna: RoleCarrier, mode?: string): ResolvedRoles {
  const t = dna.tokens;
  const block = mode ? dna.modes[mode]?.roles : undefined;
  const pick = (value: string | undefined, fallback: string | undefined) => {
    if (value) return resolveColorRef(value, dna);
    if (!fallback) throw new Error(`Token manquant pour résoudre un rôle de « ${dnaRef(dna)} »`);
    return fallback.toUpperCase();
  };
  const base = t.base ?? '#FFFFFF';
  const line = t.line ?? base;
  return {
    alt: pick(block?.alt, base),
    onAlt: pick(block?.onAlt, t.ink),
    onAltMuted: pick(block?.onAltMuted, t.muted),
    // text-accent utilise déjà accentText : le rôle de texte suit la même règle, sinon
    // un accent pensé comme aplat (sombre en thème sombre) serait illisible.
    highlight: pick(block?.highlight, t.accentText ?? t.accent),
    emphasis: pick(block?.emphasis, t.accent),
    connector: pick(block?.connector, line),
    // Trait « absent » : la couleur de ligne posée à 60 % sur le fond.
    connectorMuted: pick(block?.connectorMuted, mixHex(base, line, 0.6)),
    brandFrom: pick(block?.brand?.from, t.accent),
    ...(block?.brand?.via ? { brandVia: resolveColorRef(block.brand.via, dna) } : {}),
    brandTo: pick(block?.brand?.to, t.accent2),
  };
}

/** Noms de couleur que les groupes exposés rendent légitimes. */
export function roleClassNames(groups: readonly RoleGroup[]): Set<string> {
  return new Set(groups.flatMap((g) => GROUP_CLASSES[g]));
}

/** Noms de couleur connus du lint : tokens sémantiques, extraColors et rôles exposés. */
export interface ColorAllowance {
  names: Set<string>;
  /** Tailles typographiques du mode (text-display…) : text-<taille> n'est pas une couleur. */
  textSizes: Set<string>;
}

const TOKEN_COLOR_NAMES = [
  'surface', 'raised', 'line', 'ink', 'muted', 'accent', 'accent-ink', 'accent2',
  'success', 'warning', 'danger', 'inverse', 'base',
];

export function colorAllowance(
  dna: { tokens: Record<string, string | undefined>; extraColors?: Record<string, string> },
  groups: readonly RoleGroup[],
  textSizes: readonly string[] = [],
): ColorAllowance {
  return {
    names: new Set([...TOKEN_COLOR_NAMES, ...Object.keys(dna.extraColors ?? {}), ...roleClassNames(groups)]),
    textSizes: new Set(textSizes),
  };
}

export interface RoleThemeFragments {
  colors: Record<string, string>;
  backgroundColor: Record<string, string>;
  textColor: Record<string, string>;
  borderColor: Record<string, string>;
  backgroundImage: Record<string, string>;
}

/** Fragments de config Tailwind des rôles exposés par le mode. */
export function roleThemeConfig(roles: ResolvedRoles, groups: readonly RoleGroup[]): RoleThemeFragments {
  const out: RoleThemeFragments = { colors: {}, backgroundColor: {}, textColor: {}, borderColor: {}, backgroundImage: {} };
  const has = (g: RoleGroup) => groups.includes(g);
  if (has('alt')) {
    out.backgroundColor.alt = roles.alt;
    out.textColor['on-alt'] = roles.onAlt;
    out.textColor['on-alt-muted'] = roles.onAltMuted;
    out.borderColor['on-alt'] = roles.onAlt;
  }
  // Un seul nom pour l'aplat, la bordure et le texte : c'est ce qui permet bg-highlight/10.
  if (has('highlight')) out.colors.highlight = roles.highlight;
  if (has('emphasis')) out.borderColor.emphasis = roles.emphasis;
  if (has('connector')) {
    out.textColor.connector = roles.connector;
    out.textColor['connector-muted'] = roles.connectorMuted;
  }
  if (has('brand')) {
    const middle = roles.brandVia ? `${roles.brandVia} 50%, ` : '';
    out.backgroundImage.brand = `linear-gradient(180deg, ${roles.brandFrom} 0%, ${middle}${roles.brandTo} 100%)`;
    out.backgroundImage['brand-radial'] = `radial-gradient(circle at 50% 35%, ${roles.brandFrom} 0%, ${middle}${roles.brandTo} 80%)`;
  }
  return out;
}

/** Ce que la page montre aux scripts : NAOS.roles. */
export function roleRuntimeData(roles: ResolvedRoles, groups: readonly RoleGroup[]) {
  return {
    ...(groups.includes('alt') ? { alt: roles.alt, onAlt: roles.onAlt, onAltMuted: roles.onAltMuted } : {}),
    ...(groups.includes('highlight') ? { highlight: roles.highlight } : {}),
    ...(groups.includes('emphasis') ? { emphasis: roles.emphasis } : {}),
    ...(groups.includes('connector') ? { connector: roles.connector, connectorMuted: roles.connectorMuted } : {}),
    ...(groups.includes('brand') ? { brandFrom: roles.brandFrom, ...(roles.brandVia ? { brandVia: roles.brandVia } : {}), brandTo: roles.brandTo } : {}),
  };
}

/**
 * Contrastes des rôles déclarés. On ne contrôle que ce que la DNA déclare : une DNA
 * sans rôles garde ses défauts, donc les DNA existantes continuent de se charger.
 *
 * `text-highlight` sur `alt` n'est vérifié que si `alt` est proche de `base` : une
 * couleur ne peut pas atteindre 4,5:1 sur un fond très sombre ET sur un fond très clair.
 * Sur un fond alterné de luminance opposée, la mise en avant se fait par le fond
 * (`bg-alt`) et par `border-emphasis`, et le texte reste `text-on-alt`.
 */
export function checkRoles(roles: Roles | undefined, dna: RoleCarrier, modeId: string): string[] {
  if (!roles) return [];
  const issues: string[] = [];
  let r: ResolvedRoles;
  try {
    // La résolution couvre tous les champs : une référence inconnue est signalée ici.
    r = resolveRoles(dna, modeId);
  } catch (e) {
    return [`roles : ${(e as Error).message}`];
  }
  const t = dna.tokens;
  const base = (t.base ?? '#FFFFFF').toUpperCase();
  const nearBase = HEX_RE.test(base) && HEX_RE.test(r.alt) && contrastRatio(r.alt, base) < 2.5;

  const check = (label: string, fg: string, bg: string, min: number, toward: string) => {
    // Un hex invalide est déjà signalé champ par champ : ne pas masquer son message.
    if (!HEX_RE.test(fg) || !HEX_RE.test(bg)) return;
    const ratio = contrastRatio(fg, bg);
    if (ratio >= min) return;
    const candidate = ensureContrast(fg, toward, [bg], min);
    issues.push(
      `roles.${label} : contraste ${ratio.toFixed(2)} (minimum ${min}) ; valeur proche admissible : ${candidate}`,
    );
  };

  if (roles.alt || roles.onAlt) check('onAlt', r.onAlt, r.alt, 7, (t.ink ?? '#000000').toUpperCase());
  if (roles.alt || roles.onAltMuted) check('onAltMuted', r.onAltMuted, r.alt, 4.5, (t.ink ?? '#000000').toUpperCase());

  if (roles.highlight) {
    check('highlight en texte sur base', r.highlight, base, 4.5, (t.ink ?? '#000000').toUpperCase());
    if (nearBase) check('highlight en texte sur alt', r.highlight, r.alt, 4.5, (t.ink ?? '#000000').toUpperCase());
    for (const [label, bg] of [['base', base], ['alt', r.alt]] as const) {
      if (!HEX_RE.test(bg)) continue;
      const ratio = contrastRatio(r.highlight, bg);
      if (ratio < 3) issues.push(`roles.highlight en aplat sur ${label} : contraste ${ratio.toFixed(2)} (minimum 3)`);
    }
  }
  if (roles.emphasis) {
    for (const [label, bg] of [['base', base], ['alt', r.alt]] as const) {
      if (!HEX_RE.test(bg)) continue;
      const ratio = contrastRatio(r.emphasis, bg);
      if (ratio < 3) issues.push(`roles.emphasis sur ${label} : contraste ${ratio.toFixed(2)} (minimum 3)`);
    }
  }
  if (roles.connector) {
    for (const [label, bg] of [['base', base], ['alt', r.alt]] as const) {
      if (!HEX_RE.test(bg)) continue;
      const ratio = contrastRatio(r.connector, bg);
      if (ratio < 3) issues.push(`roles.connector sur ${label} : contraste ${ratio.toFixed(2)} (minimum 3)`);
    }
  }
  return issues;
}

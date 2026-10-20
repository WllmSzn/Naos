import { colorDistance, contrastRatio, ensureContrast, hexToHsl, mixHex, relativeLuminance } from '../color.js';
import type { RawElement, RawScan } from './collect.js';

/**
 * Analyse déterministe d'un scan : mesures → statistiques → brouillon de DNA.
 * Le brouillon est un point de départ : règles, ambiance et usages restent à écrire.
 */

export interface Weighted<T = string> {
  value: T;
  weight: number;
}

export interface TypeSpec {
  font: string;
  size: number;
  weight: number;
  lineHeight: number;
  letterSpacingEm: number;
  uppercase: boolean;
}

export interface ScanAnalysis {
  url: string;
  title: string;
  theme: 'light' | 'dark';
  colors: {
    backgrounds: Weighted[];
    text: Weighted[];
    borders: Weighted[];
    chromatic: Weighted[];
  };
  fonts: {
    families: Weighted[];
    display?: string;
    body?: string;
    mono?: string;
    loaded: string[];
  };
  typeScale: Weighted<number>[];
  headings: Partial<Record<'h1' | 'h2' | 'h3', TypeSpec>>;
  bodyText?: TypeSpec;
  radii: { buttons: Weighted<number>[]; containers: Weighted<number>[] };
  shadows: Weighted[];
  spacing: Weighted<number>[];
  buttons: Array<{ bg?: string; color?: string; radius?: number; padY?: number; padX?: number; weight: number }>;
  rootColorVars: Record<string, string>;
  draft: DraftDna;
  notes: string[];
}

export interface DraftDna {
  theme: 'light' | 'dark';
  tokens: Record<'base' | 'surface' | 'raised' | 'line' | 'ink' | 'muted' | 'accent' | 'accentInk' | 'accent2' | 'success' | 'warning' | 'danger', string> & {
    accentText?: string;
  };
  dataPalette: string[];
  fonts: { display: string; body: string; mono: string };
  shape: { radius: string; radiusLarge: string; borderWidth: string };
  elevation: { card: string; overlay: string };
  /** Tokens modifiés pour passer les seuils de contraste (valeur d'origine → corrigée). */
  adjusted: Record<string, { from: string; to: string }>;
}

// ── Agrégation ────────────────────────────────────────────────────────────

function tally<T>(entries: Iterable<[T, number]>): Weighted<T>[] {
  const map = new Map<T, number>();
  for (const [k, w] of entries) if (w > 0) map.set(k, (map.get(k) ?? 0) + w);
  return [...map].map(([value, weight]) => ({ value, weight })).sort((a, b) => b.weight - a.weight);
}

/** Fusionne les couleurs quasi identiques dans la plus utilisée. */
function clusterColors(list: Weighted[], threshold = 18): Weighted[] {
  const out: Weighted[] = [];
  for (const c of list) {
    const near = out.find((o) => colorDistance(o.value, c.value) < threshold);
    if (near) near.weight += c.weight;
    else out.push({ ...c });
  }
  return out.sort((a, b) => b.weight - a.weight);
}

function normalizeWeights<T>(list: Weighted<T>[], top = 12): Weighted<T>[] {
  const total = list.reduce((n, x) => n + x.weight, 0) || 1;
  return list.slice(0, top).map((x) => ({ value: x.value, weight: +(x.weight / total).toFixed(3) }));
}

const isChromatic = (hex: string) => {
  const [, s, l] = hexToHsl(hex);
  return s > 0.28 && l > 0.12 && l < 0.9;
};

const isMono = (font: string) => /mono|code|courier|consol|menlo/i.test(font);

function spec(e: RawElement): TypeSpec {
  return {
    font: e.font ?? '',
    size: e.size ?? 16,
    weight: e.weight ?? 400,
    lineHeight: e.size ? +((e.lineHeight ?? e.size * 1.2) / e.size).toFixed(2) : 1.2,
    letterSpacingEm: e.size ? +((e.letterSpacing ?? 0) / e.size).toFixed(3) : 0,
    uppercase: !!e.uppercase,
  };
}

/** Spécification la plus représentative d'un groupe d'éléments (pondérée par le texte). */
function dominantSpec(els: RawElement[]): TypeSpec | undefined {
  if (!els.length) return undefined;
  const key = (e: RawElement) => `${e.font}|${e.size}|${e.weight}`;
  const best = tally(els.map((e) => [key(e), Math.max(e.textLen, 1)] as [string, number]))[0];
  const el = els.find((e) => key(e) === best?.value);
  return el ? spec(el) : undefined;
}

function remFromPx(px: number): string {
  if (px <= 0) return '0';
  if (px >= 100) return '9999px'; // forme « pilule »
  return `${+(px / 16).toFixed(3)}rem`;
}

/** Retire les couches d'ombre entièrement transparentes ; null si rien ne reste. */
function cleanShadow(shadow: string): string | null {
  const layers = shadow.split(/,(?![^(]*\))/).map((l) => l.trim());
  const visible = layers.filter((l) => !/rgba\([^)]*,\s*0\)/.test(l) && !/^0px 0px 0px 0px/.test(l));
  return visible.length ? visible.join(', ') : null;
}

// ── Analyse ───────────────────────────────────────────────────────────────

export function analyzeScan(raw: RawScan): ScanAnalysis {
  const notes: string[] = [];
  const els = raw.elements;

  // Couleurs de fond pondérées par la surface (opaques uniquement).
  const bgRaw = tally(els.filter((e) => e.bg && (e.bgAlpha ?? 1) >= 0.9).map((e) => [e.bg!, e.area] as [string, number]));
  if (raw.pageBg) bgRaw.unshift({ value: raw.pageBg, weight: raw.viewport.w * raw.docHeight });
  const backgrounds = clusterColors(bgRaw);

  // Couleurs de texte pondérées par la quantité de texte × taille.
  const textColors = clusterColors(
    tally(els.filter((e) => e.color && e.textLen > 0 && (e.colorAlpha ?? 1) >= 0.5).map((e) => [e.color!, e.textLen * (e.size ?? 16)] as [string, number])),
  );

  const borders = clusterColors(
    tally(els.filter((e) => e.border && (e.borderWidth ?? 0) <= 2).map((e) => [e.border!, 1] as [string, number])),
  );

  // Couleurs vives : fonds de boutons et liens, textes, bordures — comptées par usage.
  const chromaticRaw: Array<[string, number]> = [];
  for (const e of els) {
    const interactive = e.role === 'button' || e.role === 'link';
    if (e.bg && isChromatic(e.bg) && (e.bgAlpha ?? 1) >= 0.9) chromaticRaw.push([e.bg, interactive ? 6 : Math.min(4, 1 + e.area / 200000)]);
    if (e.color && isChromatic(e.color) && e.textLen > 0) chromaticRaw.push([e.color, interactive ? 3 : 1]);
    if (e.border && isChromatic(e.border)) chromaticRaw.push([e.border, 1]);
  }
  const chromatic = clusterColors(tally(chromaticRaw), 40);

  // ── Rôles de couleur ──
  const base = backgrounds[0]?.value ?? '#FFFFFF';
  const theme: 'light' | 'dark' = relativeLuminance(base) < 0.25 ? 'dark' : 'light';
  const neutralBgs = backgrounds.filter((b) => !isChromatic(b.value) && b.value !== base);
  // Surface : fond neutre le plus utilisé, proche du fond de page (cartes, panneaux).
  const surface =
    neutralBgs.find((b) => colorDistance(b.value, base) < 90 && contrastRatio(b.value, base) < 1.4)?.value ??
    (theme === 'light' ? (relativeLuminance(base) > 0.95 ? mixHex(base, '#000000', 0.03) : '#FFFFFF') : mixHex(base, '#FFFFFF', 0.05));

  // Texte principal : la couleur neutre la plus contrastée parmi celles vraiment utilisées
  // (un site a souvent plus de texte secondaire que de texte principal).
  const readable = textColors.filter((t) => contrastRatio(t.value, base) >= 3 && !isChromatic(t.value));
  const significant = readable.filter((t) => t.weight >= (readable[0]?.weight ?? 0) * 0.15);
  const inkRaw =
    [...significant].sort((a, b) => contrastRatio(b.value, base) - contrastRatio(a.value, base))[0]?.value ??
    (theme === 'light' ? '#111111' : '#F5F5F5');
  const mutedRaw =
    significant.find((t) => t.value !== inkRaw && contrastRatio(t.value, base) < contrastRatio(inkRaw, base) - 1)?.value ??
    readable.find((t) => t.value !== inkRaw && contrastRatio(t.value, base) < contrastRatio(inkRaw, base) - 1)?.value ??
    mixHex(inkRaw, base, 0.4);
  // Bordure : visible sur le fond sans être appuyée, et distincte de la surface.
  const lineCandidate = borders.find((b) => {
    const c = contrastRatio(b.value, base);
    return !isChromatic(b.value) && c >= 1.08 && c < 2.5;
  })?.value;
  const lineRaw =
    lineCandidate && colorDistance(lineCandidate, surface) > 8 ? lineCandidate : mixHex(base, inkRaw, theme === 'light' ? 0.12 : 0.14);

  const accentRaw = chromatic[0]?.value ?? inkRaw;
  if (!chromatic.length) notes.push('Aucune couleur vive dominante : accent = couleur du texte (site monochrome).');
  const accent2Raw =
    chromatic.find((c) => c.value !== accentRaw && Math.abs(hexToHsl(c.value)[0] - hexToHsl(accentRaw)[0]) > 30)?.value ??
    mixHex(accentRaw, inkRaw, 0.5);

  // Surfaces imbriquées : un cran vers l'encre (plus sombre en clair, plus clair en sombre).
  const raised = theme === 'light' ? mixHex(base, inkRaw, 0.05) : mixHex(surface, inkRaw, 0.05);

  // ── Ajustements de contraste (signalés, jamais silencieux) ──
  const adjusted: DraftDna['adjusted'] = {};
  const fix = (name: string, value: string, toward: string, bgs: string[], min: number) => {
    const next = ensureContrast(value, toward, bgs, min);
    if (next !== value) adjusted[name] = { from: value, to: next };
    return next;
  };
  const ink = fix('ink', inkRaw, theme === 'light' ? '#000000' : '#FFFFFF', [base, surface], 7);
  const muted = fix('muted', mutedRaw, ink, [base, surface], 4.5);
  const accentInk = contrastRatio('#FFFFFF', accentRaw) >= contrastRatio(ink, accentRaw) ? '#FFFFFF' : ink;
  const accent = contrastRatio(accentInk, accentRaw) >= 4.5 ? accentRaw : fix('accent', accentRaw, accentInk === '#FFFFFF' ? '#000000' : '#FFFFFF', [accentInk], 4.5);

  // Texte coloré lisible sur le fond ET sur sa propre teinte (badges /10 à /15).
  // La teinte dépend de la couleur : on itère jusqu'à stabilité.
  const tintSafe = (hex: string, tintOf: (c: string) => string = (c) => c) => {
    let c = hex;
    for (let i = 0; i < 5; i++) {
      const t = tintOf(c);
      const next = ensureContrast(c, ink, [base, surface, mixHex(base, t, 0.15), mixHex(surface, t, 0.15)], 4.5);
      if (next === c) break;
      c = next;
    }
    return c;
  };
  const status = (hex: string) => tintSafe(hex);
  // L'aplat garde la couleur de la marque ; si elle n'est pas lisible en texte, on ajoute accentText.
  const accentTextCandidate = tintSafe(accent, () => accent);
  const accentText = accentTextCandidate !== accent ? accentTextCandidate : undefined;
  if (accentText) notes.push(`Accent trop peu contrasté en texte : accentText = ${accentText} (l'aplat garde ${accent}).`);

  // ── Typographie ──
  const textEls = els.filter((e) => e.font && e.textLen > 0);
  const families = tally(textEls.map((e) => [e.font!, e.textLen] as [string, number]));
  const headingEls = (tag: string) => els.filter((e) => e.tag === tag && e.font);
  const h1 = dominantSpec(headingEls('h1'));
  const h2 = dominantSpec(headingEls('h2'));
  const h3 = dominantSpec(headingEls('h3'));
  const large = textEls.filter((e) => (e.size ?? 0) >= 28);
  const display =
    h1?.font || h2?.font || tally(large.map((e) => [e.font!, e.textLen * (e.size ?? 0)] as [string, number]))[0]?.value || families[0]?.value || 'Inter';
  const bodyCandidates = textEls.filter((e) => (e.size ?? 0) >= 13 && (e.size ?? 0) <= 20 && !isMono(e.font!));
  const bodyText = dominantSpec(bodyCandidates.filter((e) => e.tag === 'p').length ? bodyCandidates.filter((e) => e.tag === 'p') : bodyCandidates);
  const body = bodyText?.font || families[0]?.value || display;
  const mono = families.find((f) => isMono(f.value))?.value;

  const typeScale = tally(textEls.map((e) => [Math.round(e.size ?? 16), e.textLen] as [number, number]));

  // ── Formes ──
  const buttonEls = els.filter((e) => (e.role === 'button' || e.role === 'link') && e.bg && (e.bgAlpha ?? 1) >= 0.9 && e.bg !== base && e.textLen > 0);
  const buttonRadii = tally(buttonEls.map((e) => [Math.round(e.radius ?? 0), 1] as [number, number]));
  const containerEls = els.filter((e) => e.area > 30000 && e.area < raw.viewport.w * raw.viewport.h * 1.5 && ((e.bg && e.bg !== base) || e.border || e.shadow));
  const containerRadii = tally(containerEls.map((e) => [Math.round(e.radius ?? 0), 1] as [number, number]));
  const shadows = tally(
    els.map((e) => (e.shadow ? cleanShadow(e.shadow) : null)).filter((s): s is string => !!s).map((s) => [s, 1] as [string, number]),
  );
  const spacing = tally(
    els.flatMap((e) => [e.padY, e.padX, e.gap].filter((v): v is number => !!v && v <= 160).map((v) => [Math.round(v), 1] as [number, number])),
  );
  const borderWidth = tally(els.filter((e) => e.borderWidth).map((e) => [e.borderWidth!, 1] as [number, number]))[0]?.value ?? 1;

  const buttons = tally(buttonEls.map((e) => [JSON.stringify({ bg: e.bg, color: e.color, radius: e.radius, padY: e.padY, padX: e.padX }), 1] as [string, number]))
    .slice(0, 6)
    .map((b) => ({ ...JSON.parse(b.value), weight: b.weight }));

  // Variables CSS ressemblant à des couleurs : souvent les tokens de la marque.
  const rootColorVars = Object.fromEntries(
    Object.entries(raw.rootVars)
      .filter(([, v]) => /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\(|oklch\(|oklab\(|color\()/i.test(v))
      .slice(0, 60),
  );

  const dataPalette = [accent, accent2Raw, ...chromatic.map((c) => c.value).filter((c) => c !== accentRaw && c !== accent2Raw)]
    .filter((c, i, arr) => arr.findIndex((x) => colorDistance(x, c) < 30) === i)
    .slice(0, 5);
  while (dataPalette.length < 3) dataPalette.push(mixHex(accent, theme === 'light' ? '#FFFFFF' : '#000000', 0.35 * dataPalette.length));

  if (Object.keys(adjusted).length) notes.push(`Contrastes corrigés : ${Object.keys(adjusted).join(', ')}.`);
  if (families.length > 3) notes.push(`${families.length} familles de polices détectées : seules les principales sont retenues.`);
  if (backgrounds.length && backgrounds[0]!.weight < (raw.viewport.w * raw.docHeight) * 0.3) notes.push('Fond de page morcelé (sections de couleurs variées) : vérifier base et surface sur les captures.');

  return {
    url: raw.url,
    title: raw.title,
    theme,
    colors: {
      backgrounds: normalizeWeights(backgrounds),
      text: normalizeWeights(textColors),
      borders: normalizeWeights(borders, 8),
      chromatic: normalizeWeights(chromatic, 8),
    },
    fonts: { families: normalizeWeights(families, 8), display, body, mono, loaded: raw.fonts.slice(0, 30) },
    typeScale: normalizeWeights(typeScale, 12),
    headings: { ...(h1 ? { h1 } : {}), ...(h2 ? { h2 } : {}), ...(h3 ? { h3 } : {}) },
    bodyText,
    radii: { buttons: normalizeWeights(buttonRadii, 5), containers: normalizeWeights(containerRadii, 5) },
    shadows: normalizeWeights(shadows, 5),
    spacing: normalizeWeights(spacing, 12),
    buttons,
    rootColorVars,
    draft: {
      theme,
      tokens: {
        base,
        surface,
        raised,
        line: lineRaw,
        ink,
        muted,
        accent,
        accentInk,
        accent2: accent2Raw,
        ...(accentText ? { accentText } : {}),
        success: status(theme === 'light' ? '#2F7D4F' : '#4CC38A'),
        warning: status(theme === 'light' ? '#95651E' : '#E8C547'),
        danger: status(theme === 'light' ? '#B4402F' : '#EF6461'),
      },
      dataPalette,
      fonts: { display, body, mono: mono ?? 'JetBrains Mono' },
      shape: {
        radius: remFromPx(buttonRadii[0]?.value ?? 6),
        radiusLarge: remFromPx(containerRadii.find((r) => r.value > 0)?.value ?? containerRadii[0]?.value ?? 12),
        borderWidth: `${borderWidth}px`,
      },
      elevation: { card: shadows[0]?.value ?? 'none', overlay: shadows[1]?.value ?? shadows[0]?.value ?? 'none' },
      adjusted,
    },
    notes,
  };
}

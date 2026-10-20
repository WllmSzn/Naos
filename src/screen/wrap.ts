import type { Dna } from '../dna/schema.js';
import { googleFontsUrl } from '../dna/library.js';
import { DnaOverridesSchema, hasOverrides, type DnaOverrides } from '../dna/overrides.js';

/**
 * Enveloppe déterministe d'un écran.
 *
 * Tout le style vit dans le <head> (config Tailwind générée depuis la DNA) ;
 * le corps n'utilise que des classes sémantiques. Changer de DNA revient donc
 * à régénérer le <head> : c'est ce que fait retheme.
 */

export const LIBS = ['alpine', 'chartjs'] as const;
export type Lib = (typeof LIBS)[number];

// Versions figées : une page générée doit rendre pareil dans six mois.
const CDN = {
  tailwind: 'https://cdn.tailwindcss.com/3.4.17',
  iconify: 'https://code.iconify.design/iconify-icon/2.3.0/iconify-icon.min.js',
  alpine: 'https://cdn.jsdelivr.net/npm/alpinejs@3.14.9/dist/cdn.min.js',
  chartjs: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.9/dist/chart.umd.min.js',
} as const;

export const BODY_START = '<!-- naos:body:start -->';
export const BODY_END = '<!-- naos:body:end -->';
// Pages produites avant le renommage du projet (Hecate → Naos, 2026-10-20) : toujours relues.
const LEGACY_BODY_START = '<!-- hecate:body:start -->';
const LEGACY_BODY_END = '<!-- hecate:body:end -->';

export interface WrapOptions {
  title?: string;
  lang?: string;
  libs?: readonly Lib[];
  /** Surcharges déjà appliquées à la DNA passée ; mémorisées pour les retheme suivants. */
  overrides?: DnaOverrides;
  /** Mode de conception (website, product-desktop…) : fournit les dimensions sémantiques. */
  mode?: string;
}

// Valeurs neutres des dimensions sémantiques quand la DNA n'en fournit pas pour le mode.
const DEFAULT_SIZES = { control: '2.5rem', controlSm: '2rem', row: '2.75rem', sidebar: '15rem', header: '3.5rem', icon: '1rem' };

/** Dimensions sémantiques du mode → échelle d'espacement Tailwind (h-ctl, w-sidebar, size-icon…). */
function sizeScale(dna: Dna, mode?: string) {
  const s = { ...DEFAULT_SIZES, ...(mode ? dna.modes[mode]?.sizes : undefined) };
  return { ctl: s.control, 'ctl-sm': s.controlSm, row: s.row, sidebar: s.sidebar, header: s.header, icon: s.icon };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function unescapeHtml(s: string): string {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
}

/**
 * Configuration Tailwind générée depuis la DNA.
 * « base » n'est pas une couleur globale : text-base est déjà la taille de police
 * par défaut de Tailwind. Le texte posé sur bg-ink utilise donc text-inverse.
 */
export function tailwindConfig(dna: Dna, mode?: string) {
  const t = dna.tokens;
  return {
    theme: {
      extend: {
        colors: {
          surface: t.surface,
          raised: t.raised,
          line: t.line,
          ink: t.ink,
          muted: t.muted,
          accent: t.accent,
          'accent-ink': t.accentInk,
          accent2: t.accent2,
          success: t.success,
          warning: t.warning,
          danger: t.danger,
          inverse: t.base,
          ...dna.extraColors,
        },
        backgroundColor: { base: t.base },
        // text-accent peut différer de l'aplat bg-accent (accent sombre illisible en texte sur fond sombre).
        textColor: { accent: t.accentText ?? t.accent },
        gradientColorStops: { base: t.base },
        fontFamily: {
          display: [dna.fonts.display, 'ui-sans-serif', 'system-ui', 'sans-serif'],
          body: [dna.fonts.body, 'ui-sans-serif', 'system-ui', 'sans-serif'],
          mono: [dna.fonts.mono, 'ui-monospace', 'monospace'],
          // Sans police d'accent, font-accent retombe sur la police de titre.
          accent: [dna.fonts.accent ?? dna.fonts.display, 'ui-serif', 'Georgia', 'serif'],
        },
        borderRadius: { ui: dna.shape.radius, card: dna.shape.radiusLarge },
        boxShadow: { card: dna.elevation.card, overlay: dna.elevation.overlay },
        borderWidth: { DEFAULT: dna.shape.borderWidth },
        spacing: sizeScale(dna, mode),
      },
    },
  };
}

/** Données exposées à la page (graphiques, scripts) sous window.NAOS. */
function runtimeData(dna: Dna) {
  return {
    dna: dna.id,
    tokens: dna.tokens,
    dataPalette: dna.dataPalette,
    extraColors: dna.extraColors ?? {},
    fonts: { display: dna.fonts.display, body: dna.fonts.body, mono: dna.fonts.mono, accent: dna.fonts.accent ?? dna.fonts.display },
  };
}

export function buildHead(dna: Dna, opts: WrapOptions = {}): string {
  const libs = [...new Set(opts.libs ?? [])].filter((l): l is Lib => LIBS.includes(l));
  const lines = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(opts.title ?? dna.name)}</title>`,
    '<meta name="generator" content="naos">',
    `<meta name="naos-dna" content="${dna.id}">`,
    ...(opts.mode ? [`<meta name="naos-mode" content="${escapeHtml(opts.mode)}">`] : []),
    `<meta name="naos-libs" content="${libs.join(',')}">`,
    ...(hasOverrides(opts.overrides) ? [`<meta name="naos-overrides" content="${escapeHtml(JSON.stringify(opts.overrides))}">`] : []),
    ...(googleFontsUrl(dna)
      ? [
          '<link rel="preconnect" href="https://fonts.googleapis.com">',
          '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
          `<link rel="stylesheet" href="${googleFontsUrl(dna)}">`,
        ]
      : []),
    `<script src="${CDN.tailwind}"></script>`,
    `<script>tailwind.config = ${JSON.stringify(tailwindConfig(dna, opts.mode))};</script>`,
    // window.HECATE : alias pour les graphiques des pages produites avant le renommage.
    `<script>window.NAOS = ${JSON.stringify(runtimeData(dna))}; window.HECATE = window.NAOS;</script>`,
    `<script src="${CDN.iconify}"></script>`,
  ];
  if (libs.includes('chartjs')) {
    lines.push(`<script src="${CDN.chartjs}"></script>`);
    // Les graphiques héritent de la DNA sans aucun hex en dur dans le corps.
    lines.push(
      '<script>Chart.defaults.color = NAOS.tokens.muted; Chart.defaults.borderColor = NAOS.tokens.line; ' +
        'Chart.defaults.font.family = NAOS.fonts.body;</script>',
    );
  }
  if (libs.includes('alpine')) lines.push(`<script defer src="${CDN.alpine}"></script>`);
  const t = dna.tokens;
  lines.push(
    `<style>:root{color-scheme:${dna.theme};--naos-raised:${t.raised};--naos-line:${t.line};--naos-muted:${t.muted};--naos-surface:${t.surface}}[x-cloak]{display:none!important}` +
      (dna.rootFontSize ? `html{font-size:${dna.rootFontSize}}` : '') +
      // Emplacement d'image décrit : hachures aux couleurs de la DNA, description en légende.
      '[data-image]{position:relative;overflow:hidden;background-color:var(--naos-raised);' +
      'background-image:repeating-linear-gradient(135deg,transparent 0 14px,var(--naos-line) 14px 15px);min-height:8rem}' +
      '[data-image]:not(img)::after{content:attr(data-image);position:absolute;left:1rem;top:1rem;max-width:calc(100% - 2rem);' +
      'padding:.35rem .6rem;border-radius:.375rem;background:var(--naos-surface);color:var(--naos-muted);' +
      'font:500 12px/1.4 ui-monospace,monospace;letter-spacing:.01em}' +
      `h1,h2,h3,h4{font-family:"${dna.fonts.display}",ui-sans-serif,system-ui,sans-serif}` +
      (dna.headings
        ? `h1,h2,h3{font-weight:${dna.headings.weight};letter-spacing:${dna.headings.tracking};line-height:${dna.headings.leading}}`
        : '') +
      'iconify-icon{display:inline-block;width:1em;height:1em;vertical-align:-0.125em}</style>',
  );
  return lines.map((l) => `  ${l}`).join('\n');
}

/** Extrait le corps d'un écran : marqueurs Naos, sinon <body>, sinon le fragment tel quel. */
export function extractBody(html: string): string {
  for (const [open, close] of [[BODY_START, BODY_END], [LEGACY_BODY_START, LEGACY_BODY_END]] as const) {
    const s = html.indexOf(open);
    const e = html.indexOf(close);
    if (s !== -1 && e > s) return html.slice(s + open.length, e).trim();
  }
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (body?.[1] !== undefined) return body[1].trim();
  return html
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<\/?(?:html|body)[^>]*>/gi, '')
    .trim();
}

export interface ScreenMeta {
  dnaId?: string;
  mode?: string;
  libs: Lib[];
  title?: string;
  lang?: string;
  overrides?: DnaOverrides;
}

/** Relit les métadonnées laissées par wrapScreen dans un document. */
export function readMeta(html: string): ScreenMeta {
  // « naos-x », ou « hecate-x » pour une page produite avant le renommage.
  const meta = (name: string) =>
    html.match(new RegExp(`<meta name="(?:${name}|${name.replace(/^naos-/, 'hecate-')})" content="([^"]*)"`, 'i'))?.[1];
  const libs = (meta('naos-libs') ?? '').split(',').filter((l): l is Lib => (LIBS as readonly string[]).includes(l));
  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1];
  const lang = html.match(/<html[^>]*\blang="([^"]+)"/i)?.[1];

  let overrides: DnaOverrides | undefined;
  const rawOverrides = meta('naos-overrides');
  if (rawOverrides) {
    try {
      const parsed = DnaOverridesSchema.safeParse(JSON.parse(unescapeHtml(rawOverrides)));
      if (parsed.success) overrides = parsed.data;
    } catch {
      // Méta corrompue : on l'ignore plutôt que de bloquer le retheme.
    }
  }

  return { dnaId: meta('naos-dna'), mode: meta('naos-mode'), libs, title: title ? unescapeHtml(title) : undefined, lang, overrides };
}

export function wrapScreen(body: string, dna: Dna, opts: WrapOptions = {}): string {
  return [
    '<!DOCTYPE html>',
    `<html lang="${escapeHtml(opts.lang ?? 'fr')}">`,
    '<head>',
    buildHead(dna, opts),
    '</head>',
    '<body class="min-h-screen bg-base text-ink font-body antialiased">',
    BODY_START,
    extractBody(body),
    BODY_END,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

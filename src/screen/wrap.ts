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

export const BODY_START = '<!-- hecate:body:start -->';
export const BODY_END = '<!-- hecate:body:end -->';

export interface WrapOptions {
  title?: string;
  lang?: string;
  libs?: readonly Lib[];
  /** Surcharges déjà appliquées à la DNA passée ; mémorisées pour les retheme suivants. */
  overrides?: DnaOverrides;
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
export function tailwindConfig(dna: Dna) {
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
      },
    },
  };
}

/** Données exposées à la page (graphiques, scripts) sous window.HECATE. */
function runtimeData(dna: Dna) {
  return {
    dna: dna.id,
    tokens: dna.tokens,
    dataPalette: dna.dataPalette,
    fonts: { display: dna.fonts.display, body: dna.fonts.body, mono: dna.fonts.mono, accent: dna.fonts.accent ?? dna.fonts.display },
  };
}

export function buildHead(dna: Dna, opts: WrapOptions = {}): string {
  const libs = [...new Set(opts.libs ?? [])].filter((l): l is Lib => LIBS.includes(l));
  const lines = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(opts.title ?? dna.name)}</title>`,
    '<meta name="generator" content="hecate">',
    `<meta name="hecate-dna" content="${dna.id}">`,
    `<meta name="hecate-libs" content="${libs.join(',')}">`,
    ...(hasOverrides(opts.overrides) ? [`<meta name="hecate-overrides" content="${escapeHtml(JSON.stringify(opts.overrides))}">`] : []),
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    `<link rel="stylesheet" href="${googleFontsUrl(dna)}">`,
    `<script src="${CDN.tailwind}"></script>`,
    `<script>tailwind.config = ${JSON.stringify(tailwindConfig(dna))};</script>`,
    `<script>window.HECATE = ${JSON.stringify(runtimeData(dna))};</script>`,
    `<script src="${CDN.iconify}"></script>`,
  ];
  if (libs.includes('chartjs')) {
    lines.push(`<script src="${CDN.chartjs}"></script>`);
    // Les graphiques héritent de la DNA sans aucun hex en dur dans le corps.
    lines.push(
      '<script>Chart.defaults.color = HECATE.tokens.muted; Chart.defaults.borderColor = HECATE.tokens.line; ' +
        'Chart.defaults.font.family = HECATE.fonts.body;</script>',
    );
  }
  if (libs.includes('alpine')) lines.push(`<script defer src="${CDN.alpine}"></script>`);
  const t = dna.tokens;
  lines.push(
    `<style>:root{color-scheme:${dna.theme};--hc-raised:${t.raised};--hc-line:${t.line};--hc-muted:${t.muted};--hc-surface:${t.surface}}[x-cloak]{display:none!important}` +
      // Emplacement d'image décrit : hachures aux couleurs de la DNA, description en légende.
      '[data-image]{position:relative;overflow:hidden;background-color:var(--hc-raised);' +
      'background-image:repeating-linear-gradient(135deg,transparent 0 14px,var(--hc-line) 14px 15px);min-height:8rem}' +
      '[data-image]:not(img)::after{content:attr(data-image);position:absolute;left:1rem;top:1rem;max-width:calc(100% - 2rem);' +
      'padding:.35rem .6rem;border-radius:.375rem;background:var(--hc-surface);color:var(--hc-muted);' +
      'font:500 12px/1.4 ui-monospace,monospace;letter-spacing:.01em}' +
      `h1,h2,h3,h4{font-family:"${dna.fonts.display}",ui-sans-serif,system-ui,sans-serif}` +
      (dna.headings
        ? `h1,h2,h3{font-weight:${dna.headings.weight};letter-spacing:${dna.headings.tracking};line-height:${dna.headings.leading}}`
        : '') +
      'iconify-icon{display:inline-block;width:1em;height:1em;vertical-align:-0.125em}</style>',
  );
  return lines.map((l) => `  ${l}`).join('\n');
}

/** Extrait le corps d'un écran : marqueurs Hecate, sinon <body>, sinon le fragment tel quel. */
export function extractBody(html: string): string {
  const start = html.indexOf(BODY_START);
  const end = html.indexOf(BODY_END);
  if (start !== -1 && end > start) return html.slice(start + BODY_START.length, end).trim();
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
  libs: Lib[];
  title?: string;
  lang?: string;
  overrides?: DnaOverrides;
}

/** Relit les métadonnées laissées par wrapScreen dans un document. */
export function readMeta(html: string): ScreenMeta {
  const meta = (name: string) => html.match(new RegExp(`<meta name="${name}" content="([^"]*)"`, 'i'))?.[1];
  const libs = (meta('hecate-libs') ?? '').split(',').filter((l): l is Lib => (LIBS as readonly string[]).includes(l));
  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1];
  const lang = html.match(/<html[^>]*\blang="([^"]+)"/i)?.[1];

  let overrides: DnaOverrides | undefined;
  const rawOverrides = meta('hecate-overrides');
  if (rawOverrides) {
    try {
      const parsed = DnaOverridesSchema.safeParse(JSON.parse(unescapeHtml(rawOverrides)));
      if (parsed.success) overrides = parsed.data;
    } catch {
      // Méta corrompue : on l'ignore plutôt que de bloquer le retheme.
    }
  }

  return { dnaId: meta('hecate-dna'), libs, title: title ? unescapeHtml(title) : undefined, lang, overrides };
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

import type { Dna } from '../dna/schema.js';
import { googleFontsUrl } from '../dna/library.js';
import { DnaOverridesSchema, hasOverrides, type DnaOverrides } from '../dna/overrides.js';
import { getMode } from '../modes/modes.js';
import {
  resolveRoles,
  roleRuntimeData,
  roleThemeConfig,
  type ResolvedRoles,
  type RoleGroup,
  type RoleThemeFragments,
} from '../dna/roles.js';

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

/**
 * Échelle typographique du mode → classes text-display, text-title, text-subtitle,
 * text-body, text-caption. L'interlignage est inclus dans la classe : un grand titre
 * se sert, un texte courant respire, et le corps n'a pas à choisir leading-*.
 * Aucune échelle quand la DNA n'en déclare pas pour le mode (les tailles Tailwind restent).
 */
const TYPE_LEADING: Record<string, string> = { display: '1.02', title: '1.1', subtitle: '1.28', body: '1.4', caption: '1.4' };

function typeScale(dna: Dna, mode?: string) {
  const scale = mode ? dna.modes[mode]?.typeScale : undefined;
  if (!scale || !Object.keys(scale).length) return undefined;
  return Object.fromEntries(
    Object.entries(scale).map(([role, size]) => [role, [size, { lineHeight: TYPE_LEADING[role] ?? '1.4' }]]),
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function unescapeHtml(s: string): string {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
}

/**
 * Rôles visuels exposés par le mode (mode.json → dnaRoles). Aucun id de mode en dur :
 * un mode qui ne déclare rien n'expose aucun rôle.
 */
export function modeRoleGroups(mode?: string): RoleGroup[] {
  return mode ? (getMode(mode)?.dnaRoles ?? []) : [];
}

/**
 * Configuration Tailwind générée depuis la DNA.
 * « base » n'est pas une couleur globale : text-base est déjà la taille de police
 * par défaut de Tailwind. Le texte posé sur bg-ink utilise donc text-inverse.
 */
export function tailwindConfig(dna: Dna, mode?: string) {
  const t = dna.tokens;
  const scale = typeScale(dna, mode);
  const roles: RoleThemeFragments = roleThemeConfig(resolveRoles(dna, mode), modeRoleGroups(mode));
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
          ...roles.colors,
        },
        backgroundColor: { base: t.base, ...roles.backgroundColor },
        // text-accent peut différer de l'aplat bg-accent (accent sombre illisible en texte sur fond sombre).
        textColor: { accent: t.accentText ?? t.accent, ...roles.textColor },
        borderColor: roles.borderColor,
        gradientColorStops: { base: t.base },
        backgroundImage: roles.backgroundImage,
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
        ...(scale ? { fontSize: scale } : {}),
      },
    },
  };
}

/** Données exposées à la page (graphiques, scripts) sous window.NAOS. */
function runtimeData(dna: Dna, mode?: string, roles?: ResolvedRoles) {
  return {
    dna: dna.id,
    tokens: dna.tokens,
    dataPalette: dna.dataPalette,
    extraColors: dna.extraColors ?? {},
    fonts: { display: dna.fonts.display, body: dna.fonts.body, mono: dna.fonts.mono, accent: dna.fonts.accent ?? dna.fonts.display },
    ...(roles ? { roles: roleRuntimeData(roles, modeRoleGroups(mode)) } : {}),
  };
}

/**
 * Runtime « slides » : chaîne JS autonome, sans dépendance ni appel réseau.
 * Chaque [data-slide] est affichée seule, mise à l'échelle de la fenêtre en gardant
 * le 16:9 défini par sa hauteur, avec flèches et espace pour naviguer, F pour le plein
 * écran, et un compteur discret.
 *
 * Deux garde-fous : le drapeau __NAOS_NO_RUNTIME__ posé par preview_screen, et
 * navigator.webdriver, pour qu'un rendu headless conservé dans un fichier (ou rejoué
 * sans le drapeau) empile toujours les diapos et reste mesurable.
 */
export const SLIDES_RUNTIME = `/* naos:slides */
(() => {
  if (window.__NAOS_NO_RUNTIME__ || navigator.webdriver) return;

  // Le script vit dans le <head> : au moment où il s'exécute, les diapos du <body>
  // ne sont pas encore analysées. On attend donc DOMContentLoaded.
  const boot = () => {
    const slides = Array.from(document.querySelectorAll('[data-slide]'));
    if (!slides.length) return;

    // La hauteur d'une diapo est fixée par le mode (1080px) ; la largeur s'en déduit en 16:9.
    // On fige cette largeur avant de positionner, sinon la mise en page se reflowe à la fenêtre.
    const H = Math.round(slides[0].getBoundingClientRect().height) || 1080;
    const W = Math.round((H * 16) / 9);
    let index = 0;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';
    document.body.style.height = '100vh';

    for (const s of slides) {
      s.style.position = 'fixed';
      s.style.left = '0';
      s.style.top = '0';
      s.style.margin = '0';
      s.style.width = W + 'px';
      s.style.height = H + 'px';
      s.style.transformOrigin = '0 0';
    }

    const counter = document.createElement('div');
    counter.setAttribute('aria-live', 'polite');
    counter.style.cssText =
      'position:fixed;right:20px;bottom:16px;z-index:50;pointer-events:none;' +
      'padding:4px 10px;border-radius:9999px;background:var(--naos-surface);color:var(--naos-muted);' +
      'font:500 13px/1.4 ui-monospace,monospace;letter-spacing:.04em;font-variant-numeric:tabular-nums';
    document.body.appendChild(counter);

    const show = (next) => {
      index = Math.max(0, Math.min(slides.length - 1, next));
      const k = Math.min(window.innerWidth / W, window.innerHeight / H);
      const x = (window.innerWidth - W * k) / 2;
      const y = (window.innerHeight - H * k) / 2;
      slides.forEach((s, n) => {
        s.style.display = n === index ? '' : 'none';
        s.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + k + ')';
      });
      counter.textContent = index + 1 + ' / ' + slides.length;
    };

    const toggleFullscreen = () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else document.documentElement.requestFullscreen().catch(() => {});
    };

    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Spacebar'].includes(e.key)) { e.preventDefault(); show(index + 1); }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); show(index - 1); }
      else if (e.key === 'Home') { e.preventDefault(); show(0); }
      else if (e.key === 'End') { e.preventDefault(); show(slides.length - 1); }
      else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); toggleFullscreen(); }
    });

    window.addEventListener('resize', () => show(index));
    show(0);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();`;

/** Runtime demandé par le mode (wrap.runtime), sinon aucun. */
function modeRuntime(mode?: string): 'none' | 'slides' {
  return (mode ? getMode(mode)?.wrap?.runtime : undefined) ?? 'none';
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
    `<script>window.NAOS = ${JSON.stringify(runtimeData(dna, opts.mode, resolveRoles(dna, opts.mode)))}; window.HECATE = window.NAOS;</script>`,
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
  if (modeRuntime(opts.mode) === 'slides') lines.push(`<script>${SLIDES_RUNTIME}</script>`);
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

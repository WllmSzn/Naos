import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import { extractBody } from './wrap.js';
import type { ColorAllowance } from '../dna/roles.js';

/**
 * Lint déterministe d'un écran : zéro appel LLM.
 * Corrige ce qui a une seule bonne réponse, signale le reste pour une réparation ciblée.
 */

export type Severity = 'error' | 'warning';
export type Theme = 'light' | 'dark';

export interface Violation {
  rule: string;
  severity: Severity;
  message: string;
  count: number;
  samples: string[];
}

export interface Fix {
  rule: string;
  count: number;
  samples: string[];
}

export interface LintReport {
  html: string;
  fixes: Fix[];
  violations: Violation[];
  errorCount: number;
  warningCount: number;
  needsRepair: boolean;
}

export interface LintOptions {
  /** Thème de la DNA : active la conversion des gris Tailwind vers les tokens. */
  theme?: Theme;
  /** false : rapport seul, le HTML est renvoyé tel quel. */
  autofix?: boolean;
  /** Profil du mode : ce qui relève d'un site (formules marketing) n'est pas exigé d'un écran produit. */
  profile?: LintProfile;
  /**
   * Noms de couleur de la DNA visée. Fourni avec dna_id : une classe de couleur qui
   * n'existe ni comme token, ni comme extraColor, ni comme rôle est une erreur au lieu
   * de rester silencieusement sans effet (le défaut du retheme avant les rôles).
   */
  colors?: ColorAllowance;
}

export interface LintProfile {
  bannedWords: boolean;
  genericCta: string[];
  requireH1: boolean;
  /** Le mode attend des notes orateur sur la plupart des diapos (data-notes). */
  notes?: boolean;
  /**
   * Fragment (bloc) et non écran : pas de titre principal, pas de cadre de diapo,
   * pas de texte sous l'échelle de légende. Le titre appartient à la section hôte.
   */
  fragment?: boolean;
}

/** Profil par défaut (mode site web), utilisé quand aucun mode n'est connu. */
export const DEFAULT_LINT_PROFILE: LintProfile = {
  bannedWords: true,
  genericCta: ['ok', 'valider', 'envoyer', 'submit', 'click here', 'cliquez ici', 'ici', 'here', 'go', 'lien', 'link'],
  requireH1: true,
};

// ── Collecte ───────────────────────────────────────────────────────────────

const MAX_SAMPLES = 5;

class Collector {
  private violations = new Map<string, Violation>();
  private fixes = new Map<string, Fix>();

  violation(rule: string, severity: Severity, message: string, sample?: string) {
    const v = this.violations.get(rule) ?? { rule, severity, message, count: 0, samples: [] };
    v.count++;
    if (sample && v.samples.length < MAX_SAMPLES && !v.samples.includes(sample)) v.samples.push(sample);
    this.violations.set(rule, v);
  }

  fix(rule: string, sample?: string) {
    const f = this.fixes.get(rule) ?? { rule, count: 0, samples: [] };
    f.count++;
    if (sample && f.samples.length < MAX_SAMPLES && !f.samples.includes(sample)) f.samples.push(sample);
    this.fixes.set(rule, f);
  }

  report(html: string): LintReport {
    const violations = [...this.violations.values()].sort((a, b) =>
      a.severity === b.severity ? a.rule.localeCompare(b.rule) : a.severity === 'error' ? -1 : 1,
    );
    const errorCount = violations.filter((v) => v.severity === 'error').reduce((n, v) => n + v.count, 0);
    const warningCount = violations.filter((v) => v.severity === 'warning').reduce((n, v) => n + v.count, 0);
    return { html, fixes: [...this.fixes.values()], violations, errorCount, warningCount, needsRepair: errorCount > 0 };
  }
}

function snippet(s: string, max = 80): string {
  const flat = s.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function normalizeText(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// ── Classes ────────────────────────────────────────────────────────────────

const NEUTRALS = 'slate|gray|zinc|neutral|stone';
const CHROMATIC = 'red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const COLOR_UTIL = 'bg|text|border(?:-[xytrblse])?|ring-offset|ring|outline|divide|from|via|to|fill|stroke|decoration|placeholder|caret|accent|shadow';

const NAMED_RE = new RegExp(`^(${COLOR_UTIL})-(${NEUTRALS}|${CHROMATIC})-(\\d{2,3})(\\/\\S+)?$`);
const BW_RE = new RegExp(`^(${COLOR_UTIL})-(white|black)(\\/\\S+)?$`);
const ARBITRARY_COLOR_RE = new RegExp(`^(${COLOR_UTIL})-\\[(?:#|rgb|hsl|oklch|oklab|color\\()`);
const RADIUS_RE = /^rounded(-(?:[trblse]|tl|tr|bl|br|ss|se|es|ee))?(?:-(sm|md|lg|xl|2xl|3xl))?$/;
const SHADOW_RE = /^shadow(?:-(sm|md|lg|xl|2xl))?$/;
const NEUTRAL_SET = new Set(NEUTRALS.split('|'));

// Canaux porteurs d'un nom de couleur (token, extraColor ou rôle).
const COLOR_NAME_RE = /^(bg|text|border(?:-[xytrblse])?|from|via|to|fill|stroke|ring|outline|divide|placeholder|caret|accent|decoration)-([a-z][a-z0-9-]*)$/;

/**
 * Mots d'une classe qui ressemblent à un nom de couleur mais sont des utilitaires.
 * Sans cette liste, le contrôle color.unknown signalerait bg-cover ou text-center.
 */
const NON_COLOR_NAMES = new Set([
  'none', 'auto', 'full', 'current', 'transparent', 'inherit', 'inset', 'offset', 'shadow',
  'cover', 'contain', 'center', 'top', 'bottom', 'left', 'right', 'start', 'end', 'x', 'y', 's', 'e', 't', 'r', 'b', 'l',
  'fixed', 'local', 'scroll', 'repeat', 'no-repeat', 'repeat-x', 'repeat-y', 'repeat-round', 'repeat-space',
  'solid', 'dashed', 'dotted', 'double', 'hidden', 'collapse', 'separate',
  'clip', 'ellipsis', 'wrap', 'nowrap', 'balance', 'pretty', 'justify',
  'xs', 'sm', 'base', 'lg', 'xl',
]);
const NON_COLOR_PREFIXES = ['gradient', 'blend', 'clip-', 'origin-'];

function unknownColorName(core: string, colors: ColorAllowance): string | null {
  const bare = core.split('/')[0]!;
  const m = bare.match(COLOR_NAME_RE);
  if (!m) return null;
  const [, util, name] = m as unknown as [string, string, string];
  if (colors.names.has(name)) return null;
  if (util === 'text' && colors.textSizes.has(name)) return null;
  if (NON_COLOR_NAMES.has(name)) return null;
  if (NON_COLOR_PREFIXES.some((p) => name.startsWith(p))) return null;
  // Positions et échelles : ring-offset-2, from-50, border-2 (déjà exclu).
  if (/\d$/.test(name)) return null;
  return name;
}

/** Sépare « md:hover:!bg-gray-100 » en préfixe de variantes, « ! » et cœur. */
function splitClass(token: string): { prefix: string; bang: string; core: string } {
  let depth = 0;
  let cut = -1;
  for (let i = 0; i < token.length; i++) {
    const c = token[i];
    if (c === '[') depth++;
    else if (c === ']') depth--;
    else if (c === ':' && depth === 0) cut = i;
  }
  const prefix = token.slice(0, cut + 1);
  let core = token.slice(cut + 1);
  let bang = '';
  if (core.startsWith('!')) {
    bang = '!';
    core = core.slice(1);
  }
  return { prefix, bang, core };
}

type Kind = 'text' | 'bg' | 'border' | 'other';

function kindOf(util: string): Kind {
  if (util === 'text') return 'text';
  if (util === 'bg') return 'bg';
  if (/^(border|divide|ring|outline)/.test(util) && util !== 'ring-offset') return 'border';
  return 'other';
}

function borderToken(util: string): string {
  return `${util}-line`;
}

/** Gris Tailwind → token, selon le thème. null = pas de correspondance sûre. */
function mapNeutral(util: string, shade: number, theme: Theme | undefined): string | null {
  if (!theme) return null;
  const kind = kindOf(util);
  if (theme === 'light') {
    if (kind === 'text') return shade >= 700 ? 'text-ink' : shade >= 400 ? 'text-muted' : null;
    if (kind === 'bg') return shade <= 200 ? 'bg-raised' : shade >= 900 ? 'bg-ink' : null;
    if (kind === 'border') return shade >= 100 && shade <= 300 ? borderToken(util) : null;
  } else {
    if (kind === 'text') return shade <= 200 ? 'text-ink' : shade <= 500 ? 'text-muted' : null;
    if (kind === 'bg') return shade >= 950 ? 'bg-base' : shade >= 900 ? 'bg-surface' : shade >= 800 ? 'bg-raised' : null;
    if (kind === 'border') return shade >= 600 && shade <= 800 ? borderToken(util) : null;
  }
  return null;
}

/** Blanc / noir → token. Le texte blanc dépend du fond de l'élément. */
function mapBlackWhite(util: string, color: 'white' | 'black', theme: Theme | undefined, siblings: string[]): string | null {
  const kind = kindOf(util);
  const has = (c: string) => siblings.some((s) => splitClass(s).core.split('/')[0] === c);
  if (kind === 'text' && color === 'white') {
    if (has('bg-accent')) return 'text-accent-ink';
    if (has('bg-ink')) return 'text-inverse';
    return theme === 'dark' ? 'text-ink' : null;
  }
  if (theme === 'dark') {
    if (kind === 'bg' && color === 'black') return 'bg-base';
    return null;
  }
  if (kind === 'bg') return color === 'white' ? 'bg-surface' : 'bg-ink';
  if (kind === 'text' && color === 'black') return 'text-ink';
  if (kind === 'border' && color === 'black') return `${util}-ink`;
  return null;
}

function lintClasses($: cheerio.CheerioAPI, out: Collector, opts: Required<Pick<LintOptions, 'autofix'>> & LintOptions) {
  $('[class]').each((_, el) => {
    const original = ($(el).attr('class') ?? '').split(/\s+/).filter(Boolean);
    const next: string[] = [];
    let changed = false;

    for (const token of original) {
      const { prefix, bang, core } = splitClass(token);
      let replacement: string | null = null;

      const named = core.match(NAMED_RE);
      const bw = core.match(BW_RE);
      if (named) {
        const [, util, family, shade, alpha = ''] = named as unknown as [string, string, string, string, string?];
        const mapped = NEUTRAL_SET.has(family) ? mapNeutral(util, Number(shade), opts.theme) : null;
        if (mapped) replacement = mapped + alpha;
        else
          out.violation(
            'tokens.named-color',
            'error',
            'Couleur Tailwind nommée : utiliser un token sémantique (bg-surface, text-muted, border-line, bg-accent…).',
            token,
          );
      } else if (bw) {
        const [, util, color, alpha = ''] = bw as unknown as [string, string, 'white' | 'black', string?];
        const mapped = mapBlackWhite(util, color, opts.theme, original);
        if (mapped) replacement = mapped + alpha;
        else out.violation('tokens.named-color', 'error', 'Couleur Tailwind nommée : utiliser un token sémantique.', token);
      } else if (ARBITRARY_COLOR_RE.test(core)) {
        out.violation('tokens.arbitrary-color', 'error', 'Couleur en dur dans une classe arbitraire : utiliser un token.', token);
      } else if (RADIUS_RE.test(core)) {
        const [, side = '', size] = core.match(RADIUS_RE) as unknown as [string, string?, string?];
        replacement = `rounded${side}-${size && ['xl', '2xl', '3xl'].includes(size) ? 'card' : 'ui'}`;
      } else if (SHADOW_RE.test(core)) {
        const size = core.match(SHADOW_RE)?.[1];
        replacement = size && ['lg', 'xl', '2xl'].includes(size) ? 'shadow-overlay' : 'shadow-card';
      } else if (core === 'font-sans') {
        replacement = 'font-body';
      } else if (core === 'font-serif') {
        replacement = 'font-display';
      } else if (/^font-\[/.test(core)) {
        out.violation('tokens.font-family', 'warning', 'Police nommée : utiliser font-display, font-body ou font-mono.', token);
      } else if (/^shadow-\[/.test(core)) {
        out.violation('tokens.shadow', 'warning', 'Ombre arbitraire : utiliser shadow-card ou shadow-overlay.', token);
      } else if (opts.colors) {
        const unknown = unknownColorName(core, opts.colors);
        if (unknown) {
          out.violation(
            'color.unknown',
            'error',
            `Couleur absente de la DNA : « ${unknown} » n’est ni un token, ni un rôle, ni une couleur métier de cette DNA. ` +
              'Utiliser un token sémantique ou un rôle (bg-alt, bg-highlight, border-emphasis, text-connector, bg-brand).',
            token,
          );
        }
      }

      if (replacement && opts.autofix) {
        const rule = /^rounded/.test(replacement) ? 'tokens.radius' : /^shadow/.test(replacement) ? 'tokens.shadow' : /^font/.test(replacement) ? 'tokens.font' : 'tokens.color';
        out.fix(rule, `${token} → ${prefix}${bang}${replacement}`);
        next.push(`${prefix}${bang}${replacement}`);
        changed = true;
      } else {
        if (replacement) out.violation('tokens.fixable', 'warning', 'Classe convertible en token (relancer avec autofix).', token);
        next.push(token);
      }
    }

    if (changed) $(el).attr('class', [...new Set(next)].join(' '));

    // rounded-ui est le rayon des contrôles : une DNA à boutons pilule en fait un ovale sur un conteneur.
    const isContainer = $(el).is('[data-image], img, section, figure, article') || original.some((t) => /^(?:aspect-|min-h-\[|h-(?:4[0-9]|[5-9][0-9]))/.test(splitClass(t).core));
    if (isContainer && original.some((t) => splitClass(t).core === 'rounded-ui')) {
      out.violation('tokens.radius-role', 'warning', 'rounded-ui est réservé aux contrôles (boutons, champs, pastilles) : utiliser rounded-card sur un conteneur ou une image.', snippet(original.join(' ')));
    }

    // Halo flou décoratif : le cliché des pages générées.
    const cls = new Set(original.map((t) => splitClass(t).core));
    if (cls.has('rounded-full') && cls.has('absolute') && [...cls].some((c) => /^blur-(2xl|3xl|\[)/.test(c))) {
      out.violation('slop.blur-orb', 'warning', 'Halo flou décoratif en arrière-plan : à retirer sauf si la DNA le prévoit.', snippet(original.join(' ')));
    }
  });
}

// ── Contenu ────────────────────────────────────────────────────────────────

// Signes typographiques tolérés malgré leur statut d'emoji Unicode.
const KEEP_SYMBOLS = new Set(['©', '®', '™', '✓', '✔', '★', '☆', '↗', '↘', '→', '←', '↑', '↓', '●', '○', '◆', '▲', '▼', '⌘', '⌥', '⇧', '⏎']);
const EMOJI_RE = /(?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:\u{FE0F}|[\u{1F3FB}-\u{1F3FF}])?(?:‍\p{Extended_Pictographic}\u{FE0F}?)*/gu;

const PLACEHOLDER_RE = /lorem ipsum|dolor sit amet|\b(?:titre|texte|contenu|title|text|content|image) ici\b|\byour (?:text|title|content|company|logo) here\b|\[ins[ée]rer[^\]]*\]|\[(?:placeholder|todo|tbd)[^\]]*\]|\bTODO\b/i;

const BANNED_WORDS = [
  'revolutionner', 'revolutionnaire', 'sublimer', 'booster', 'sans effort', 'next level', 'next-level',
  'game changer', 'game-changer', 'debloquez', 'liberez votre potentiel', 'l’avenir de', "l'avenir de",
  'unlock', 'unleash', 'seamless', 'seamlessly', 'effortless', 'effortlessly', 'supercharge', 'elevate your',
  'revolutionize', 'game-changing', 'cutting-edge', 'empower',
];
const BANNED_RE = new RegExp(`(?:^|[^a-z])(${BANNED_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![a-z])`, 'i');

function lintText($: cheerio.CheerioAPI, out: Collector, autofix: boolean, profile: LintProfile) {
  const genericCta = new Set(profile.genericCta.map(normalizeText));
  $('*')
    .not('script, style')
    .contents()
    .each((_, node) => {
      if (node.type !== 'text') return;
      const text = node.data;
      if (!text.trim()) return;

      const emojis = text.match(EMOJI_RE)?.filter((m) => !KEEP_SYMBOLS.has(m.replace(/️/g, ''))) ?? [];
      if (emojis.length) {
        if (autofix) {
          node.data = text.replace(EMOJI_RE, (m) => (KEEP_SYMBOLS.has(m.replace(/️/g, '')) ? m : '')).replace(/ {2,}/g, ' ');
          emojis.forEach((e) => out.fix('content.emoji', e));
        } else {
          emojis.forEach((e) => out.violation('content.emoji', 'error', 'Emoji utilisé comme icône : utiliser <iconify-icon>.', e));
        }
      }

      const placeholder = text.match(PLACEHOLDER_RE);
      if (placeholder) out.violation('content.placeholder', 'error', 'Texte de remplissage : écrire du contenu réaliste.', snippet(text));

      const banned = profile.bannedWords ? normalizeText(text).match(BANNED_RE) : null;
      if (banned?.[1]) out.violation('content.banned-word', 'warning', 'Formule creuse à remplacer par un bénéfice concret.', `« ${banned[1]} » dans « ${snippet(text, 60)} »`);
    });

  $('button, a, [role="button"]').each((_, el) => {
    const label = normalizeText($(el).text().trim()).replace(/[.!…]+$/, '');
    if (genericCta.has(label)) out.violation('content.generic-cta', 'warning', 'Libellé d’action générique : dire ce que fait l’action (« Envoyer la facture »).', $(el).text().trim());
  });
}

// ── Accessibilité ──────────────────────────────────────────────────────────

function accessibleName($: cheerio.CheerioAPI, el: Element): string {
  const $el = $(el);
  return (
    $el.attr('aria-label') ??
    $el.attr('aria-labelledby') ??
    $el.attr('title') ??
    ($el.text().trim() || $el.find('img[alt]').attr('alt') || '')
  ).trim();
}

// Images aléatoires : hors sujet dans une maquette, elles induisent le client en erreur.
const RANDOM_IMAGE_RE = /picsum\.photos|placehold\.co|placeholder\.com|via\.placeholder|dummyimage\.com|loremflickr|source\.unsplash\.com|fakeimg/i;

function lintImages($: cheerio.CheerioAPI, out: Collector, autofix: boolean) {
  $('img[src]').each((_, el) => {
    const src = $(el).attr('src') ?? '';
    if (RANDOM_IMAGE_RE.test(src)) {
      out.violation(
        'content.random-image',
        'warning',
        'Image aléatoire sans rapport avec le sujet : utiliser un emplacement décrit <div data-image="description" class="aspect-[4/3] rounded-card"></div>, ou une vraie image fournie.',
        src,
      );
    }
  });

  // Un emplacement décrit doit être annoncé comme une image aux technologies d'assistance.
  $('[data-image]:not(img)').each((_, el) => {
    const $el = $(el);
    const description = ($el.attr('data-image') ?? '').trim();
    if (!description) out.violation('content.image-slot', 'warning', 'Emplacement d’image sans description : décrire l’image attendue.', snippet($.html(el)));
    if ($el.attr('role') !== 'img' || !$el.attr('aria-label')) {
      if (autofix && description) {
        $el.attr('role', 'img');
        if (!$el.attr('aria-label')) $el.attr('aria-label', description);
        out.fix('a11y.image-slot', description);
      } else {
        out.violation('a11y.image-slot', 'warning', 'Emplacement d’image sans role="img" ni aria-label.', description || snippet($.html(el)));
      }
    }
  });
}

function lintA11y($: cheerio.CheerioAPI, out: Collector, profile: LintProfile) {
  $('img').each((_, el) => {
    if ($(el).attr('alt') === undefined) out.violation('a11y.img-alt', 'error', 'Image sans attribut alt (alt="" si décorative).', $(el).attr('src') ?? '<img>');
  });

  $('button, [role="button"]').each((_, el) => {
    if (!accessibleName($, el)) out.violation('a11y.button-name', 'error', 'Bouton sans nom accessible : ajouter un texte ou un aria-label.', snippet($.html(el)));
  });

  $('a').each((_, el) => {
    if (!accessibleName($, el)) out.violation('a11y.link-name', 'error', 'Lien sans nom accessible : ajouter un texte ou un aria-label.', snippet($.html(el)));
  });

  $('input, select, textarea').each((_, el) => {
    const $el = $(el);
    const type = ($el.attr('type') ?? '').toLowerCase();
    if (['hidden', 'submit', 'button', 'reset', 'image'].includes(type)) return;
    const id = $el.attr('id');
    const labelled =
      $el.attr('aria-label') ||
      $el.attr('aria-labelledby') ||
      $el.attr('title') ||
      $el.closest('label').length > 0 ||
      (id && $(`label[for="${id.replace(/"/g, '\\"')}"]`).length > 0);
    if (!labelled) out.violation('a11y.label', 'error', 'Champ sans libellé associé (label for, label englobant ou aria-label). Un placeholder ne suffit pas.', snippet($.html(el)));
  });

  const levels = $('h1, h2, h3, h4, h5, h6')
    .toArray()
    .map((el) => Number(el.tagName.slice(1)));
  const h1 = levels.filter((l) => l === 1).length;
  if (h1 === 0 && profile.requireH1) out.violation('a11y.h1', 'warning', 'Aucun h1 : chaque écran a un titre principal.');
  if (h1 > 1) out.violation('a11y.h1', 'warning', `${h1} h1 : un seul titre principal par écran.`);
  for (let i = 1; i < levels.length; i++) {
    const prev = levels[i - 1]!;
    const cur = levels[i]!;
    if (cur > prev + 1) out.violation('a11y.heading-order', 'warning', 'Saut de niveau de titre.', `h${prev} → h${cur}`);
  }

  $('div, span, li').each((_, el) => {
    const attrs = Object.keys(el.attribs ?? {});
    const clickable = attrs.some((a) => a === 'onclick' || a === '@click' || a.startsWith('@click.') || a === 'x-on:click');
    if (clickable && !$(el).attr('role')) out.violation('a11y.clickable-div', 'warning', 'Élément non interactif cliquable : utiliser <button> ou <a>.', snippet($.html(el)));
  });

  // Un SVG doit dire ce qu'il est : décoratif (aria-hidden) ou porteur de sens (role="img" + aria-label).
  $('svg').each((_, el) => {
    const $el = $(el);
    const role = ($el.attr('role') ?? '').trim();
    const decorative = $el.attr('aria-hidden') === 'true' || role === 'presentation' || role === 'none';
    const described = role === 'img' && !!($el.attr('aria-label') ?? '').trim();
    if (!decorative && !described) {
      out.violation('a11y.svg-role', 'error', 'SVG sans rôle : aria-hidden="true" s’il est décoratif, sinon role="img" et aria-label.', snippet($.html(el), 60));
    }
  });

  // Règles du fragment : le bloc n'est pas une page, il vit sous le titre d'une section.
  if (profile.fragment) {
    $('h1, h2').each((_, el) => {
      out.violation('a11y.block-heading', 'error', 'Un bloc ne porte pas de titre h1/h2 : le titre appartient à la section hôte.', snippet($.html(el), 60));
    });
    $('[data-slide]').each((_, el) => {
      out.violation('structure.block-frame', 'error', 'Un bloc n’est pas une diapo : pas de <section data-slide>, il s’insère dans une section existante.', snippet($.html(el), 60));
    });
    $('[class*="text-xs"]').each((_, el) => {
      out.violation('type.under-caption', 'error', 'Texte sous l’échelle de légende : text-caption est la plus petite taille autorisée dans un bloc.', snippet($.html(el), 60));
    });
  }
}

/**
 * Notes orateur : un deck se présente à voix haute. Le corps dit ce qu'on voit,
 * data-notes dit ce qu'on raconte. Une seule section de référence n'est pas un deck :
 * le seuil de deux diapos évite de reprocher aux exemples du mode une absence de notes.
 */
function lintSpeakerNotes($: cheerio.CheerioAPI, out: Collector, profile: LintProfile) {
  if (!profile.notes) return;
  const slides = $('[data-slide]');
  if (slides.length < 2) return;
  let noted = 0;
  slides.each((_, el) => {
    if (($(el).attr('data-notes') ?? '').trim()) noted++;
  });
  if (noted * 2 < slides.length) {
    out.violation(
      'notes.missing',
      'warning',
      'Moins de la moitié des diapos portent des notes orateur : écrire dans data-notes ce que le présentateur dit, ce qui n’est pas déjà écrit sur la diapo.',
      `${noted} / ${slides.length} diapos`,
    );
  }
}

// ── Structure et styles en ligne ───────────────────────────────────────────

const STYLE_COLOR_RE = /(?:^|;)\s*(?:color|background(?:-color)?|border(?:-[a-z]+)?-?color|fill|stroke)\s*:|#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i;

function lintStructure($: cheerio.CheerioAPI, out: Collector, autofix: boolean) {
  $('link, meta, title, base').each((_, el) => {
    if (autofix) {
      out.fix('structure.head-tag', `<${el.tagName}>`);
      $(el).remove();
    } else out.violation('structure.head-tag', 'error', 'Balise de <head> dans le corps : l’enveloppe s’en charge.', `<${el.tagName}>`);
  });

  $('script[src]').each((_, el) => {
    const src = $(el).attr('src') ?? '';
    if (autofix) {
      out.fix('structure.external-script', src);
      $(el).remove();
    } else out.violation('structure.external-script', 'error', 'Script externe dans le corps : demander la lib via wrap_screen (libs).', src);
  });

  $('style').each((_, el) => {
    out.violation('tokens.style-block', 'warning', 'Bloc <style> dans le corps : préférer les classes de tokens.', snippet($(el).text(), 60));
  });

  $('[style]').each((_, el) => {
    const style = $(el).attr('style') ?? '';
    if (STYLE_COLOR_RE.test(style)) out.violation('tokens.inline-color', 'error', 'Couleur en dur dans un style en ligne : utiliser une classe de token.', snippet(style, 60));
    if (/font-family\s*:/i.test(style)) out.violation('tokens.font-family', 'warning', 'Police en dur dans un style en ligne.', snippet(style, 60));
  });

  $('script:not([src])').each((_, el) => {
    const code = $(el).text();
    const hexes = code.match(/['"`]#[0-9a-fA-F]{3,8}['"`]/g);
    if (hexes?.length) out.violation('tokens.script-hex', 'warning', 'Couleur en dur dans un script : utiliser NAOS.dataPalette[i] ou NAOS.tokens.*.', hexes.slice(0, 3).join(', '));
  });
}

// ── Point d'entrée ─────────────────────────────────────────────────────────

export function lintScreen(input: string, options: LintOptions = {}): LintReport {
  const opts = { autofix: true, ...options };
  const out = new Collector();

  let body = input;
  if (/<!DOCTYPE|<html[\s>]|<head[\s>]|<body[\s>]/i.test(input)) {
    body = extractBody(input);
    if (opts.autofix) out.fix('structure.unwrap', 'document complet → fragment');
  }

  const $ = cheerio.load(body, null, false);
  lintStructure($, out, opts.autofix);
  lintClasses($, out, opts);
  const profile = opts.profile ?? DEFAULT_LINT_PROFILE;
  lintText($, out, opts.autofix, profile);
  lintImages($, out, opts.autofix);
  lintA11y($, out, profile);
  lintSpeakerNotes($, out, profile);

  return out.report(opts.autofix ? $.html().trim() : input);
}

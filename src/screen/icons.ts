/**
 * Icônes autonomes : remplacer chaque <iconify-icon> par le SVG de l'icône, inline.
 *
 * Le runtime des pages Naos charge un script d'icônes depuis un CDN. Un document qui
 * doit vivre sans réseau (intégration dans un outil tiers, CSP strict qui bloque les
 * scripts tiers, archive) préfère des SVG déjà présents dans le HTML : ils héritent de
 * currentColor et ne demandent aucun JavaScript.
 *
 * Le remplacement est le seul appel réseau de Naos en dehors du navigateur ; il n'a
 * lieu que sur demande explicite (wrap_screen → self_contained).
 */

const API = 'https://api.iconify.design';

// Balise ouvrante + fermeture, ou balise auto-fermée.
const TAG_RE = /<iconify-icon\b([^>]*?)(?:\/>|>\s*<\/iconify-icon>)/gi;
const NAMED_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*"([^"]*)"/g;
const FLAG_RE = /(?:^|\s)([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?=\s|$)/g;
const ICON_NAME_RE = /^[a-z0-9-]+\/[a-z0-9-]+$|^[a-z0-9-]+:[a-z0-9-]+$/i;

/** Attributs de la balise d'origine repris sur le SVG (les autres n'ont pas de sens). */
const KEEP = new Set(['class', 'role', 'aria-hidden', 'aria-label', 'aria-labelledby', 'style', 'width', 'height', 'title']);

export interface IconAttributes {
  [name: string]: string;
}

export interface InlineIconsResult {
  html: string;
  /** Icônes remplacées, dans l'ordre du document (doublons compris). */
  inlined: string[];
  /** Icônes demandées mais introuvables : la balise d'origine est laissée en place. */
  missing: string[];
}

export type IconFetcher = (prefix: string, name: string) => Promise<string>;

const cache = new Map<string, string>();

/** Récupère le SVG d'une icône (réseau, mis en cache pour la durée du processus). */
const fetchSvg: IconFetcher = async (prefix, name) => {
  const key = `${prefix}:${name}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const res = await fetch(`${API}/${encodeURIComponent(prefix)}/${encodeURIComponent(name)}.svg`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`icône ${key} introuvable (HTTP ${res.status})`);
  const svg = (await res.text()).trim();
  if (!svg.startsWith('<svg')) throw new Error(`réponse inattendue pour l’icône ${key}`);
  cache.set(key, svg);
  return svg;
};

/** Attributs nommés et attributs booléens d'une balise. */
export function parseAttributes(raw: string): IconAttributes {
  const attrs: IconAttributes = {};
  for (const m of raw.matchAll(NAMED_RE)) {
    const name = m[1];
    if (name) attrs[name.toLowerCase()] = m[2] ?? '';
  }
  for (const m of raw.matchAll(FLAG_RE)) {
    const name = m[1]?.toLowerCase();
    if (name && !(name in attrs)) attrs[name] = '';
  }
  return attrs;
}

/** Reporte sur le SVG les attributs de présentation de la balise d'origine. */
function decorate(svg: string, attrs: IconAttributes): string {
  const parts: string[] = [];
  for (const [name, value] of Object.entries(attrs)) {
    if (!KEEP.has(name)) continue;
    // Le SVG de l'API porte déjà sa largeur et sa hauteur en 1em.
    if ((name === 'width' || name === 'height') && /\swidth="/.test(svg)) continue;
    if (name === 'class' && /\sclass="/.test(svg)) continue;
    parts.push(value === '' ? ` ${name}` : ` ${name}="${value.replace(/"/g, '&quot;')}"`);
  }
  return parts.length ? svg.replace(/<svg\b/, `<svg${parts.join('')}`) : svg;
}

/**
 * Remplace les <iconify-icon> d'un fragment par leur SVG.
 * Une icône en échec laisse la balise intacte : mieux vaut un document qui garde
 * son script d'icônes qu'un document amputé.
 */
export async function inlineIcons(html: string, fetchIcon: IconFetcher = fetchSvg): Promise<InlineIconsResult> {
  const matches = [...html.matchAll(TAG_RE)];
  if (!matches.length) return { html, inlined: [], missing: [] };

  const inlined: string[] = [];
  const missing: string[] = [];
  const svgs = new Map<string, string | null>();
  let out = html;

  for (const m of matches) {
    const attrs = parseAttributes(m[1] ?? '');
    const icon = (attrs.icon ?? '').trim();
    if (!ICON_NAME_RE.test(icon)) {
      missing.push(icon || '(sans nom)');
      continue;
    }
    const [prefix = '', name = ''] = icon.split(/[:/]/);
    const key = `${prefix}:${name}`;
    if (!svgs.has(key)) {
      try {
        svgs.set(key, decorate(await fetchIcon(prefix, name), attrs));
      } catch {
        svgs.set(key, null);
      }
    }
    const svg = svgs.get(key);
    if (!svg) {
      if (!missing.includes(icon)) missing.push(icon);
      continue;
    }
    // Remplace la première occurrence restante : deux balises identiques donnent le
    // même SVG, et l'ordre du document est conservé.
    out = out.replace(m[0], () => svg);
    inlined.push(icon);
  }

  return { html: out, inlined, missing };
}

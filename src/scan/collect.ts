/**
 * Script exécuté DANS la page scannée. Volontairement écrit en chaîne JS autonome :
 * une fonction TypeScript transpilée peut embarquer des helpers absents du navigateur.
 * Il ne renvoie que des mesures de style, jamais le texte de la page.
 */

export interface RawElement {
  tag: string;
  role: 'button' | 'link' | 'heading' | 'input' | 'other';
  area: number;
  top: number;
  textLen: number;
  color?: string;
  colorAlpha?: number;
  bg?: string;
  bgAlpha?: number;
  bgImage?: boolean;
  border?: string;
  borderWidth?: number;
  radius?: number;
  shadow?: string;
  font?: string;
  size?: number;
  weight?: number;
  lineHeight?: number;
  letterSpacing?: number;
  uppercase?: boolean;
  padY?: number;
  padX?: number;
  gap?: number;
}

export interface RawScan {
  url: string;
  title: string;
  viewport: { w: number; h: number };
  docHeight: number;
  pageBg?: string;
  themeColor?: string;
  rootVars: Record<string, string>;
  fonts: string[];
  elements: RawElement[];
}

export const COLLECT_SCRIPT = String.raw`(() => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const cache = new Map();
  // Toute couleur CSS (rgb, oklch, color(), nommée...) → [hex, alpha] via un pixel de canvas.
  const toHex = (value) => {
    if (!value || value === 'transparent') return null;
    if (cache.has(value)) return cache.get(value);
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    const res = a === 0 ? null : ['#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase(), +(a / 255).toFixed(2)];
    cache.set(value, res);
    return res;
  };
  const px = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
  const firstFont = (stack) => (stack || '').split(',')[0].trim().replace(/^["']|["']$/g, '');

  const rootStyle = getComputedStyle(document.documentElement);
  const rootVars = {};
  let varCount = 0;
  for (let i = 0; i < rootStyle.length && varCount < 400; i++) {
    const name = rootStyle[i];
    if (!name.startsWith('--')) continue;
    const value = rootStyle.getPropertyValue(name).trim();
    if (value && value.length < 120) { rootVars[name] = value; varCount++; }
  }

  const bodyBg = toHex(getComputedStyle(document.body).backgroundColor);
  const htmlBg = toHex(rootStyle.backgroundColor);
  const theme = document.querySelector('meta[name="theme-color"]');

  const elements = [];
  const all = document.querySelectorAll('body *');
  const pageW = document.documentElement.clientWidth;
  for (let i = 0; i < all.length && elements.length < 8000; i++) {
    const el = all[i];
    const tag = el.tagName.toLowerCase();
    if (['script', 'style', 'noscript', 'template', 'svg', 'path', 'br'].includes(tag)) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.1) continue;

    let textLen = 0;
    for (const n of el.childNodes) if (n.nodeType === 3) textLen += n.textContent.trim().length;

    const w = Math.max(0, Math.min(rect.right, pageW) - Math.max(rect.left, 0));
    const roleAttr = el.getAttribute('role');
    const role = tag === 'button' || roleAttr === 'button' ? 'button'
      : tag === 'a' ? 'link'
      : /^h[1-6]$/.test(tag) ? 'heading'
      : ['input', 'select', 'textarea'].includes(tag) ? 'input' : 'other';

    const e = { tag, role, area: Math.round(w * rect.height), top: Math.round(rect.top + scrollY), textLen };

    const bg = toHex(cs.backgroundColor);
    if (bg) { e.bg = bg[0]; e.bgAlpha = bg[1]; }
    if (cs.backgroundImage && cs.backgroundImage !== 'none') e.bgImage = true;

    const bw = Math.max(px(cs.borderTopWidth), px(cs.borderBottomWidth), px(cs.borderLeftWidth), px(cs.borderRightWidth));
    if (bw > 0 && cs.borderTopStyle !== 'none') {
      const side = px(cs.borderTopWidth) > 0 ? cs.borderTopColor : px(cs.borderBottomWidth) > 0 ? cs.borderBottomColor : cs.borderLeftColor;
      const bc = toHex(side);
      if (bc) { e.border = bc[0]; e.borderWidth = bw; }
    }
    const radius = px(cs.borderTopLeftRadius);
    if (radius > 0) e.radius = radius;
    if (cs.boxShadow && cs.boxShadow !== 'none') e.shadow = cs.boxShadow;

    if (textLen > 0 || role === 'button' || role === 'link' || role === 'heading') {
      const c = toHex(cs.color);
      if (c) { e.color = c[0]; e.colorAlpha = c[1]; }
      e.font = firstFont(cs.fontFamily);
      e.size = px(cs.fontSize);
      e.weight = parseInt(cs.fontWeight, 10) || 400;
      e.lineHeight = cs.lineHeight === 'normal' ? +(1.2 * e.size).toFixed(1) : px(cs.lineHeight);
      e.letterSpacing = cs.letterSpacing === 'normal' ? 0 : px(cs.letterSpacing);
      if (cs.textTransform === 'uppercase') e.uppercase = true;
    }

    const padY = px(cs.paddingTop), padX = px(cs.paddingLeft);
    if (padY > 0) e.padY = padY;
    if (padX > 0) e.padX = padX;
    const gap = px(cs.rowGap) || px(cs.columnGap);
    if (gap > 0 && /flex|grid/.test(cs.display)) e.gap = gap;

    elements.push(e);
  }

  const fonts = [];
  document.fonts.forEach((f) => { if (f.status === 'loaded') fonts.push(f.family.replace(/^["']|["']$/g, '') + ' ' + f.weight); });

  return {
    url: location.href,
    title: document.title,
    viewport: { w: innerWidth, h: innerHeight },
    docHeight: document.documentElement.scrollHeight,
    pageBg: (bodyBg && bodyBg[1] > 0.9 ? bodyBg[0] : null) || (htmlBg && htmlBg[1] > 0.9 ? htmlBg[0] : null) || undefined,
    themeColor: theme ? (toHex(theme.getAttribute('content')) || [undefined])[0] : undefined,
    rootVars,
    fonts: [...new Set(fonts)],
    elements,
  };
})()`;

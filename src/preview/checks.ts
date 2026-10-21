/**
 * Contrôles exécutés DANS la page rendue (chaîne JS autonome, comme le collecteur du scan).
 * Ils voient ce que le lint ne peut pas voir : la mise en page réelle, les fonds effectifs,
 * les polices effectivement chargées.
 */

export interface RenderChecks {
  viewportWidth: number;
  overflowX: number;
  overflowing: string[];
  lowContrast: Array<{ el: string; text: string; ratio: number; fg: string; bg: string; required: number }>;
  smallTargets: Array<{ el: string; text: string; w: number; h: number; min: number }>;
  brokenImages: string[];
  fonts: Array<{ family: string; loaded: boolean }>;
  /** Cadres du mode (preview.frameSelector) dont le contenu dépasse la hauteur. */
  frames: Array<{ index: number; overflow: number; height: number }>;
  frameCount: number;
}

/** Script des contrôles, avec les seuils de cibles du mode (px) et, s'il existe, son sélecteur de cadres. */
export const renderChecksScript = (controlMin: number, linkMin: number, frameSelector?: string): string => String.raw`(() => {
  const CONTROL_MIN = ${controlMin}, LINK_MIN = ${linkMin};
  // Sélecteur fourni par le mode : passé en littéral JSON, la chaîne reste autonome.
  const FRAME_SELECTOR = ${JSON.stringify(frameSelector ?? '')};
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const cache = new Map();
  const rgba = (value) => {
    if (cache.has(value)) return cache.get(value);
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    const res = [d[0], d[1], d[2], d[3] / 255];
    cache.set(value, res);
    return res;
  };
  const blend = (top, bottom) => {
    const a = top[3];
    return [0, 1, 2].map((i) => top[i] * a + bottom[i] * (1 - a)).concat(1);
  };
  const lum = (c) => {
    const ch = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2]);
  };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hex = (c) => '#' + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
  const describe = (el) => {
    const cls = (el.getAttribute('class') || '').split(/\s+/).filter(Boolean).slice(0, 4).join('.');
    return el.tagName.toLowerCase() + (cls ? '.' + cls : '');
  };
  const snippet = (el) => (el.textContent || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 50);
  const visible = (el, cs) => cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.05 && el.getClientRects().length > 0;

  // Fond effectif : on remonte les ancêtres en composant les fonds semi-transparents.
  // null si une image ou un dégradé se trouve dessous (contraste indéterminable).
  const effectiveBg = (el) => {
    const layers = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
      if (n.hasAttribute('data-image')) return null;
      const c = rgba(cs.backgroundColor);
      if (c[3] > 0) { layers.push(c); if (c[3] >= 0.99) break; }
    }
    let base = [255, 255, 255, 1];
    for (let i = layers.length - 1; i >= 0; i--) base = blend(layers[i], base);
    return base;
  };

  const vw = document.documentElement.clientWidth;
  const overflowX = Math.max(0, document.documentElement.scrollWidth - vw);
  const overflowing = [];
  const lowContrast = [];
  const seen = new Set();
  const smallTargets = [];

  for (const el of document.body.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (!visible(el, cs)) continue;
    const rect = el.getBoundingClientRect();

    if (overflowX > 0 && rect.right > vw + 1 && rect.width > 0 && overflowing.length < 8) {
      // On ne garde que l'élément le plus extérieur qui déborde.
      const parent = el.parentElement;
      if (!parent || parent.getBoundingClientRect().right <= vw + 1) overflowing.push(describe(el) + ' (' + Math.round(rect.right - vw) + 'px)');
    }

    let ownText = '';
    for (const n of el.childNodes) if (n.nodeType === 3) ownText += n.textContent;
    ownText = ownText.trim();
    if (ownText) {
      const bg = effectiveBg(el);
      if (bg) {
        const fg = blend(rgba(cs.color), bg);
        const size = parseFloat(cs.fontSize);
        const bold = (parseInt(cs.fontWeight, 10) || 400) >= 700;
        const required = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
        const r = ratio(fg, bg);
        const key = hex(fg) + hex(bg) + required;
        if (r < required && !seen.has(key) && lowContrast.length < 12) {
          seen.add(key);
          lowContrast.push({ el: describe(el), text: ownText.slice(0, 50), ratio: +r.toFixed(2), fg: hex(fg), bg: hex(bg), required });
        }
      }
    }

    const interactive = el.matches('button, [role="button"], [role="tab"], input:not([type="hidden"]), select, textarea, summary, a[href]');
    if (interactive && smallTargets.length < 10) {
      // Liens dans un paragraphe : exemptés (WCAG 2.5.8). Seuils fournis par le mode.
      // Une case à cocher dans un label : c'est le label entier qui reçoit le doigt.
      const inLabel = el.matches('input') && el.closest('label');
      const inline = (el.matches('a') && el.closest('p, li') && cs.display === 'inline') || inLabel;
      const min = el.matches('a') ? LINK_MIN : CONTROL_MIN;
      // Tolérance d'un demi-pixel : un bouton de 40 px mesure souvent 39,99 px.
      if (!inline && (rect.height < min - 0.5 || rect.width < 23.5)) {
        smallTargets.push({ el: describe(el), text: snippet(el), w: Math.round(rect.width), h: Math.round(rect.height), min });
      }
    }
  }

  const brokenImages = [...document.images].filter((img) => img.complete && img.naturalWidth === 0 && img.getAttribute('src')).map((img) => img.getAttribute('src').slice(0, 120));

  // Le navigateur ne charge une police que si elle sert : on ne vérifie que les familles utilisées.
  const used = new Set();
  for (const el of document.body.querySelectorAll('*')) {
    // Un élément masqué (ex. barre latérale en mobile) ne déclenche pas le chargement de sa police.
    if (!el.getClientRects().length) continue;
    let hasText = false;
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) { hasText = true; break; }
    if (hasText) used.add(getComputedStyle(el).fontFamily.split(',')[0].trim().replace(/["']/g, ''));
  }
  const H = window.NAOS;
  const system = /^(ui-[a-z-]+|system-ui|-apple-system|sans-serif|serif|monospace)$/i;
  const families = H ? [...new Set([H.fonts.display, H.fonts.body, H.fonts.mono, H.fonts.accent].filter((f) => f && used.has(f) && !system.test(f)))] : [];
  const fonts = families.map((family) => ({ family, loaded: document.fonts.check('16px "' + family + '"') && [...document.fonts].some((f) => f.family.replace(/["']/g, '') === family && f.status === 'loaded') }));

  // Cadres à contenu borné (diapos) : overflow-hidden rogne sans que le débordement
  // horizontal ni le contraste ne le voient. scrollHeight couvre le contenu en flux ;
  // on y ajoute les descendants positionnés, qui peuvent lui échapper (absolus, transforms).
  const frames = [];
  let frameCount = 0;
  if (FRAME_SELECTOR) {
    const nodes = [...document.querySelectorAll(FRAME_SELECTOR)];
    frameCount = nodes.length;
    nodes.forEach((el, i) => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none') return;
      const box = el.getBoundingClientRect();
      const bottom = box.top + (parseFloat(cs.borderTopWidth) || 0) + el.clientHeight;
      let over = Math.max(0, el.scrollHeight - el.clientHeight);
      for (const child of el.querySelectorAll('*')) {
        const r = child.getBoundingClientRect();
        if (r.height) over = Math.max(over, r.bottom - bottom);
      }
      // Tolérance d'un pixel : les arrondis sous-pixel déclenchent sinon de faux positifs.
      if (over > 1) frames.push({ index: i + 1, overflow: Math.round(over), height: Math.round(box.height) });
    });
  }

  return { viewportWidth: vw, overflowX, overflowing, lowContrast, smallTargets, brokenImages, fonts, frames, frameCount };
})()`;

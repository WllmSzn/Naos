/**
 * Catalogue de la bibliothèque de DNA : une galerie index.html et un CATALOG.md à la racine
 * de chaque bibliothèque configurée, pour voir d'un coup d'œil ce qui existe.
 *
 *   npm run catalog               → catalogue (sans recalculer les aperçus)
 *   npm run catalog -- --previews → recalcule aussi les captures <famille>/<id>/previews/<mode>.jpg
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import puppeteer, { type Browser } from 'puppeteer-core';
import { googleFontsUrl, loadLibrary, type DnaLocation } from '../src/dna/library.js';
import type { Dna } from '../src/dna/schema.js';
import { getModes } from '../src/modes/modes.js';
import { LIBRARY_DIRS, PROJECT_ROOT } from '../src/paths.js';
import { findBrowser } from '../src/scan/scan.js';
import { lintScreen } from '../src/screen/lint.js';
import { wrapScreen, type Lib } from '../src/screen/wrap.js';

// Écran d'exemple rendu pour l'aperçu de chaque mode.
const PREVIEW_BODIES: Record<string, { file: string; libs: Lib[] }> = {
  website: { file: 'landing.body.html', libs: [] },
  'product-desktop': { file: 'invoices-dashboard.body.html', libs: ['chartjs'] },
  presentation: { file: 'deck.body.html', libs: [] },
};

const modes = getModes().modes;
const withPreviews = process.argv.includes('--previews');

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rel = (root: string, file: string) => path.relative(root, file).split(path.sep).join('/');

async function renderPreviews(browser: Browser, dna: Dna, loc: DnaLocation): Promise<void> {
  for (const modeId of Object.keys(dna.modes)) {
    const mode = modes.get(modeId);
    const example = PREVIEW_BODIES[modeId];
    if (!mode || !example) continue;
    const body = readFileSync(path.join(PROJECT_ROOT, 'examples', example.file), 'utf8');
    const html = wrapScreen(lintScreen(body, { theme: dna.theme, profile: mode.lint }).html, dna, { mode: modeId, libs: example.libs, title: dna.name });
    const vp = mode.viewports.find((v) => !v.mobile) ?? mode.viewports[0]!;
    const page = await browser.newPage();
    await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 640 / vp.width });
    await page.setContent(html, { waitUntil: 'load', timeout: 30000 });
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 }).catch(() => undefined);
    const out = path.join(loc.dir, 'previews', `${modeId}.jpg`);
    mkdirSync(path.dirname(out), { recursive: true });
    await page.screenshot({ path: out as `${string}.jpeg`, type: 'jpeg', quality: 72 });
    await page.close();
  }
}

function swatches(dna: Dna): string {
  const t = dna.tokens as Record<string, string | undefined>;
  const core = ['base', 'surface', 'raised', 'line', 'ink', 'muted', 'accent', 'accent2', 'success', 'warning', 'danger']
    .filter((k) => t[k])
    .map((k) => `<i style="background:${t[k]}" title="${k} ${t[k]}"></i>`)
    .join('');
  const extra = Object.entries(dna.extraColors ?? {})
    .map(([k, v]) => `<i style="background:${v}" title="${esc(k)} ${v}"></i>`)
    .join('');
  return `<div class="sw">${core}</div>${extra ? `<div class="sw extra" title="Couleurs métier">${extra}</div>` : ''}`;
}

function card(root: string, dna: Dna, loc: DnaLocation): string {
  const modeBadges = [...modes.values()]
    .map((m) => `<span class="mode ${m.id in dna.modes ? 'on' : 'off'}" title="${m.id in dna.modes ? 'sert' : 'ne sert pas'} le mode ${esc(m.name)}">${esc(m.name)}</span>`)
    .join('');
  const previews = Object.keys(dna.modes)
    .map((m) => ({ m, file: path.join(loc.dir, 'previews', `${m}.jpg`) }))
    .filter((p) => existsSync(p.file))
    .map((p) => `<a href="${esc(rel(root, p.file))}" title="Aperçu ${esc(modes.get(p.m)?.name ?? p.m)}"><img src="${esc(rel(root, p.file))}" alt="Aperçu ${esc(dna.name)} en mode ${esc(modes.get(p.m)?.name ?? p.m)}" loading="lazy"></a>`)
    .join('');
  return `<article class="card">
  ${previews ? `<div class="pv">${previews}</div>` : '<div class="pv empty">Pas d’aperçu : npm run catalog -- --previews</div>'}
  <div class="body">
    <h3 style="font-family:'${esc(dna.fonts.display)}',system-ui,sans-serif">${esc(dna.name)}</h3>
    <p class="meta"><code>${esc(dna.id)}</code> · ${dna.theme === 'dark' ? 'sombre' : 'clair'} · ${esc(dna.fonts.display)}${dna.fonts.body !== dna.fonts.display ? ` / ${esc(dna.fonts.body)}` : ''}</p>
    ${swatches(dna)}
    <p class="sum">${esc(dna.summary)}</p>
    <div class="modes">${modeBadges}</div>
    <p class="file"><a href="${esc(rel(root, loc.file))}">${esc(rel(root, loc.file))}</a></p>
  </div>
</article>`;
}

function buildHtml(root: string, entries: Array<{ dna: Dna; loc: DnaLocation }>, errors: Array<{ file: string; issues: string[] }>): string {
  const families = [...new Set(entries.map((e) => e.loc.family ?? '(à plat)'))].sort();
  const fonts = [...new Set(entries.map((e) => googleFontsUrl(e.dna)).filter(Boolean))];
  const gaps = [...modes.values()]
    .map((m) => ({ m, missing: entries.filter((e) => !(m.id in e.dna.modes)).map((e) => e.dna.id) }))
    .filter((g) => g.missing.length);
  const now = new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bibliothèque de DNA · Naos</title>
${fonts.map((u) => `<link rel="stylesheet" href="${esc(u)}">`).join('\n')}
<style>
:root{--bg:#f6f6f4;--card:#fff;--ink:#17171a;--muted:#62626b;--line:#e2e2de;--on:#17171a;--on-ink:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#121214;--card:#1b1b1f;--ink:#f1f1f3;--muted:#a0a0aa;--line:#2c2c32;--on:#f1f1f3;--on-ink:#121214}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
header,main{max-width:1400px;margin:0 auto;padding:24px 16px}header h1{margin:0;font-size:28px;letter-spacing:-.02em}
header p{margin:4px 0 0;color:var(--muted)}nav{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
nav a{color:var(--ink);text-decoration:none;border:1px solid var(--line);border-radius:999px;padding:4px 12px;font-size:13px}
.gaps,.errors{margin-top:16px;padding:12px 16px;border:1px solid var(--line);border-radius:10px;background:var(--card);font-size:13px}
.errors{border-color:#c0392b}.gaps b,.errors b{display:block;margin-bottom:4px}
h2{margin:32px 0 12px;font-size:20px;display:flex;gap:10px;align-items:baseline}h2 small{color:var(--muted);font-weight:400;font-size:14px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden;display:flex;flex-direction:column}
.pv{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:2px;background:var(--line)}.pv img{display:block;width:100%;aspect-ratio:16/10;object-fit:cover;object-position:top}
.pv.empty{display:grid;place-items:center;aspect-ratio:16/10;color:var(--muted);font-size:12px;background:var(--bg)}
.body{padding:14px 16px 16px;display:flex;flex-direction:column;gap:8px;flex:1}h3{margin:0;font-size:22px;line-height:1.1}
.meta,.file{margin:0;color:var(--muted);font-size:12px}.meta code{color:var(--ink)}.file a{color:var(--muted)}
.sw{display:flex;gap:3px;flex-wrap:wrap}.sw i{width:22px;height:22px;border-radius:5px;box-shadow:inset 0 0 0 1px rgba(127,127,127,.35)}.sw.extra i{width:14px;height:14px;border-radius:50%}
.sum{margin:0;font-size:13px;flex:1}.modes{display:flex;gap:6px;flex-wrap:wrap}
.mode{font-size:11px;padding:2px 8px;border-radius:999px;border:1px solid var(--line)}.mode.on{background:var(--on);color:var(--on-ink);border-color:var(--on)}.mode.off{color:var(--muted);text-decoration:line-through}
</style>
</head>
<body>
<header>
  <h1>Bibliothèque de DNA</h1>
  <p>${entries.length} DNA · ${families.length} familles · ${[...modes.values()].map((m) => esc(m.name)).join(', ')} · générée le ${esc(now)}</p>
  <nav>${families.map((f) => `<a href="#${esc(f)}">${esc(f)} (${entries.filter((e) => (e.loc.family ?? '(à plat)') === f).length})</a>`).join('')}</nav>
  ${gaps.length ? `<div class="gaps"><b>Blocs de mode manquants</b>${gaps.map((g) => `${esc(g.m.name)} : ${g.missing.map(esc).join(', ')}`).join('<br>')}</div>` : ''}
  ${errors.length ? `<div class="errors"><b>DNA invalides (non chargées par Naos)</b>${errors.map((e) => `${esc(e.file)} : ${esc(e.issues.join(' ; '))}`).join('<br>')}</div>` : ''}
</header>
<main>
${families
  .map((f) => {
    const list = entries.filter((e) => (e.loc.family ?? '(à plat)') === f).sort((a, b) => a.dna.name.localeCompare(b.dna.name));
    return `<h2 id="${esc(f)}">${esc(f)} <small>${list.length} DNA</small></h2>\n<div class="grid">\n${list.map((e) => card(root, e.dna, e.loc)).join('\n')}\n</div>`;
  })
  .join('\n')}
</main>
</body>
</html>
`;
}

function buildMarkdown(entries: Array<{ dna: Dna; loc: DnaLocation }>): string {
  const families = [...new Set(entries.map((e) => e.loc.family ?? '(à plat)'))].sort();
  const modeIds = [...modes.keys()];
  const lines = [
    '# Bibliothèque de DNA',
    '',
    `${entries.length} DNA. Généré par \`npm run catalog\` (Naos) : ne pas modifier à la main. Galerie visuelle : [index.html](index.html).`,
    '',
  ];
  for (const f of families) {
    const list = entries.filter((e) => (e.loc.family ?? '(à plat)') === f).sort((a, b) => a.dna.id.localeCompare(b.dna.id));
    lines.push(`## ${f}`, '', `| DNA | Thème | ${modeIds.join(' | ')} | Polices | Résumé |`, `|---|---|${modeIds.map(() => ':-:').join('|')}|---|---|`);
    for (const { dna, loc } of list) {
      const file = (loc.family ? `${loc.family}/${dna.id}/dna.json` : path.basename(loc.file)).replace(/\\/g, '/');
      const fonts = dna.fonts.display === dna.fonts.body ? dna.fonts.display : `${dna.fonts.display} / ${dna.fonts.body}`;
      lines.push(`| [${dna.name}](${file}) \`${dna.id}\` | ${dna.theme === 'dark' ? 'sombre' : 'clair'} | ${modeIds.map((m) => (m in dna.modes ? '●' : '')).join(' | ')} | ${fonts} | ${dna.summary.replace(/\|/g, '\\|')} |`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

const { dnas, locations, errors } = loadLibrary();
let browser: Browser | undefined;
try {
  if (withPreviews) browser = await puppeteer.launch({ executablePath: findBrowser(), headless: true, args: ['--hide-scrollbars', '--mute-audio'] });
  for (const root of LIBRARY_DIRS) {
    const entries = [...dnas.values()].map((dna) => ({ dna, loc: locations.get(dna.id)! })).filter((e) => e.loc.root === root);
    if (!entries.length) continue;
    if (browser) {
      for (const e of entries) {
        await renderPreviews(browser, e.dna, e.loc);
        process.stdout.write('.');
      }
      process.stdout.write('\n');
    }
    const rootErrors = errors.filter((e) => existsSync(path.join(root, e.file)));
    writeFileSync(path.join(root, 'index.html'), buildHtml(root, entries, rootErrors));
    writeFileSync(path.join(root, 'CATALOG.md'), buildMarkdown(entries));
    console.log(`${root} : ${entries.length} DNA, ${new Set(entries.map((e) => e.loc.family)).size} familles${rootErrors.length ? `, ${rootErrors.length} invalide(s)` : ''} → index.html, CATALOG.md`);
  }
} finally {
  await browser?.close();
}

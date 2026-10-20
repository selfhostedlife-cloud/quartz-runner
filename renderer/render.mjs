// Carousel renderer: spec JSON -> (Pixabay photos) -> 1080x1080 JPEG slides.
// Usage: node render.mjs <spec.json> <outDir>
// Slide fields: type (cover|point|stat|list|cta), kicker, title, text, items[], stat, teaser, imageQuery (2-4 keywords for Pixabay), button
// **word** in any text = gold highlight.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { judgePhoto, suggestQueries } from './photojudge.mjs';
import { GRAPHIC_BANDS, THEME_VARS, FONT_IMPORT, layoutCss, layoutHtml } from './layouts.mjs';
import { winnerHtml } from './winner.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const brand = JSON.parse(fs.readFileSync(path.join(root, 'brand', 'brand.json'), 'utf8'));
const c = brand.colors;
const W = brand.slide.width, H = brand.slide.height;

// ---- env (.env in project root; real env wins) ----
if (fs.existsSync(path.join(root, '.env'))) {
  for (const line of fs.readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}

// ---- Pixabay photos (free; downloaded + cached, never hotlinked) ----
const PIX_KEY = process.env.PIXABAY_KEY || (() => {
  try { return fs.readFileSync('C:/Users/smfab/autoedit/secrets/pixabay_key.txt', 'utf8').trim(); } catch { return ''; }
})();
const usedIds = new Set();
// Pixabay has no relevance control, so filter by tags: drop angry/pointing/portrait-style shots.
const BAD_TAGS = /(angry|shouting|pointing|aggressive|portrait|fashion|model|glamour|sexy|bikini|party|tattoo|child|baby|secret|classified|confidential|spy|army|military)/i;
async function pixabaySearch(q, wantTall, skip) {
  const url = new URL('https://pixabay.com/api/');
  url.search = new URLSearchParams({ key: PIX_KEY, q, image_type: 'photo', safesearch: 'true', per_page: '40', min_width: '1000', order: 'popular', lang: 'en' });
  const r = await fetch(url);
  if (!r.ok) throw new Error('Pixabay ' + r.status + ' ' + (await r.text()).slice(0, 120));
  const j = await r.json();
  let hits = (j.hits || []).filter((h) => !usedIds.has(h.id) && !BAD_TAGS.test(h.tags));
  if (wantTall) hits = hits.filter((h) => h.imageHeight >= 900).concat(hits.filter((h) => h.imageHeight < 900));
  return hits[skip] || null;
}
async function getPhotoById(id, file) {
  if (fs.existsSync(file)) return file;
  const r = await fetch('https://pixabay.com/api/?' + new URLSearchParams({ key: PIX_KEY, id: String(id) }));
  const hit = (await r.json()).hits?.[0];
  if (!hit) throw new Error('Pixabay id not found: ' + id);
  usedIds.add(hit.id);
  fs.writeFileSync(file, Buffer.from(await (await fetch(hit.largeImageURL)).arrayBuffer()));
  fs.writeFileSync(file + '.credit.json', JSON.stringify({ source: 'Pixabay', id: hit.id, author: hit.user, page: hit.pageURL, tags: hit.tags, license: 'Pixabay License' }));
  return file;
}
async function getPhoto(queries, file, wantTall, skip = 0) {
  if (fs.existsSync(file) && !skip) return file;
  if (!PIX_KEY) throw new Error('No Pixabay key');
  const list = (Array.isArray(queries) ? queries : [queries]).filter(Boolean);
  const tries = [...list, ...list.map((q) => q.split(/\s+/)[0]), 'shipping container port'];
  for (const q of tries) {
    const hit = await pixabaySearch(q, wantTall, skip);
    if (!hit) continue;
    usedIds.add(hit.id);
    const img = await fetch(hit.largeImageURL);
    fs.writeFileSync(file, Buffer.from(await img.arrayBuffer()));
    fs.writeFileSync(file + '.credit.json', JSON.stringify({ source: 'Pixabay', id: hit.id, author: hit.user, page: hit.pageURL, query: q, tags: hit.tags, license: 'Pixabay License' }));
    return file;
  }
  throw new Error('No Pixabay result for: ' + list.join(' | '));
}

// Judged photo: collect candidates for the slide's queries, let Gemini vision pick the one that literally fits (or none).
async function pixabayHits(q, wantTall) {
  const url = new URL('https://pixabay.com/api/');
  url.search = new URLSearchParams({ key: PIX_KEY, q, image_type: 'photo', safesearch: 'true', per_page: '30', min_width: '1000', order: 'popular', lang: 'en' });
  const r = await fetch(url);
  if (!r.ok) return [];
  let hits = ((await r.json()).hits || []).filter((h) => !usedIds.has(h.id) && !BAD_TAGS.test(h.tags));
  if (wantTall) hits = hits.filter((h) => h.imageHeight >= 900).concat(hits.filter((h) => h.imageHeight < 900));
  return hits;
}
async function getJudgedPhoto(slide, topic, queries, file, wantTall) {
  const list = (Array.isArray(queries) ? queries : [queries]).filter(Boolean).slice(0, 5);
  const cands = []; const seen = new Set();
  for (const q of list) {
    for (const h of (await pixabayHits(q, wantTall)).slice(0, 3)) if (!seen.has(h.id)) { seen.add(h.id); cands.push(h); }
  }
  if (!cands.length) return null;
  const withThumb = [];
  for (const h of cands.slice(0, 10)) { try { withThumb.push({ ...h, thumb: Buffer.from(await (await fetch(h.webformatURL)).arrayBuffer()) }); } catch { /* skip */ } }
  let verdict;
  try { verdict = await judgePhoto(slide, topic, withThumb); } catch (e) { console.error('[render] photo judge unavailable:', e.message.slice(0, 80)); return undefined; }  // undefined = judge down, caller falls back
  console.error(`[render] judge: "${plainText(slide.title)}" -> ${verdict.best < 0 ? 'NO PHOTO FITS' : '#' + verdict.best} (${verdict.reason})`);
  if (verdict.best < 0) return null;
  const hit = withThumb[verdict.best];
  usedIds.add(hit.id);
  fs.writeFileSync(file, Buffer.from(await (await fetch(hit.largeImageURL)).arrayBuffer()));
  fs.writeFileSync(file + '.credit.json', JSON.stringify({ source: 'Pixabay', id: hit.id, author: hit.user, page: hit.pageURL, tags: hit.tags, judged: verdict.reason, license: 'Pixabay License' }));
  return file;
}
const plainText = (t) => String(t ?? '').replace(/(==|\+\+|!!|\*\*)/g, '').replace(/\s*\n+\s*/g, ' ').trim();

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Markup: **gold text**  ==yellow highlight==  ++purple highlight++  !!orange highlight!!   (\n = new line)
const hl = (s) => withPills(hlRaw(s));
const hlRaw = (s) => esc(s)
  .replace(/\*\*(.+?)\*\*/g, '<em>$1</em>')
  .replace(/==(.+?)==/g, '<mark class="y">$1</mark>')
  .replace(/\+\+(.+?)\+\+/g, '<mark class="p">$1</mark>')
  .replace(/!!(.+?)!!/g, '<mark class="o">$1</mark>');
const withPills = (html) => { let h = html; for (const p of (globalThis.PILLS || [])) { const e = esc(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); h = h.replace(new RegExp('(?![^<]*>)(' + e + ')', 'i'), '<span class="pillt">$1</span>'); } return h; };
const para = (s) => String(s ?? '').split('\n').map((ln) => (ln.trim() === '' ? '<span class="gap"></span>' : `<span class="ln">${hl(ln)}</span>`)).join('');
const dataUri = (f) => `data:image/${f.endsWith('.png') ? 'png' : 'jpeg'};base64,${fs.readFileSync(f).toString('base64')}`;

const css = `
${FONT_IMPORT}
*{box-sizing:border-box;margin:0;padding:0}
body{width:${W}px;height:${H}px;font-family:Inter,sans-serif;color:${c.white};background:${c.ink};overflow:hidden;position:relative}
.photo{position:absolute;left:0;right:0;top:0;height:${Math.round(H * 0.52)}px;background-size:cover;background-position:center}
.photo:after{content:'';position:absolute;inset:0;background:linear-gradient(to bottom,rgba(10,15,30,0) 45%,${c.ink} 100%)}
.full{position:absolute;inset:0;background-size:cover;background-position:center}
.full:after{content:'';position:absolute;inset:0;background:linear-gradient(to bottom,rgba(10,15,30,.15) 0%,rgba(10,15,30,.55) 45%,rgba(10,15,30,.96) 100%)}
.dim:after{background:linear-gradient(rgba(10,15,30,.55),rgba(10,15,30,.85))}
.wrap{position:absolute;left:70px;right:70px}
.tag{display:inline-block;font-weight:800;letter-spacing:.16em;font-size:24px;color:${c.ink};background:${c.gold};padding:8px 16px;border-radius:8px;text-transform:uppercase}
h1,h2{font-family:var(--disp,'Archivo Black'),Inter,sans-serif;line-height:1.12;letter-spacing:.012em;word-spacing:.04em}
h1{font-size:114px}h2{font-size:90px}
em{font-style:normal;color:${c.gold}}
p{font-size:36px;line-height:1.35;color:#E7EBF5;margin-top:22px}
ul{list-style:none;margin-top:26px;display:flex;flex-direction:column;gap:20px}
li{font-size:36px;line-height:1.25;padding-left:54px;position:relative;color:#EEF1F8}
li:before{content:'';position:absolute;left:0;top:7px;width:26px;height:26px;border-radius:7px;background:${c.gold}}
.big{font-family:'Archivo Black';font-size:170px;line-height:1;color:${c.gold}}
.teaser{position:absolute;left:70px;right:70px;bottom:44px;display:flex;justify-content:space-between;align-items:center;font-size:27px;font-weight:600;color:${c.gold}}
.teaser span.l{color:#fff;opacity:.95}
.arrow{font-family:'Archivo Black';font-size:34px}
.num{position:absolute;right:70px;top:56px;font-family:'Archivo Black';font-size:28px;color:#fff;background:rgba(10,15,30,.55);padding:6px 14px;border-radius:999px}
.handle{position:absolute;left:70px;top:58px;font-size:25px;font-weight:800;color:#fff;background:rgba(10,15,30,.55);padding:6px 14px;border-radius:999px}
.pill{display:inline-block;background:${c.orange};color:#fff;font-weight:800;font-size:46px;padding:24px 40px;border-radius:20px;margin-top:30px;box-shadow:0 10px 40px rgba(255,90,0,.5)}
.small{font-size:30px;color:#fff;opacity:.9;margin-top:22px}
h1,h2{white-space:pre-line}
mark{border-radius:.16em;padding:.02em .2em;-webkit-box-decoration-break:clone;box-decoration-break:clone;line-height:1.3}
mark.y{background:#FFE600;color:#0A0F1E}
mark.p{background:#8A2BFF;color:#fff}
mark.o{background:#FF5A00;color:#fff}
.ln{display:block;margin-top:14px}.ln:first-child{margin-top:0}.gap{display:block;height:18px}
.pdf{position:absolute;right:64px;top:400px;width:400px;transform:rotate(3deg);border:11px solid #fff;border-radius:16px;box-shadow:0 0 0 5px rgba(255,230,0,.95),0 26px 70px rgba(0,0,0,.7);overflow:hidden;background:#fff}
.pdf img{display:block;width:100%}
.badge{position:absolute;z-index:5;right:40px;top:372px;transform:rotate(3deg);background:#F26A1B;color:#fff;font-weight:800;font-size:26px;letter-spacing:.12em;padding:10px 20px;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.5)}
`;

function slideHtml(s, i, total, handle, imgFile) {
  if (globalThis.TEMPLATE && !s.layout) { // owner's winning templates (winner.mjs): black, literal hero photo, huge text, save/share footer
    const pf = s.pdfPreview ? path.resolve(globalThis.SPEC_DIR || '.', s.pdfPreview) : null;
    return winnerHtml(globalThis.TEMPLATE, s, i, total, handle, imgFile ? dataUri(imgFile) : '', pf && fs.existsSync(pf) ? dataUri(pf) : '');
  }
  const bg = imgFile ? dataUri(imgFile) : '';
  const fullBg = imgFile ? `background-image:url(${bg})` : `background:${GRAPHIC_BANDS[(i + 1) % GRAPHIC_BANDS.length]}`;
  const last = i === total - 1;
  let inner = '';
  if (s.type === 'cover' && !s.layout) {
    inner = `<div class="full" style="${fullBg}"></div>
      <div class="handle">${esc(handle)}</div>
      <div class="wrap" style="bottom:120px"><span class="tag">${esc(s.kicker || '')}</span>
      <h1 style="margin-top:22px">${hl(s.title)}</h1>${s.sub ? `<p>${para(s.sub)}</p>` : ''}</div>`;
  } else if (s.type === 'cta') {
    const pdfFile = s.pdfPreview ? path.resolve(globalThis.SPEC_DIR || '.', s.pdfPreview) : null;
    if (pdfFile && fs.existsSync(pdfFile)) {
      inner = `<div class="full dim" style="${fullBg}"></div>
      <div class="handle">${esc(handle)}</div><div class="num">${i + 1}/${total}</div>
      <div class="wrap" style="top:130px"><span class="tag">${esc(s.kicker || 'Free PDF')}</span>
        <h1 style="margin-top:20px;font-size:84px;max-width:940px">${hl(s.title)}</h1></div>
      <div class="wrap" style="top:470px;left:70px;right:auto;width:480px">
        <div><span class="pill" style="font-size:38px;padding:20px 30px;margin-top:0">${esc(s.button)}</span></div>
        <p class="small" style="font-size:29px">${para(s.text || '')}</p>
        <p class="small" style="margin-top:30px;color:${c.gold};font-weight:800;font-size:27px">&#9733; Follow &bull; Save &bull; Share</p></div>
      <div class="pdf"><img src="${dataUri(pdfFile)}"></div>
      <div class="badge">FREE PDF</div>`;
    } else {
      inner = `<div class="full dim" style="${fullBg}"></div>
      <div class="handle">${esc(handle)}</div><div class="num">${i + 1}/${total}</div>
      <div class="wrap" style="top:0;bottom:0;display:flex;flex-direction:column;justify-content:center"><div><span class="tag">${esc(s.kicker || 'Free resource')}</span></div>
      <h1 style="margin-top:22px;font-size:100px">${hl(s.title)}</h1>
      <div><span class="pill">${esc(s.button)}</span></div>
      <p class="small">${para(s.text || '')}</p>
      <p class="small" style="margin-top:34px;color:${c.gold};font-weight:800">&#9733; Follow &nbsp;&bull;&nbsp; Save &nbsp;&bull;&nbsp; Share with an exporter friend</p></div>`;
    }
  } else if (s.layout) {
    inner = layoutHtml(s, i, total, handle);
  } else {
    let body = '';
    if (s.type === 'stat') body = `<div class="big">${esc(s.stat)}</div><h2 style="font-size:74px;margin-top:6px">${hl(s.title)}</h2>${s.text ? `<p>${para(s.text)}</p>` : ''}`;
    else if (s.type === 'list') body = `<h2 style="font-size:76px">${hl(s.title)}</h2><ul>${(s.items || []).map((t) => `<li>${hl(t)}</li>`).join('')}</ul>`;
    else body = `<h2>${hl(s.title)}</h2>${s.text ? `<p>${para(s.text)}</p>` : ''}`;
    inner = `<div class="photo${imgFile ? '' : ' nophoto'}" style="${imgFile ? `background-image:url(${bg})` : `--g:${GRAPHIC_BANDS[i % GRAPHIC_BANDS.length]}`}"></div>
      <div class="handle">${esc(handle)}</div><div class="num">${i + 1}/${total}</div>
      <div class="wrap" style="top:${Math.round(H * 0.40)}px;bottom:120px;display:flex;flex-direction:column;justify-content:flex-start">
        ${s.kicker ? `<div><span class="tag">${esc(s.kicker)}</span></div><div style="height:16px"></div>` : ''}${body}</div>`;
  }
  const teaser = s.teaser ? `<div class="teaser"><span class="l">${hl(s.teaser)}</span><span class="arrow">&rarr;</span></div>`
    : (!last && s.type === 'cover' ? `<div class="teaser"><span class="l">Swipe &mdash; it gets worse</span><span class="arrow">&rarr;</span></div>` : '');
  const S = { ...(globalThis.SPEC_STYLE || {}), ...(s.style || {}) };
  const base = globalThis.PT || (S.ink || S.accent || S.accent2 || S.upper != null ? { ink: c.ink, accent: c.gold, accent2: '#F26A1B', tagText: '#0A0F1E' } : null);
  const T = base && (S.ink || S.accent || S.accent2 || S.tagText || S.upper != null) ? { ...base, ...(S.ink ? { ink: S.ink } : {}), ...(S.accent ? { accent: S.accent } : {}), ...(S.accent2 ? { accent2: S.accent2 } : {}), ...(S.tagText ? { tagText: S.tagText } : {}), ...(S.upper != null ? { upper: !!S.upper } : {}) } : base;
  const tv = s.layout ? (s.themeVars || THEME_VARS[s.theme] || THEME_VARS.dark) : null;
  const fontVar = (S.font || s.font) ? `--disp:'${S.font || s.font}';` : '';
  const bodyCls = s.layout ? ` class="th" style="${fontVar}--bg:${S.ink || tv.bg};--fg:${tv.fg};--ac:${S.accent || tv.ac};--on:${S.tagText || tv.on};--mu:${tv.mu};--ac2:${S.accent2 || tv.ac2};--pill:${S.accent2 || tv.pill}"` : (fontVar ? ` style="${fontVar}"` : '');
  const T0 = null;
  const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255].join(','); };
  const ptCss = T && !s.layout ? `
body{background:${T.ink}}
.photo:after{background:linear-gradient(to bottom,rgba(${rgb(T.ink)},0) 45%,${T.ink} 100%)}
.full:after{background:linear-gradient(to bottom,rgba(${rgb(T.ink)},.15) 0%,rgba(${rgb(T.ink)},.55) 45%,rgba(${rgb(T.ink)},.96) 100%)}
.dim:after{background:linear-gradient(rgba(${rgb(T.ink)},.55),rgba(${rgb(T.ink)},.85))}
.tag{background:${T.accent};color:${T.tagText || '#0A0F1E'}}
em,.big,.teaser,.small[style*="color"]{color:${T.accent}!important}
li:before{background:${T.accent}}
mark.y{background:${T.accent};color:${T.tagText || '#0A0F1E'}}
mark.p{background:${T.accent2 || '#7C3AED'};color:#fff}
.pill{background:${T.accent2 || '#F26A1B'}}
.big{font-family:var(--disp,'Archivo Black')}
${T.upper ? 'h1,h2{text-transform:uppercase;letter-spacing:.005em}' : ''}` : '';
  const px = (v, lo, hi) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : null; };
  const ts = px(S.titleSize, 30, 160), bs = px(S.bodySize, 22, 70), lg = px(S.lineGap, 0, 80);
  const col = (v) => (/^#[0-9a-f]{3,8}$/i.test(v || '') ? v : null);
  const userCss = [
    col(S.titleColor) ? `h1,h2,.big,.th h1,.th h2{color:${col(S.titleColor)}!important}` : '',
    col(S.bodyColor) ? `p,li,.ln,.small,.th p,.th li{color:${col(S.bodyColor)}!important;opacity:1!important}` : '',
    ts ? `h1,h2{font-size:${ts}px!important}` : '',
    bs ? `p,li,.ln,.small{font-size:${bs}px!important}` : '',
    lg != null ? `.ln{margin-top:${lg}px!important}.gap{height:${lg + 6}px!important}li{margin-top:0}ul{gap:${lg + 6}px!important}p{line-height:${(1.2 + lg / 60).toFixed(2)}!important}` : '',
    `.pillt{display:inline-block;background:${col(S.pillColor) || (T && T.accent2) || '#F26A1B'};color:${col(S.pillTextColor) || '#fff'};font-weight:800;padding:.04em .45em;border-radius:.45em;line-height:1.3;-webkit-box-decoration-break:clone;box-decoration-break:clone}`,
  ].join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}${layoutCss}${ptCss}${userCss}</style></head><body${bodyCls}>${inner}${teaser}</body></html>`;
}

const [specPath, outDir] = process.argv.slice(2);
if (!specPath || !outDir) { console.error('usage: node render.mjs <spec.json> <outDir>'); process.exit(1); }
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
globalThis.SPEC_DIR = path.dirname(path.resolve(specPath));
globalThis.SPEC_STYLE = spec.style || null;
globalThis.TEMPLATE = ['guide', 'math', 'verdict'].includes(spec.template) ? spec.template : null;
globalThis.PT = spec.photoTheme || null; // { ink:'#RRGGBB', accent, accent2, tagText, font, upper }
fs.mkdirSync(outDir, { recursive: true });
const handle = brand.handle; // one handle on every slide, for both accounts (owner rule 2026-10-13): never the per-spec value

// one Gemini call: concrete slide-specific search queries (added in front of the vocabulary queries)
let aiQ = {};
if (!process.argv.includes('--no-judge') && !process.argv.includes('--keep-photos')) { try { aiQ = await suggestQueries(spec.slides, spec.topic || spec.slides[0]?.title || ''); } catch (e) { console.error('[render] query suggestions unavailable:', e.message.slice(0, 80)); } }

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
const files = [];
const onlyArg = process.argv.indexOf('--only'); const only = onlyArg > 0 ? Number(process.argv[onlyArg + 1]) - 1 : -1;
for (let i = 0; i < spec.slides.length; i++) {
  if (only >= 0 && i !== only) { files.push(path.join(outDir, `slide_${String(i + 1).padStart(2, '0')}.jpg`)); continue; }
  const s = spec.slides[i]; if (spec.font && !s.font) s.font = spec.font;
  globalThis.PILLS = [...(spec.style?.pills || []), ...(s.style?.pills || [])];
  let imgFile = null;
  const q = s.imageQueries || s.imageQuery || s.imagePrompt; const fileN = path.join(outDir, `img_${String(i + 1).padStart(2, '0')}.jpg`);
  const wantsPhoto = s.photo !== false && !s.layout;
  if (wantsPhoto && process.argv.includes('--keep-photos')) imgFile = fs.existsSync(fileN) ? fileN : null; // re-render only: reuse the photos already chosen, no new picks, no Gemini
  else if (wantsPhoto && s.imageId) imgFile = await getPhotoById(s.imageId, fileN);
  else if (wantsPhoto && q) {
    const judged = process.argv.includes('--no-judge') || s.imageSkip ? undefined : (fs.existsSync(fileN) && !fs.existsSync(fileN + '.nophoto') ? fileN : await getJudgedPhoto(s, spec.topic || spec.slides[0]?.title || '', [...(aiQ[i] || []), ...(Array.isArray(q) ? q : [q])], fileN, s.type === 'cover' || s.type === 'cta'));
    if (judged) imgFile = judged;
    else if (judged === null) { fs.writeFileSync(fileN + '.nophoto', '1'); imgFile = null; }
    else imgFile = await getPhoto(q, fileN, s.type === 'cover' || s.type === 'cta', s.imageSkip || 0);
  }
  await page.setContent(slideHtml(s, i, spec.slides.length, handle, imgFile), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => { /* autoFit */
    for (const w of document.querySelectorAll('.wrap')) {
      if (getComputedStyle(w).bottom === 'auto') continue;
      const grow = (sel, min, step) => { for (const el of w.querySelectorAll(sel)) { const fs0 = parseFloat(getComputedStyle(el).fontSize); if (fs0 > min) el.style.setProperty('font-size', Math.max(min, fs0 * step) + 'px', 'important'); } };
      for (let it = 0; it < 30 && w.scrollHeight > w.clientHeight + 2; it++) {
        // phase 1: shrink the big number and headings first (keep body text readable); phase 2: body text, never below 30px
        if (it < 14) { grow('.big', 100, 0.94); grow('h1,h2', 66, 0.96); } else { grow('p,li,.ln,.small,.it,.row', 30, 0.96); grow('h1,h2', 54, 0.96); }
      }
    }
  });
  const f = path.join(outDir, `slide_${String(i + 1).padStart(2, '0')}.jpg`);
  await page.screenshot({ path: f, type: 'jpeg', quality: 92 });
  files.push(f);
}
await browser.close();
console.log(JSON.stringify(files));

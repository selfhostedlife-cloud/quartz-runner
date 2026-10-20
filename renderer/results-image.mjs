// Results chart image for one account: bars of 24h views per post, the account's normal level and the 50K goal,
// growth curves (6h -> 24h -> 72h -> 7d) and what the learning model changed.
// Each post has ONE neon colour (results-data.mjs): the same colour is used for its bar, its curve and its cover frame.
// Usage: node results-image.mjs <main|test> <out.png>
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { rd, esc, k, handleOf, loadRows, baselineOf, tile, BASE_CSS, nowIst } from './results-data.mjs';

const [acct, outFile] = process.argv.slice(2);
if (!['main', 'test'].includes(acct) || !outFile) { console.error('usage: node results-image.mjs <main|test> <out.png>'); process.exit(1); }
const live = rd('playbook-live.json', null);
const baseline = baselineOf(acct);
const GOAL = 50000;

const rows = loadRows(acct).slice(-8);
const base = baseline.views || 0;
const finished = rows.filter((r) => r.v24 != null);
const best = finished.reduce((b, r) => (r.v24 > (b?.v24 || 0) ? r : b), null);
const PLOT = 300, BARMAX = 250; // plot height / tallest bar (px); leaves room for the value label above the bar
const maxBar = Math.max(base * 1.3, ...finished.map((r) => r.v24), ...rows.map((r) => r.snaps[0]?.views || 0), 100);
const hpx = (v) => Math.max(6, Math.round((v / maxBar) * BARMAX));

// ---- bar chart: fixed plot area, bars grow from the bottom, labels sit in a separate row so nothing can overlap ----
const cols = rows.map((r) => {
  const provisional = r.v24 == null;
  const v = provisional ? r.snaps[r.snaps.length - 1].views : r.v24;
  const bg = provisional ? `repeating-linear-gradient(45deg,${r.col},${r.col} 9px,rgba(0,0,0,.55) 9px,rgba(0,0,0,.55) 18px)` : r.col;
  return `<div class="bc"><div class="val" style="color:${r.col}">${k(v)}${provisional ? '*' : ''}</div><div class="bar" style="height:${hpx(v)}px;background:${bg};box-shadow:0 0 22px ${r.col}55"></div></div>`;
}).join('');
const labels = rows.map((r) => `<div class="lb">${tile(r, 60)}<div class="no" style="color:${r.col}">#${r.no}</div><div class="kw">${esc(r.kw.slice(0, 11))}</div></div>`).join('');
const baseY = base ? Math.round((base / maxBar) * BARMAX) : null;
const barsHtml = rows.length
  ? `<div class="plotwrap"><div class="plot">${cols}${baseY != null ? `<div class="baseline" style="bottom:${baseY}px"><span>your normal ${k(base)}</span></div>` : ''}</div><div class="labs">${labels}</div></div>`
  : '<div class="empty">No results for this account yet. Charts fill in once the first post has run for 24 hours.</div>';

// ---- growth curves (SVG), same colours; labels live in the right margin and are spread so they never collide ----
const curveRows = rows.filter((r) => r.snaps.length >= 2).slice(-5);
const LBL = ['6h', '24h', '72h', '7d'];
const W = 1100, H = 320, padL = 70, padR = 190, padT = 20, padB = 42;
const cmax = Math.max(...curveRows.flatMap((r) => r.snaps.map((s) => s.views)), base, 100) * 1.1;
const X = (l) => padL + (LBL.indexOf(l) / 3) * (W - padL - padR);
const Y = (v) => padT + (1 - v / cmax) * (H - padT - padB);
let svg = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`;
for (let i = 0; i <= 4; i++) { const v = (cmax / 4) * i; svg += `<line x1="${padL}" x2="${W - padR}" y1="${Y(v)}" y2="${Y(v)}" stroke="#222B4D" stroke-width="1"/><text x="${padL - 10}" y="${Y(v) + 5}" fill="#9AA6CC" font-size="17" text-anchor="end">${k(v)}</text>`; }
for (const l of LBL) svg += `<text x="${X(l)}" y="${H - 12}" fill="#9AA6CC" font-size="19" text-anchor="middle">${l}</text>`;
if (base) svg += `<line x1="${padL}" x2="${W - padR}" y1="${Y(base)}" y2="${Y(base)}" stroke="#9AA6CC" stroke-dasharray="7 6" stroke-width="2"/><text x="${padL + 8}" y="${Y(base) - 8}" fill="#9AA6CC" font-size="16">your normal</text>`;
const ends = [];
curveRows.forEach((r) => {
  const pts = r.snaps.map((s) => `${X(s.l)},${Y(s.views)}`).join(' ');
  svg += `<polyline points="${pts}" fill="none" stroke="${r.col}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/>`;
  for (const s of r.snaps) svg += `<circle cx="${X(s.l)}" cy="${Y(s.views)}" r="7" fill="${r.col}" stroke="#05070F" stroke-width="2"/>`;
  const last = r.snaps[r.snaps.length - 1];
  ends.push({ r, y: Y(last.views), x: X(last.l), views: last.views });
});
ends.sort((a, b) => a.y - b.y);
let prev = -99; for (const e of ends) { e.ly = Math.max(e.y, prev + 36); prev = e.ly; }
for (const e of ends) svg += `<line x1="${e.x + 8}" y1="${e.y}" x2="${W - padR + 12}" y2="${e.ly}" stroke="${e.r.col}" stroke-opacity=".5" stroke-width="2"/>`;
svg += '</svg>';
const tags = ends.map((e) => `<div class="ctag" style="left:${W - padR + 16}px;top:${e.ly - 17}px;border-color:${e.r.col};color:${e.r.col}">#${e.r.no} ${k(e.views)}</div>`).join('');
const curveHtml = curveRows.length ? `<div class="curvewrap">${svg}${tags}</div>` : '<div class="empty">Growth curves appear once a post has two or more readings (6h, 24h, 72h, 7d).</div>';

// ---- learning panel (kept: owner likes the learning report) ----
const clip = (t, n) => { t = String(t); if (t.length <= n) return t; const c = t.slice(0, n); return c.slice(0, c.lastIndexOf(' ')).replace(/[,;:(\s]+$/, '') + '...'; };
const li = (arr) => (arr || []).slice(0, 3).map((x) => `<li>${esc(clip(x, 170))}</li>`).join('');
const learnHtml = live ? `<div class="two"><div><h3>Doing more of</h3><ul>${li(live.double_down)}</ul></div><div><h3>Stopping</h3><ul>${li(live.stop)}</ul></div></div>
  <div class="exp"><h3>Testing next</h3><ul>${(live.experiments || []).slice(0, 2).map((x) => `<li><b>${esc(x.variable)}</b>: ${esc(clip(x.hypothesis, 150))}</li>`).join('')}</ul></div>` : '<div class="empty">The learning summary appears after the first analysis.</div>';

const pct = best ? Math.min(100, Math.round((best.v24 / GOAL) * 100)) : 0;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
${BASE_CSS}
.kpis{display:flex;gap:16px;margin-top:22px}.kpi{flex:1;background:#10172E;border-radius:16px;padding:16px 20px}.kpi b{display:block;font-size:40px;font-weight:900;color:#FFE600}.kpi span{font-size:16px;color:#9AA6CC}
.goal{margin-top:18px;background:#10172E;border-radius:16px;padding:16px 20px}.track{height:24px;background:#222B4D;border-radius:12px;overflow:hidden;margin-top:10px}.fill{height:100%;background:linear-gradient(90deg,#FFE600,#39FF14);width:${pct}%}
.plotwrap{background:#10172E;border-radius:16px;padding:22px 24px 14px}
.plot{position:relative;display:flex;align-items:flex-end;gap:16px;height:${PLOT}px;border-bottom:3px solid #2E3966}
.bc{flex:1;min-width:0;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center}
.val{font-size:23px;font-weight:900;margin-bottom:6px;white-space:nowrap}.bar{width:72%;border-radius:10px 10px 0 0}
.baseline{position:absolute;left:0;right:0;border-top:3px dashed #D5DBF5;opacity:.85;pointer-events:none}.baseline span{position:absolute;right:0;top:-27px;font-size:15px;font-weight:800;color:#D5DBF5;background:#10172E;padding:0 8px}
.labs{display:flex;gap:16px;margin-top:12px}.lb{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center}.no{font-size:18px;font-weight:900;margin-top:6px}.kw{font-size:13px;color:#9AA6CC;font-weight:700;max-width:100%;overflow:hidden;white-space:nowrap}
.curvewrap{position:relative;width:1100px;height:${H}px;background:#10172E;border-radius:16px}.curvewrap svg{display:block}
.ctag{position:absolute;width:150px;background:#05070F;border:3px solid;border-radius:12px;padding:3px 10px;font-size:17px;font-weight:900;text-align:center}
.panel{background:#10172E;border-radius:16px;padding:18px 24px}.two{display:flex;gap:30px}.two>div{flex:1}ul{padding-left:20px;font-size:16px;line-height:1.4;color:#E4E9FA}li{margin-bottom:6px}.exp{margin-top:12px}
.note{font-size:14px;color:#9AA6CC;margin-top:10px}
</style></head><body>
<h1>${esc(handleOf(acct))} &mdash; results</h1><div class="sub">Updated ${nowIst()} &bull; views after 24 hours</div>
<div class="kpis"><div class="kpi"><b>${best ? k(best.v24) : '-'}</b><span>best 24h views${best ? ' (#' + best.no + ')' : ''}</span></div><div class="kpi"><b>${base ? k(base) : '-'}</b><span>your normal (median)</span></div><div class="kpi"><b>${best && base ? (best.v24 / base).toFixed(1) + 'x' : '-'}</b><span>best vs normal</span></div><div class="kpi"><b>${base ? (GOAL / base).toFixed(1) + 'x' : '-'}</b><span>needed for ${k(GOAL)}</span></div></div>
<div class="goal"><div style="display:flex;justify-content:space-between;font-size:20px"><span>Goal: ${k(GOAL)} views in 24h on one post</span><b>${pct}% reached</b></div><div class="track"><div class="fill"></div></div></div>
<h2>Views per post after 24 hours</h2>${barsHtml}
<div class="note">Each post keeps its own colour in the bars, the growth curves and the table. Striped bar with * = only an early reading so far. Dashed line = your normal.</div>
<h2>How each post grew (6h &rarr; 24h &rarr; 72h &rarr; 7d)</h2>${curveHtml}
<h2>What the system learned</h2><div class="panel">${learnHtml}</div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
fs.mkdirSync(path.dirname(outFile), { recursive: true });
await page.screenshot({ path: outFile, fullPage: true });
await browser.close();
console.log(JSON.stringify({ out: outFile, posts: rows.length }));

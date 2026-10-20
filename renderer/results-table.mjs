// Table image: the last 5 posts of one account with their first-24-hour numbers.
// Columns: Post (cover + #no + keyword), Views, Likes, Comments, Shares, Saves, Follows. Row colour = the post's colour in the chart image.
// Usage: node results-table.mjs <main|test> <out.png>
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { esc, k, handleOf, loadRows, tile, BASE_CSS, nowIst } from './results-data.mjs';

const [acct, outFile] = process.argv.slice(2);
if (!['main', 'test'].includes(acct) || !outFile) { console.error('usage: node results-table.mjs <main|test> <out.png>'); process.exit(1); }

const clip = (t, n) => { t = String(t || ''); if (t.length <= n) return t; const c = t.slice(0, n); return c.slice(0, Math.max(c.lastIndexOf(' '), 12)).replace(/[,;:(\s]+$/, '') + '...'; };
const COLS = [['views', 'Views'], ['likes', 'Likes'], ['comments', 'Comments'], ['shares', 'Shares'], ['saves', 'Saves'], ['follows', 'Follows']];
// newest first; a post with no 24h reading yet shows its latest earlier reading, marked *
const rows = loadRows(acct).slice(-5).reverse().map((r) => {
  const snap = r.h24 || r.latest; return { ...r, snap, early: !r.h24 };
});
const bestOf = Object.fromEntries(COLS.map(([key]) => [key, Math.max(...rows.filter((r) => !r.early).map((r) => Number(r.snap?.[key]) || 0), 0)]));
const cell = (r, key) => {
  const v = r.snap?.[key];
  if (v == null) return '<td class="n dim">-</td>';
  const top = !r.early && bestOf[key] > 0 && Number(v) === bestOf[key];
  return `<td class="n${top ? ' top' : ''}" ${top ? `style="color:${r.col}"` : ''}>${key === 'views' ? k(v) : Number(v).toLocaleString('en-IN')}${r.early && key === 'views' ? '<i>*</i>' : ''}</td>`;
};
const body = rows.length ? rows.map((r) => `<tr style="--c:${r.col}">
  <td class="post"><div class="pc">${tile(r, 78, 14)}<div><div class="pn" style="color:${r.col}">#${r.no}</div><div class="pk">${esc(r.kw.slice(0, 14))}</div><div class="ph">${esc(clip(r.hook, 54))}</div></div></div></td>
  ${COLS.map(([key]) => cell(r, key)).join('')}</tr>`).join('') : '';

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
${BASE_CSS}
body{padding-bottom:30px}
table{width:100%;border-collapse:separate;border-spacing:0 10px;margin-top:20px}
th{font-size:18px;font-weight:900;color:#05070F;background:#FFE600;padding:14px 10px;text-align:right;letter-spacing:.02em}
th:first-child{text-align:left;border-radius:14px 0 0 14px;padding-left:20px}th:last-child{border-radius:0 14px 14px 0}
td{background:#10172E;padding:10px;vertical-align:middle}
td:first-child{border-radius:14px 0 0 14px;border-left:10px solid var(--c)}td:last-child{border-radius:0 14px 14px 0}
td.n{text-align:right;font-size:32px;font-weight:900;white-space:nowrap}td.n.dim{color:#5A6692}td.n i{font-style:normal;color:#9AA6CC;font-size:22px;margin-left:2px}
td.top{text-shadow:0 0 14px currentColor}
.post{width:330px}.pc{display:flex;gap:14px;align-items:center}.pn{font-size:26px;font-weight:900}.pk{font-size:17px;font-weight:800;color:#D5DBF5}.ph{font-size:13px;color:#9AA6CC;margin-top:2px;max-width:200px;line-height:1.25}
.note{font-size:14px;color:#9AA6CC;margin-top:6px}
</style></head><body>
<h1>${esc(handleOf(acct))} &mdash; last 5 posts</h1><div class="sub">First 24 hours of each post &bull; updated ${nowIst()}</div>
${rows.length ? `<table><thead><tr><th>Post</th>${COLS.map(([, l]) => `<th>${l}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>
<div class="note">The best number in each column glows in that post's colour (same colours as the chart image). * = the 24-hour reading is not in yet, early reading shown. - = not reported.</div>` : '<div class="empty">No posts with results for this account yet. The table fills in after the first post has run for 24 hours.</div>'}
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 700 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
fs.mkdirSync(path.dirname(outFile), { recursive: true });
await page.screenshot({ path: outFile, fullPage: true });
await browser.close();
console.log(JSON.stringify({ out: outFile, posts: rows.length }));

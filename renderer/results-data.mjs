// Shared data + colours for the results images (results-image.mjs = bars + curves, results-table.mjs = last-5 table).
// Every post gets ONE neon colour from its post number; the bar, its growth curve and its table row all use it.
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = process.env.IG_ROOT || 'C:/Users/smfab/ig-automation';
export const dataDir = ROOT + '/studio/data';
export const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8')); } catch { return d; } };

export const PALETTE = ['#FFE600', '#39FF14', '#FF6A00', '#2D8CFF', '#B026FF', '#FF2D2D', '#00F0FF', '#FFFFFF'];
export const colorFor = (no) => PALETTE[Math.abs(Number(no) || 0) % PALETTE.length];
export const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const k = (n) => (n == null ? '-' : n >= 10000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, '') + 'K' : n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K' : String(Math.round(n)));
export const fixHook = (t) => String(t || '').replace(/â‚¹/g, 'Rs ').replace(/\s+/g, ' ').trim();
export const handleOf = (acct) => (acct === 'main' ? '@faizanali.shahji' : '@exportimportwithfaizan');

// cover as a data URI; '' when the file is gone (pruned or never rendered here) so callers draw a coloured tile instead of a broken image
export function thumb(p) {
  try { return 'data:image/jpeg;base64,' + fs.readFileSync(path.join(p.dir, 'slide_01.jpg')).toString('base64'); } catch { return ''; }
}
export const tile = (r, size, radius = 12) => (r.img
  ? `<img src="${r.img}" style="width:${size}px;height:${size}px;object-fit:cover;border-radius:${radius}px;border:3px solid ${r.col};display:block">`
  : `<div style="width:${size}px;height:${size}px;border-radius:${radius}px;border:3px solid ${r.col};background:#1B2447;color:${r.col};font:900 ${Math.round(size * 0.42)}px Inter,Arial,sans-serif;display:flex;align-items:center;justify-content:center">${esc(String(r.kw || '#').slice(0, 1).toUpperCase())}</div>`);

const SNAPS = [['6h', 'h6'], ['24h', 'h24'], ['72h', 'h72'], ['7d', 'd7']];

// posts that have numbers for this account, oldest -> newest
export function loadRows(acct) {
  const state = rd('state.json', { posts: [] });
  return state.posts.map((p) => {
    const m = p.metrics?.[acct] || {};
    const snaps = SNAPS.filter(([, key]) => m[key] && m[key].views != null).map(([l, key]) => ({ l, ...m[key] }));
    const e = (p.buffer || []).find((x) => String(x.account).startsWith(acct));
    const h24 = m.h24 || null;
    const latest = snaps[snaps.length - 1] || null;
    return {
      no: p.no, kw: String(p.keyword || ''), hook: fixHook(p.hook), topic: p.topic || '', when: e?.dueAt || p.dueAt || '',
      col: colorFor(p.no), snaps, h24, latest, v24: m.h24?.views ?? m.h72?.views ?? m.d7?.views ?? null, img: thumb(p),
    };
  }).filter((r) => r.snaps.length).sort((a, b) => a.no - b.no);
}

export function baselineOf(acct) {
  const model = rd('learning-model.json', null);
  return (model?.baseline || rd('learnings.json', {}).baseline || {})[acct] || {};
}

export const BASE_CSS = `*{box-sizing:border-box;margin:0;padding:0}body{width:1200px;background:#05070F;color:#fff;font-family:Inter,'Segoe UI',Arial,sans-serif;padding:36px 50px 40px}
h1{font-size:44px;font-weight:900;letter-spacing:.005em}h2{font-size:28px;font-weight:900;margin:34px 0 14px;color:#FFE600;letter-spacing:.01em}h3{font-size:20px;margin-bottom:8px;color:#D5DBF5}
.sub{color:#9AA6CC;font-size:20px;margin-top:6px}.empty{background:#10172E;border-radius:16px;padding:26px;color:#9AA6CC;font-size:19px}`;

export function nowIst() { return new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) + ' IST'; }

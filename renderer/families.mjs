// Blueprint families (1080x1350) built from the owner's reference screenshots, 2026-10-21.
//   panel : hero photo + yellow condensed title; list slides = photo on top, yellow label pill, black numbered rows   (govt schemes / 10 products / Africa / 100 products)
//   case  : photo card on top, yellow label pill, black bullet panel                                                  (paper bag / banana fibre / finance)
//   guide : light infographic, white cards with numbered badges + icon chips, tip bar                                  (documents guide / UK posts)
//   table : blurred B&W backdrop, boxed white/black table rows with the portal URL                                     (portals)
// Every family keeps the owner's rules: handle (top-left) + swipe pill (top-right), gold footer line + "Follow my account..." line, CTA = cine CTA (avatar + comment box + hanging PDF snap).
import { FONT_IMPORT } from './layouts.mjs';
import { cineHtml, cineCss, topbar, topShade, mk, esc, fitSize, GLYPH, FOLLOW } from './cinema.mjs';

const YEL = '#FFD400';
const base = (H, extra = '') => `${cineCss(H)}
.yel{font-family:Anton,Impact,sans-serif;text-transform:uppercase;letter-spacing:.01em;line-height:1.02;color:${YEL};text-shadow:0 4px 14px rgba(0,0,0,.85)}
.pill{display:inline-block;background:${YEL};color:#111;font-family:Anton,Impact,sans-serif;text-transform:uppercase;letter-spacing:.01em;line-height:1;padding:12px 26px 10px;border-radius:10px;box-shadow:0 6px 18px rgba(0,0,0,.55)}
${extra}`;
const page = (H, inner, extra = '') => `<!doctype html><html><head><meta charset="utf-8"><style>${base(H, extra)}</style></head><body>${inner}</body></html>`;
const foot = (light) => `<div class="foot"><div class="shine"></div><div class="tx2" style="${light ? 'color:#2a3350' : ''}">${FOLLOW}</div></div>`;
const bgPhoto = (bg, h, filter = '') => `<div class="photo" style="height:${h}px;${bg ? `background-image:url(${bg})` : 'background:linear-gradient(135deg,#222,#000)'};${filter}"></div>`;

// ---------- panel ----------
function panel(s, i, total, handle, bg, H) {
  if (s.type === 'cover') {
    const lines = String(s.title || '').split('\n');
    const cl = s._collage || null;
    const tiles = cl ? [[0, 70, 640, 560], [440, 60, 640, 540], [150, 330, 780, 540], [0, 520, 470, 400], [610, 500, 470, 420], [330, 120, 420, 360]] : [];
    const collage = cl ? `<div style="position:absolute;inset:0;background:#05080d"></div>${tiles.map((t, k) => `<div style="position:absolute;left:${t[0]}px;top:${t[1]}px;width:${t[2]}px;height:${t[3]}px;background:url(${cl[k % cl.length]}) center/cover;filter:contrast(1.12) saturate(1.1) brightness(.92);-webkit-mask-image:radial-gradient(ellipse at center,#000 38%,rgba(0,0,0,.65) 58%,transparent 82%);mask-image:radial-gradient(ellipse at center,#000 38%,rgba(0,0,0,.65) 58%,transparent 82%)"></div>`).join('')}<div style="position:absolute;inset:0;background:linear-gradient(135deg,rgba(0,110,140,.30),rgba(255,140,40,.20));mix-blend-mode:soft-light"></div><div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 38%,rgba(0,0,0,0) 40%,rgba(0,0,0,.55) 100%)"></div>` : '';
    return page(H, `${cl ? collage : bgPhoto(bg, H)}<div class="fade" style="top:0;height:${H}px;background:linear-gradient(180deg,rgba(0,0,0,.25) 0%,rgba(0,0,0,0) 28%,rgba(0,0,0,.55) 52%,rgba(0,0,0,.94) 78%,#000 100%)"></div><div class="vig"></div>${topShade}${topbar(handle)}
      <div style="position:absolute;left:30px;right:30px;bottom:150px;text-align:center">
        ${lines.map((l) => { const w = l.startsWith('^'); const t = w ? l.slice(1) : l; return `<div class="${w ? 'white' : 'yel'}" style="font-size:${fitSize(t, w ? 104 : 128, 1010)}px;white-space:nowrap">${esc(t)}</div>`; }).join('')}
        ${s.sub ? `<div class="shine" style="margin:20px 90px"></div><div style="font-size:40px;font-weight:700;line-height:1.22">${mk(s.sub)}</div>` : ''}
      </div>${foot()}`);
  }
  if (s.type === 'grid') { // long numbered list in two columns
    const items = s.items || []; const half = Math.ceil(items.length / 2);
    const col = (arr, off) => arr.map((t, k) => `<div style="display:flex;gap:10px;font-size:${s.fs || 33}px;line-height:1.16;margin-bottom:${s.gap || 9}px"><b style="color:${YEL};flex:none;min-width:48px">${off + k + 1}.</b><span style="font-weight:600">${esc(t)}</span></div>`).join('');
    return page(H, `${bgPhoto(bg, 470)}<div class="fade" style="top:170px;height:310px;background:linear-gradient(180deg,rgba(0,0,0,0),#000)"></div><div class="vig"></div>${topShade}${topbar(handle)}
      <div style="position:absolute;left:44px;top:395px"><span class="pill" style="font-size:56px">${esc(s.label)}</span></div>
      <div style="position:absolute;left:50px;right:40px;top:495px;display:flex;gap:26px"><div style="flex:1">${col(items.slice(0, half), 0)}</div><div style="flex:1">${col(items.slice(half), half)}</div></div>
      ${s.note ? `<div class="yel" style="position:absolute;left:44px;right:44px;top:1140px;font-size:38px;text-align:center">${esc(s.note)}</div>` : ''}${foot()}`);
  }
  // list
  const items = s.items || []; const n = Math.max(items.length, 1);
  const f = n <= 2 ? [70, 46] : n === 3 ? [62, 42] : n === 4 ? [52, 36] : [46, 33];
  const rows = items.map((it) => `<div><div style="font-weight:800;font-size:${f[0]}px;line-height:1.12"><span style="color:${YEL}">${esc(it.n)}</span> ${esc(it.name)}${it.emoji ? ' ' + it.emoji : ''}</div>${it.tag ? `<div style="font-size:${f[1]}px;color:${YEL};font-weight:600;margin-top:4px">${esc(it.tag)}</div>` : ''}</div>`);
  const top = 700;
  return page(H, `${bgPhoto(bg, 740)}<div class="fade" style="top:420px;height:330px;background:linear-gradient(180deg,rgba(0,0,0,0),#000 92%)"></div><div class="vig"></div>${topShade}${topbar(handle)}
    <div style="position:absolute;left:44px;top:${top - 105}px"><span class="pill" style="font-size:60px">${esc(s.label)}</span></div>
    <div style="position:absolute;left:50px;right:50px;top:${top}px;bottom:${H - 1200}px;display:flex;flex-direction:column;justify-content:space-between">${rows.join('<div class="shine"></div>')}</div>${foot()}`);
}

// ---------- case ----------
function caseF(s, i, total, handle, bg, H) {
  if (s.type === 'cover') return panel(s, i, total, handle, bg, H);
  const bl = s.bullets || []; const n = Math.max(bl.length, 1);
  let fs = n <= 3 ? 52 : n === 4 ? 46 : n === 5 ? 41 : 36;
  const plain = (t) => String(t).replace(/\*\*|==|!!|\+\+/g, '');
  const need = (f) => bl.reduce((a, t) => a + Math.ceil(plain(t).length * f * 0.54 / 900) * f * 1.24, 0) + (n - 1) * 26; // long answers (scheme what/who/how): shrink until the rows fit the box
  while (fs > 32 && need(fs) > 430) fs -= 1;
  const rows = bl.map((t) => `<div style="display:flex;gap:20px;align-items:flex-start"><span style="flex:none;width:16px;height:16px;margin-top:${Math.round(fs * 0.45)}px;border-radius:50%;background:${YEL};box-shadow:0 0 10px rgba(255,212,0,.7)"></span><div style="font-size:${fs}px;line-height:1.24;font-weight:600">${mk(t)}</div></div>`);
  return page(H, `${topbar(handle)}
    <div style="position:absolute;left:40px;right:40px;top:122px;height:500px;border-radius:24px;overflow:hidden;border:5px solid #fff;box-shadow:0 12px 40px rgba(0,0,0,.7);${bg ? `background:url(${bg}) center/cover` : 'background:#222'};filter:contrast(1.08) saturate(1.12)"></div>
    <div style="position:absolute;left:40px;top:660px"><span class="pill" style="font-size:60px">${esc(s.label)}</span></div>
    <div style="position:absolute;left:46px;right:46px;top:770px;bottom:${H - 1205}px;display:flex;flex-direction:column;justify-content:space-between">${rows.join('')}</div>${foot()}`, 'b.g{color:#FFD400}');
}

// ---------- guide (light) ----------
const BADGE = ['#E8453C', '#1D74F5', '#F5A300', '#16A34A', '#8B5CF6', '#0EA5A5'];
function guide(s, i, total, handle, bg, H) {
  const lt = `.lt{background:#F1F4FB;color:#0B1B3A}.lt .hd{color:#0B1B3A;text-shadow:none}.lt .tx2{color:#2a3350}`;
  const bar = `<div class="top"><span class="hd" style="color:#0B1B3A;text-shadow:none">${esc(handle)}</span>${s.type === 'cover' ? '<span class="swipe" style="background:#0B1B3A;color:#FFD400">swipe &rarr;</span>' : '<span class="swipe" style="background:#0B1B3A;color:#FFD400">swipe &rarr;</span>'}</div>`;
  const hl = (t) => `<span style="background:linear-gradient(transparent 60%,${YEL} 60%);padding:0 6px">${esc(t)}</span>`;
  if (s.type === 'cover') {
    return page(H, `${bgPhoto(bg, 780, 'filter:contrast(1.05) saturate(1.1) brightness(.9)')}<div class="fade" style="top:0;height:200px;background:linear-gradient(180deg,rgba(0,0,0,.65),rgba(0,0,0,0))"></div>
      <div class="top"><span class="hd">${esc(handle)}</span><span class="swipe">swipe &rarr;</span></div>
      <div style="position:absolute;left:36px;right:36px;top:620px;bottom:120px;background:#fff;border-radius:30px;box-shadow:0 18px 50px rgba(0,0,0,.55);padding:36px 40px;color:#0B1B3A">
        ${String(s.title).split('\n').map((l) => `<div style="font-family:Anton,Impact,sans-serif;text-transform:uppercase;font-size:${fitSize(l, 124, 920)}px;line-height:1.08;white-space:nowrap">${hl(l)}</div>`).join('')}
        <div style="font-size:42px;line-height:1.28;color:#44506B;margin-top:24px;font-weight:600">${mk(s.sub || '')}</div>
        <div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:26px">${(s.chips || []).map((c, k) => `<span style="font-size:33px;font-weight:800;background:${BADGE[k % 6]}22;color:${BADGE[k % 6]};padding:12px 24px;border-radius:40px">${esc(c)}</span>`).join('')}</div>
      </div>${foot()}`, '.foot .tx2{color:#fff}');
  }
  const items = s.items || []; const n = Math.max(items.length, 1);
  const f = n <= 2 ? [56, 38, 32] : n === 3 ? [50, 35, 30] : n === 4 ? [45, 32, 28] : [40, 29, 26];
  const rows = items.map((it, k) => `<div style="display:flex;align-items:center;gap:22px;background:#fff;border-radius:26px;padding:16px 22px;box-shadow:0 6px 22px rgba(20,40,90,.12);flex:1;min-height:0">
      <div style="flex:none;width:84px;height:84px;border-radius:50%;background:${BADGE[k % 6]};color:#fff;font-family:Anton,Impact,sans-serif;font-size:50px;display:flex;align-items:center;justify-content:center">${esc(it.n || k + 1)}</div>
      <div style="flex:1;min-width:0"><div style="font-weight:800;font-size:${f[0]}px;line-height:1.14;color:#0B1B3A">${esc(it.name)}</div>${it.desc ? `<div style="font-size:${f[1]}px;line-height:1.22;color:#44506B;margin-top:3px">${esc(it.desc)}</div>` : ''}${it.url ? `<div style="font-size:${f[2]}px;color:#1D5FD1;font-weight:700;margin-top:3px">${esc(it.url)}</div>` : ''}</div>
      <div style="flex:none;width:96px;height:96px;border-radius:24px;background:${BADGE[k % 6]}1c;display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 48 48" width="64" height="64" fill="none" stroke="${BADGE[k % 6]}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${GLYPH[it.icon || s.icon] || GLYPH.globe}</svg></div></div>`).join('');
  return page(H, `${bar}
    <div style="position:absolute;left:40px;right:40px;top:122px;text-align:center">${String(s.title).split('\n').map((l) => `<div style="font-family:Anton,Impact,sans-serif;text-transform:uppercase;font-size:${fitSize(l, 100, 960)}px;line-height:1.08;white-space:nowrap">${hl(l)}</div>`).join('')}${s.sub ? `<div style="font-size:36px;color:#44506B;margin-top:10px;font-weight:600">${esc(s.sub)}</div>` : ''}</div>
    <div style="position:absolute;left:40px;right:40px;top:${s.sub ? 318 : 270}px;bottom:${s.note ? 232 : 150}px;display:flex;flex-direction:column;gap:16px">${rows}</div>
    ${s.note ? `<div style="position:absolute;left:40px;right:40px;bottom:142px;height:74px;background:#FFF3C4;border-radius:18px;display:flex;align-items:center;padding:0 26px;font-size:30px;font-weight:700;color:#5b4300;line-height:1.15">${esc(s.note)}</div>` : ''}${foot(true)}`, `${lt} body{background:#F1F4FB;color:#0B1B3A}.hd{color:#0B1B3A}`);
}

// ---------- table ----------
function table(s, i, total, handle, bg, H) {
  if (s.type === 'cover') return panel(s, i, total, handle, bg, H);
  const en = s.entries || [];
  const rows = en.map((e) => `<div style="border:4px solid #fff;background:#000;flex:1;display:flex;flex-direction:column;min-height:0">
      <div style="background:#fff;color:#000;font-family:Anton,Impact,sans-serif;text-transform:uppercase;font-size:${e.hf || 46}px;padding:8px 16px 5px;letter-spacing:.01em;white-space:nowrap">${esc(e.name)}</div>
      <div style="display:flex;flex:1;min-height:0"><div style="flex:1.25;padding:12px 18px;font-size:35px;line-height:1.2;font-weight:600;border-right:4px solid #fff;display:flex;align-items:center">${esc(e.desc)}</div>
      <div style="flex:1;padding:12px 16px;font-size:33px;font-weight:800;text-decoration:underline;display:flex;align-items:center;word-break:break-all;line-height:1.2">${esc(e.url)}</div></div></div>`).join('');
  return page(H, `<div class="photo" style="height:${H}px;${bg ? `background-image:url(${bg})` : ''};filter:grayscale(1) blur(9px) brightness(.45) contrast(1.1);transform:scale(1.08)"></div>${topbar(handle)}
    <div style="position:absolute;left:44px;right:44px;top:120px"><div style="font-family:Anton,Impact,sans-serif;text-transform:uppercase;font-size:${fitSize(s.title, 64, 990)}px;white-space:nowrap">${esc(s.title)}</div><div class="shine" style="margin-top:10px"></div></div>
    <div style="position:absolute;left:44px;right:44px;top:205px;bottom:${H - 1200}px;display:flex;flex-direction:column;gap:20px">${rows}</div>${foot()}`);
}

export const FAMILIES = {
  panel, case: caseF, guide, table,
  cine: (s, i, total, handle, bg, H, ctx) => cineHtml(s, i, total, handle, bg, ctx.avatar, H, ctx.pdf),
};

export function familyHtml(family, s, i, total, ctx) {
  const H = ctx.H || 1350;
  if (s.type === 'cta') return cineHtml(s, i, total, ctx.handle, ctx.bg, ctx.avatar, H, ctx.pdf);
  return (FAMILIES[family] || panel)(s, i, total, ctx.handle, ctx.bg, H, ctx);
}

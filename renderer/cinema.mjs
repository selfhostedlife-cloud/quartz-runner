// "cine" template (4:5, 1080x1350): built from the owner's reference blueprint "How to find buyers in Spain" (2026-10-21).
// Look: black canvas, one real cinematic photo that fades into black, condensed gold-gradient headline, white diamond-bullet list rows
// with a gold url line, gold "swipe" pill + handle in the footer, last slide = avatar circle + comment box.
// Slide types: cover {title, sub} | list {title, items:[{name, desc, url}]} | contact {title, rows:[{icon, label, value}]} | cta {title, text, button}
// spec.template = 'cine'; spec.height = 1350. Photos come from the normal photo step (imageId / imageQueries) as data URIs.
import { FONT_IMPORT } from './layouts.mjs';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// ==word== = gold inside a white sentence, **word** the same
const mk = (s) => esc(s).replace(/(\*\*|==)(.+?)\1/g, '<b class="g">$2</b>');
const fitSize = (t, max) => Math.max(60, Math.min(max, Math.floor(1000 / (Math.max(String(t).length, 1) * 0.47))));
const GOLD = 'linear-gradient(180deg,#FFF2A8 0%,#FFD43B 38%,#E8A317 72%,#B97A0B 100%)';

const css = (H) => `${FONT_IMPORT}
*{box-sizing:border-box;margin:0;padding:0}
body{width:1080px;height:${H}px;background:#000;color:#fff;font-family:Inter,'Segoe UI',Arial,sans-serif;position:relative;overflow:hidden}
.photo{position:absolute;left:0;right:0;top:0;background-size:cover;background-position:center;filter:contrast(1.1) saturate(1.18) brightness(.96)}
.fade{position:absolute;left:0;right:0;pointer-events:none}
.vig{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 38%,rgba(255,170,60,.10) 0%,rgba(0,0,0,0) 55%,rgba(0,0,0,.45) 100%)}
.gold{font-family:Anton,'Bebas Neue',Impact,sans-serif;text-transform:uppercase;letter-spacing:.012em;line-height:1.02;background:${GOLD};-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent;filter:drop-shadow(0 4px 10px rgba(0,0,0,.75))}
.white{font-family:Anton,'Bebas Neue',Impact,sans-serif;text-transform:uppercase;letter-spacing:.012em;line-height:1.02;color:#fff;text-shadow:0 4px 14px rgba(0,0,0,.8)}
b.g{color:#FFD43B;font-weight:800}
.rule{height:3px;background:linear-gradient(90deg,transparent,#FFD43B,transparent);box-shadow:0 0 14px rgba(255,212,59,.7)}
.row{display:flex;gap:22px;align-items:flex-start}
.dia{flex:none;width:20px;height:20px;background:#fff;transform:rotate(45deg);margin-top:15px;box-shadow:0 0 10px rgba(255,255,255,.55)}
.nm{font-weight:800;font-size:40px;line-height:1.15;color:#FFD43B}
.ds{font-size:27px;line-height:1.28;color:#E8E8E8;margin-top:3px}
.ur{font-size:24px;color:#9AA4B8;margin-top:3px;letter-spacing:.01em}
.foot{position:absolute;left:48px;right:48px;bottom:34px;display:flex;justify-content:space-between;align-items:center}
.swipe{background:linear-gradient(180deg,#FFD43B,#D99A12);color:#111;font-weight:800;font-size:26px;padding:9px 30px;border-radius:30px;box-shadow:0 4px 16px rgba(0,0,0,.6)}
.hd{font-size:24px;color:#cfcfcf;font-weight:600}
`;

const foot = (handle, last) => `<div class="foot">${last ? '<span></span>' : '<span class="swipe">swipe &rarr;</span>'}<span class="hd">${esc(handle)}</span></div>`;

export function cineHtml(s, i, total, handle, bg, avatar, H = 1350) {
  const photo = (h) => `<div class="photo" style="height:${h}px;${bg ? `background-image:url(${bg})` : 'background:linear-gradient(135deg,#222,#000)'}"></div><div class="fade" style="top:${Math.round(h * 0.45)}px;height:${Math.round(h * 0.56)}px;background:linear-gradient(180deg,rgba(0,0,0,0) 0%,rgba(0,0,0,.82) 62%,#000 100%)"></div><div class="vig"></div>`;
  let inner = '';

  if (s.type === 'cover') {
    const lines = String(s.title || '').split('\n');
    inner = `${photo(1010)}
      <div style="position:absolute;left:44px;right:44px;top:780px;text-align:center">
        ${lines.map((l, n) => `<div class="${n === 0 ? 'white' : 'gold'}" style="font-size:${n === 0 ? 124 : 134}px">${esc(l)}</div>`).join('')}
        <div class="rule" style="margin:24px 90px 22px"></div>
        <div style="font-size:35px;font-weight:700;line-height:1.25;color:#fff">${mk(s.sub || '')}</div>
      </div>${foot(handle)}`;
  } else if (s.type === 'list') {
    const items = s.items || []; const n = Math.max(items.length, 1);
    const big = n <= 4; const top = big ? 640 : 620;
    inner = `${photo(560)}
      <div style="position:absolute;left:40px;right:40px;top:455px;text-align:center"><div class="gold" style="font-size:${fitSize(s.title, 104)}px;white-space:nowrap">${esc(s.title)}</div><div class="rule" style="margin:14px 120px 0"></div></div>
      <div style="position:absolute;left:62px;right:62px;top:${top}px;display:flex;flex-direction:column;gap:${big ? 28 : 12}px">
        ${items.map((it) => `<div class="row"><div class="dia"></div><div><div class="nm" style="font-size:${big ? 42 : 37}px">${esc(it.name)}</div>${it.desc ? `<div class="ds" style="font-size:${big ? 28 : 25}px">${esc(it.desc)}</div>` : ''}${it.url ? `<div class="ur" style="font-size:${big ? 24 : 22}px">${esc(it.url)}</div>` : ''}</div></div>`).join('')}
      </div>${foot(handle)}`;
  } else if (s.type === 'contact') {
    inner = `${photo(700)}
      <div style="position:absolute;left:40px;right:40px;top:560px;text-align:center"><div class="gold" style="font-size:${fitSize(s.title, 112)}px;white-space:nowrap">${esc(s.title)}</div><div class="rule" style="margin:14px 120px 0"></div></div>
      <div style="position:absolute;left:62px;right:62px;top:790px;display:flex;flex-direction:column;gap:30px">
        ${(s.rows || []).map((r) => `<div class="row"><div class="dia"></div><div><div class="nm" style="font-size:36px">${esc(r.label)}</div><div class="ds" style="font-size:30px">${esc(r.value)}</div>${r.note ? `<div class="ur">${esc(r.note)}</div>` : ''}</div></div>`).join('')}
      </div>${foot(handle)}`;
  } else { // cta
    const ring = 300;
    inner = `<div class="photo" style="height:${H}px;${bg ? `background-image:url(${bg})` : ''};filter:contrast(1.1) saturate(1.15) brightness(.85)"></div><div class="vig"></div>
      <div class="fade" style="top:0;height:${H}px;background:linear-gradient(180deg,rgba(0,0,0,.10) 0%,rgba(0,0,0,.45) 42%,rgba(0,0,0,.90) 100%)"></div>
      ${avatar ? `<div style="position:absolute;left:${(1080 - ring) / 2}px;top:70px;width:${ring}px;height:${ring}px;border-radius:50%;background:url(${avatar}) -${Math.round(16 * ring / 170)}px -${Math.round(11 * ring / 170)}px/${Math.round(206 * ring / 170)}px auto no-repeat;box-shadow:0 10px 40px rgba(0,0,0,.7)"></div>` : ''}
      <div style="position:absolute;left:50px;right:50px;top:${avatar ? 410 : 200}px;text-align:center">
        <div class="gold" style="font-size:104px">${esc(s.title)}</div>
        <div style="margin-top:26px;font-size:38px;line-height:1.3;font-weight:600;color:#fff">${mk(s.text || '')}</div>
        <div style="margin:44px auto 0;display:inline-block;border:4px solid #FFD43B;border-radius:18px;padding:18px 46px;background:rgba(0,0,0,.55);box-shadow:0 0 26px rgba(255,212,59,.35)"><span class="white" style="font-size:66px">${esc(s.button || 'Comment BELOW')}</span></div>
        <div style="margin-top:30px;font-size:31px;color:#e6e6e6;font-weight:600">${mk(s.note || "I'll personally send you the details via DM.")}</div>
      </div>${foot(handle, true)}`;
  }
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css(H)}</style></head><body>${inner}</body></html>`;
}

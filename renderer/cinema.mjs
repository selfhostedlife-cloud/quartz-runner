// "cine" template (4:5, 1080x1350): built from the owner's reference blueprint "How to find buyers in Spain" (2026-10-21).
// Look: black canvas, one real cinematic photo that fades into black, condensed gold-gradient headline, white diamond-bullet rows
// separated by shining gold dividers, a glowing cloud icon at the right of each row, handle (top-left) + swipe pill (top-right),
// footer = gold line + "Follow my account" line, last slide = avatar circle + comment box with the checklist PDF snap hanging from it.
// Slide types: cover {title, sub} | list {title, icon, items:[{name, desc, url, icon?}]} | contact {title, rows:[{icon, label, value, note}]} | cta {title, text, button, note, pdfPreview}
// icons: globe | building | booth | shield.  spec.template = 'cine'; spec.height = 1350. Photos come from the normal photo step as data URIs.
import { FONT_IMPORT } from './layouts.mjs';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// ==word== = gold inside a white sentence, **word** the same
const mk = (s) => esc(s).replace(/(\*\*|==)(.+?)\1/g, '<b class="g">$2</b>');
const fitSize = (t, max, w = 1000) => Math.max(60, Math.min(max, Math.floor(w / (Math.max(String(t).length, 1) * 0.45))));
const GOLD = 'linear-gradient(180deg,#FFF2A8 0%,#FFD43B 38%,#E8A317 72%,#B97A0B 100%)';
const FOLLOW = 'Follow my account for more export business tips';

const css = (H) => `${FONT_IMPORT}
*{box-sizing:border-box;margin:0;padding:0}
body{width:1080px;height:${H}px;background:#000;color:#fff;font-family:Inter,'Segoe UI',Arial,sans-serif;position:relative;overflow:hidden}
.photo{position:absolute;left:0;right:0;top:0;background-size:cover;background-position:center;filter:contrast(1.1) saturate(1.18) brightness(.96)}
.fade{position:absolute;left:0;right:0;pointer-events:none}
.vig{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 38%,rgba(255,170,60,.10) 0%,rgba(0,0,0,0) 55%,rgba(0,0,0,.45) 100%)}
.gold{font-family:Anton,'Bebas Neue',Impact,sans-serif;text-transform:uppercase;letter-spacing:.012em;line-height:1.02;background:${GOLD};-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent;filter:drop-shadow(0 4px 10px rgba(0,0,0,.75))}
.white{font-family:Anton,'Bebas Neue',Impact,sans-serif;text-transform:uppercase;letter-spacing:.012em;line-height:1.02;color:#fff;text-shadow:0 4px 14px rgba(0,0,0,.8)}
b.g{color:#FFD43B;font-weight:800}
.shine{height:4px;flex:none;border-radius:2px;background:linear-gradient(90deg,rgba(255,212,59,0) 0%,#E8A317 18%,#FFF6C2 50%,#E8A317 82%,rgba(255,212,59,0) 100%);box-shadow:0 0 12px rgba(255,212,59,.85),0 0 28px rgba(255,190,40,.45)}
.row{display:flex;gap:24px;align-items:center}
.dia{flex:none;width:22px;height:22px;background:#fff;transform:rotate(45deg);box-shadow:0 0 12px rgba(255,255,255,.6)}
.tx{flex:1;min-width:0}
.nm{font-weight:800;line-height:1.14;color:#FFD43B}
.ds{line-height:1.25;color:#F0F0F0;margin-top:4px}
.ur{color:#A9B3C8;margin-top:4px;letter-spacing:.01em}
.cloud{flex:none;width:176px;height:122px;filter:drop-shadow(0 0 14px rgba(255,212,59,.45))}
.top{position:absolute;left:44px;right:44px;top:26px;display:flex;justify-content:space-between;align-items:center;z-index:5}
.swipe{background:linear-gradient(180deg,#FFD43B,#D99A12);color:#111;font-weight:800;font-size:52px;line-height:1;padding:16px 46px 18px;border-radius:60px;box-shadow:0 6px 22px rgba(0,0,0,.65)}
.hd{font-size:48px;color:#fff;font-weight:800;text-shadow:0 3px 12px rgba(0,0,0,.9)}
.foot{position:absolute;left:48px;right:48px;bottom:26px;text-align:center}
.foot .tx2{margin-top:14px;font-size:31px;font-weight:700;color:#F3E3A6;letter-spacing:.01em}
`;

// glowing cloud with a gold line icon inside
const GLYPH = {
  globe: '<circle cx="24" cy="24" r="17"/><ellipse cx="24" cy="24" rx="7.5" ry="17"/><path d="M7 24h34M10 14h28M10 34h28"/>',
  building: '<path d="M4 18L24 5l20 13zM8 40h32M6 44h36"/><path d="M12 20v18M20 20v18M28 20v18M36 20v18"/>',
  booth: '<path d="M5 20L9 7h30l4 13zM5 20q4.8 6 9.6 0q4.8 6 9.6 0q4.8 6 9.6 0q4.8 6 9.6 0"/><path d="M9 25v17h30V25M20 42V32h8v10"/>',
  shield: '<path d="M24 4l16 6v12c0 11-7 18-16 22C15 40 8 33 8 22V10z"/><path d="M16 24l6 6 11-12"/>',
};
const cloud = (icon) => `<svg class="cloud" viewBox="0 0 176 122"><defs><radialGradient id="cg" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#fff" stop-opacity=".30"/><stop offset="1" stop-color="#FFD43B" stop-opacity=".07"/></radialGradient></defs>
  <path d="M46 104C20 104 6 86 12 66C16 50 32 44 46 48C50 24 76 12 98 22C114 8 144 16 148 42C168 46 174 76 156 92C148 102 136 104 126 104Z" fill="url(#cg)" stroke="#FFD43B" stroke-width="3" stroke-linejoin="round"/>
  <g transform="translate(60 34) scale(1.17)" fill="none" stroke="#FFE27A" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">${GLYPH[icon] || GLYPH.globe}</g></svg>`;

const topbar = (handle, last) => `<div class="top"><span class="hd">${esc(handle)}</span>${last ? '' : '<span class="swipe">swipe &rarr;</span>'}</div>`;
const topShade = '<div class="fade" style="top:0;height:190px;background:linear-gradient(180deg,rgba(0,0,0,.7),rgba(0,0,0,0))"></div>';
const foot = () => `<div class="foot"><div class="shine"></div><div class="tx2">${FOLLOW}</div></div>`;

export function cineHtml(s, i, total, handle, bg, avatar, H = 1350, pdf = '') {
  const photo = (h) => `<div class="photo" style="height:${h}px;${bg ? `background-image:url(${bg})` : 'background:linear-gradient(135deg,#222,#000)'}"></div><div class="fade" style="top:${Math.round(h * 0.4)}px;height:${Math.round(h * 0.62)}px;background:linear-gradient(180deg,rgba(0,0,0,0) 0%,rgba(0,0,0,.82) 62%,#000 100%)"></div><div class="vig"></div>${topShade}`;
  // rows separated by shining dividers, spread evenly over the area; each row ends with a cloud icon
  const rowsBox = (top, rows) => `<div style="position:absolute;left:56px;right:36px;top:${top}px;bottom:${H - 1205}px;display:flex;flex-direction:column;justify-content:space-between">${rows.join('<div class="shine"></div>')}</div>`;
  let inner = '';

  if (s.type === 'cover') {
    const lines = String(s.title || '').split('\n');
    inner = `${photo(1010)}${topbar(handle)}
      <div style="position:absolute;left:30px;right:30px;top:735px;text-align:center">
        ${lines.map((l, n) => `<div class="${n === 0 ? 'white' : 'gold'}" style="font-size:${fitSize(l, n === 0 ? 140 : 158, 1010)}px;white-space:nowrap">${esc(l)}</div>`).join('')}
        <div class="shine" style="margin:22px 70px 22px"></div>
        <div style="font-size:44px;font-weight:700;line-height:1.22;color:#fff">${mk(s.sub || '')}</div>
      </div>${foot()}`;
  } else if (s.type === 'list') {
    const items = s.items || []; const n = Math.max(items.length, 1);
    const f = n <= 3 ? [52, 34, 30] : n === 4 ? [47, 31, 27] : [41, 28, 24];
    const rows = items.map((it) => `<div class="row"><div class="dia"></div><div class="tx"><div class="nm" style="font-size:${f[0]}px">${esc(it.name)}</div>${it.desc ? `<div class="ds" style="font-size:${f[1]}px">${esc(it.desc)}</div>` : ''}${it.url ? `<div class="ur" style="font-size:${f[2]}px">${esc(it.url)}</div>` : ''}</div>${cloud(it.icon || s.icon)}</div>`);
    inner = `${photo(540)}${topbar(handle)}
      <div style="position:absolute;left:30px;right:30px;top:372px;text-align:center"><div class="gold" style="font-size:${fitSize(s.title, 124, 1010)}px;white-space:nowrap">${esc(s.title)}</div><div class="shine" style="margin:14px 110px 0"></div></div>
      ${rowsBox(545, rows)}${foot()}`;
  } else if (s.type === 'contact') {
    const rows = (s.rows || []).map((r) => `<div class="row"><div class="dia"></div><div class="tx"><div class="nm" style="font-size:44px">${esc(r.label)}</div><div class="ds" style="font-size:34px">${esc(r.value)}</div>${r.note ? `<div class="ur" style="font-size:29px">${esc(r.note)}</div>` : ''}</div>${cloud(r.icon)}</div>`);
    inner = `${photo(600)}${topbar(handle)}
      <div style="position:absolute;left:30px;right:30px;top:432px;text-align:center"><div class="gold" style="font-size:${fitSize(s.title, 120, 1010)}px;white-space:nowrap">${esc(s.title)}</div><div class="shine" style="margin:14px 110px 0"></div></div>
      ${rowsBox(625, rows)}${foot()}`;
  } else { // cta
    const ring = 280;
    // the checklist snap hangs from a gold pin on the comment box's top-right corner
    const snap = pdf ? `<div style="position:absolute;right:-158px;top:-18px;width:160px;transform-origin:50% 0;transform:rotate(7deg)"><div style="position:absolute;left:50%;top:-10px;width:3px;height:36px;margin-left:-1px;background:#d8d8d8"></div><div style="position:absolute;left:50%;top:-24px;width:30px;height:30px;margin-left:-15px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff2a8,#E8A317 60%,#8a5a00);box-shadow:0 4px 10px rgba(0,0,0,.7);z-index:3"></div><img src="${pdf}" style="display:block;width:100%;margin-top:26px;border:5px solid #fff;border-radius:6px;box-shadow:0 14px 34px rgba(0,0,0,.75)"></div>` : '';
    inner = `<div class="photo" style="height:${H}px;${bg ? `background-image:url(${bg})` : ''};filter:contrast(1.1) saturate(1.15) brightness(.85)"></div><div class="vig"></div>
      <div class="fade" style="top:0;height:${H}px;background:linear-gradient(180deg,rgba(0,0,0,.10) 0%,rgba(0,0,0,.45) 42%,rgba(0,0,0,.90) 100%)"></div>${topbar(handle, true)}
      ${avatar ? `<div style="position:absolute;left:${(1080 - ring) / 2}px;top:105px;width:${ring}px;height:${ring}px;border-radius:50%;background:url(${avatar}) -${Math.round(16 * ring / 170)}px -${Math.round(11 * ring / 170)}px/${Math.round(206 * ring / 170)}px auto no-repeat;box-shadow:0 10px 40px rgba(0,0,0,.7)"></div>` : ''}
      <div style="position:absolute;left:46px;right:46px;top:${avatar ? 415 : 200}px;text-align:center">
        <div class="gold" style="font-size:108px">${esc(s.title)}</div>
        <div style="margin-top:22px;font-size:41px;line-height:1.28;font-weight:600;color:#fff">${mk(s.text || '')}</div>
        <div style="margin-right:168px"><div style="position:relative;margin:48px auto 0;display:inline-block;border:4px solid #FFD43B;border-radius:18px;padding:18px 44px;background:rgba(0,0,0,.55);box-shadow:0 0 26px rgba(255,212,59,.35)"><span class="white" style="font-size:60px">${esc(s.button || 'Comment BELOW')}</span>${snap}</div>
        <div style="margin-top:34px;font-size:34px;color:#e6e6e6;font-weight:600">${mk(s.note || "I'll personally send you the details via DM.").replace(/\n/g, '<br>')}</div></div>
      </div>${foot()}`;
  }
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css(H)}</style></head><body>${inner}</body></html>`;
}

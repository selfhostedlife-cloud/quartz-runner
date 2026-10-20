// Winner templates (owner's best posts, 2026-10-20): pure black, one literal hero photo, huge bold text, one or two accent colours,
// save/share/follow footer. spec.template = 'guide' (copper-scrap style) | 'math' (Rs 1 lakh order style) | 'verdict' (onion-loss cover, math inside).
// Used by render.mjs for every slide that has no `layout`.
import { FONT_IMPORT } from './layouts.mjs';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// numbers in rupees/other money, years-free percentages and weights get the accent colour automatically
const MONEY = /((?:₹|Rs\.?\s?|AED\s?|USD\s?|\$)\s?\d[\d,.]*(?:\s?(?:lakh|lakhs|crore|crores|L|Cr|K|M|\/kg|\/MT|per kg|per container))?|\b\d[\d,.]*\s?(?:%|lakh|crore|MT|kg|days|weeks)\b)/gi;
const mark = (s, auto) => {
  let h = esc(s).replace(/(\*\*|==|\+\+|!!)(.+?)\1/g, '<b class="hl">$2</b>');
  if (auto) h = h.replace(/(<b class="hl">.*?<\/b>)|((?:₹|Rs\.?\s?|AED\s?|USD\s?|\$)\s?\d[\d,.]*(?:\s?(?:lakh|lakhs|crore|crores|L|Cr|K|M|\/kg|\/MT|per kg|per container))?|\b\d[\d,.]*\s?(?:%|lakh|crore|MT|kg|days|weeks)\b)/gi, (m, a, b) => (a ? a : `<b class="hl">${b}</b>`));
  return h;
};
const lines = (s) => String(s ?? '').split('\n').map((x) => x.trim());
const splitLabel = (t) => { const m = String(t).match(/^([^:|]{2,48})[:|]\s*(.+)$/); return m ? [m[1], m[2]] : [null, t]; };

const FOOT_SAVE = (h) => `<div class="foot"><div class="save"><svg width="62" height="62" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6"><path d="M5 3h14v18l-7-5-7 5z"/></svg><span>Save this post<br>and share it</span></div><div class="fol">Follow&gt;&gt; ${esc(h)}</div></div>`;
const FOOT_LEFT = (h) => `<div class="foot2">follow: ${esc(h.replace(/^@/, ''))} &nbsp;|&nbsp; slide left &gt;&gt;&gt;</div>`;

export function winnerHtml(tpl, s, i, total, handle, bg, pdfUri) {
  const last = i === total - 1, accent = tpl === 'guide' ? '#FFC9A8' : '#FFC800';
  const css = `${FONT_IMPORT}
*{box-sizing:border-box;margin:0;padding:0}
body{width:1080px;height:1080px;background:#000;color:#fff;font-family:Inter,sans-serif;position:relative;overflow:hidden}
h1,h2{font-family:Poppins,'Archivo Black',Inter,sans-serif;font-weight:800;letter-spacing:.01em;line-height:1.14}
b.hl{color:${accent};font-weight:inherit}
.photo{position:absolute;background-size:cover;background-position:center}
.frame{left:46px;top:34px;width:988px;border:8px solid #fff}
.fade{left:0;right:0;top:0;height:470px}
.fade:after{content:'';position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,0) 55%,#000 100%)}
.wrap{position:absolute;left:48px;right:48px;display:flex;flex-direction:column}
.ln{display:block;margin-top:14px;font-size:40px;line-height:1.28;font-weight:600}
.ln:first-child{margin-top:0}
.foot{position:absolute;left:24px;right:30px;bottom:22px;display:flex;align-items:center;justify-content:space-between;font-weight:800;font-size:27px;line-height:1.2}
.save{display:flex;align-items:center;gap:18px}.fol{font-size:30px}
.foot2{position:absolute;left:0;right:0;bottom:24px;text-align:center;font-size:27px;color:#E8E8E8;font-weight:500}
.tag{display:inline-block;font-family:Poppins,Inter;font-weight:800;font-size:26px;letter-spacing:.14em;text-transform:uppercase;color:#000;background:${accent};padding:8px 18px;border-radius:10px}
.n{display:inline-flex;width:54px;height:54px;border:3px solid #fff;border-radius:50%;align-items:center;justify-content:center;font-size:26px;font-weight:800;margin-right:18px;flex:none}
.it{display:flex;align-items:flex-start;margin-top:22px;font-size:40px;line-height:1.26;font-weight:600}.it:first-child{margin-top:0}
.it .lb{color:${accent};font-weight:800}
.row{display:flex;align-items:baseline;gap:12px;font-family:Poppins,Inter;font-weight:800;font-size:36px;text-transform:uppercase;line-height:1.4}
.row .d{flex:1;border-bottom:3px dotted #777;transform:translateY(-8px)}.row .v{color:${accent}}
.big{font-family:Poppins,Inter;font-weight:900;color:${accent};line-height:1.05}
`;
  let inner = '', body = '';
  const photo = (cls, style) => `<div class="photo ${cls}" style="${style};${bg ? `background-image:url(${bg})` : 'background:linear-gradient(135deg,#222,#000)'}"></div>`;

  if (s.type === 'cta') {
    const kw = String(s.button || '').replace(/comment/i, '').trim().replace(/^["“]|["”]$/g, '');
    const inside = lines(s.text).filter(Boolean);
    inner = `<div class="wrap" style="top:48px;bottom:36px;justify-content:space-between">
      <div><span class="tag">Free guide</span><h1 style="font-size:78px;margin-top:18px">${mark(s.title, false)}</h1></div>
      <div style="display:flex;gap:30px;align-items:center">
        <div style="flex:1"><div style="background:#FFD84D;color:#000;font-family:Poppins;font-weight:900;font-size:56px;padding:20px 28px;border-radius:20px;line-height:1.1">COMMENT <span style="background:#000;color:#FFD84D;padding:0 14px;border-radius:12px">“${esc(kw)}”</span></div>
        <div style="margin-top:22px;font-size:34px;line-height:1.3;font-weight:600">${inside.map((l) => `<div style="margin-top:8px">${mark(l, false)}</div>`).join('')}</div></div>
        ${pdfUri ? `<div style="width:340px;transform:rotate(3deg);border:9px solid #fff;border-radius:14px;overflow:hidden;box-shadow:0 0 0 5px #FFD84D"><img src="${pdfUri}" style="display:block;width:100%"></div>` : ''}
      </div>
      <div style="display:flex;gap:18px;text-align:center;font-size:25px;font-weight:600;line-height:1.25">
        ${[['FOLLOW', 'for practical export tips'], ['SAVE', 'this post for your next order'], ['SHARE', 'with exporters who need it']].map(([a, b]) => `<div style="flex:1;border-top:4px solid #FFD84D;padding-top:14px"><div style="font-family:Poppins;font-weight:900;font-size:40px;color:#FFD84D">${a}</div>${b}</div>`).join('')}</div>
      <div style="height:6px"></div></div>`;
    return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${inner}</body></html>`;
  }

  if (tpl === 'guide') {
    if (s.type === 'cover') {
      const m = String(s.title || '').match(/^(how to|why|where to|what is)\s+(.*)$/i);
      const pill = m ? m[1].replace(/\b\w/g, (c) => c.toUpperCase()) : (s.kicker || '');
      const head = m ? m[2] : s.title;
      inner = `${photo('frame', 'height:480px;top:30px')}
        <div style="position:absolute;left:0;right:0;top:540px;text-align:center">
          ${pill ? `<div style="display:inline-block;background:#FFD84D;color:#000;font-family:Poppins;font-weight:800;font-size:54px;padding:2px 48px;border-radius:44px">${esc(pill)}</div>` : ''}
          <div class="wrap2" style="background:#FFD84D;color:#000;margin-top:12px;padding:4px 24px 10px;font-family:Poppins;font-weight:800;font-size:84px;line-height:1.08">${esc(String(head).replace(/(\*\*|==|\+\+|!!)/g, ''))}</div>
          ${s.sub ? `<div style="margin-top:16px;font-family:Poppins;font-weight:700;font-size:40px;color:#FFC9A8;padding:0 40px;line-height:1.2">${esc(String(s.sub).replace(/(\*\*|==|\+\+|!!)/g, ''))}</div>` : ''}
        </div>${FOOT_SAVE(handle)}`;
    } else {
      const items = (s.items && s.items.length ? s.items : lines(s.text).filter(Boolean));
      const numbered = items.length > 1 && /\?\s*$/.test(String(s.title || '')) || s.type === 'list';
      body = items.map((t, k) => { const [lb, rest] = splitLabel(t); const txt = lb ? `<span class="lb">${mark(lb, false)}:</span> ${mark(rest, true)}` : mark(rest, true); return `<div class="it">${numbered && items.length > 1 ? `<span class="n">${k + 1}</span>` : ''}<div>${txt}</div></div>`; }).join('');
      // fit the list: pick the largest font whose estimated wrapped height fits under the (title-sized) heading
      const tl = String(s.title || '').length, h2 = tl > 26 ? 60 : 72, h2Lines = Math.ceil(tl * 0.56 * h2 / 940);
      const photoH = items.length >= 4 || items.join('').length > 380 ? 300 : 430;
      const top = photoH + 34 + 22, avail = 1080 - 112 - top - h2Lines * h2 * 1.1 - 22;
      let fz = 40;
      for (; fz > 24; fz -= 2) {
        const cpl = Math.floor((870 - (numbered ? 72 : 0)) / (0.53 * fz));
        const h = items.reduce((a, t) => a + Math.ceil(String(t).length / cpl) * fz * 1.26 + 22, 0);
        if (h <= avail) break;
      }
      inner = `${photo('frame', `height:${photoH}px;top:34px`)}
        <div class="wrap" style="top:${top}px;bottom:112px"><h2 style="font-size:${h2}px;margin-bottom:22px">${mark(s.title, false)}</h2><div style="font-size:${fz}px">${body.replace(/class="it"/g, `class="it" style="font-size:${fz}px"`)}</div></div>${FOOT_SAVE(handle)}`;
    }
  } else if (tpl === 'verdict' && s.type === 'cover') {
    const boxes = (s.items || []).slice(0, 2);
    inner = `${photo('', 'inset:0')}<div style="position:absolute;inset:0;background:linear-gradient(rgba(0,0,0,.72),rgba(0,0,0,.88))"></div>
      <div class="wrap" style="top:44px;bottom:100px;justify-content:space-between">
        <h1 style="font-size:98px;text-transform:uppercase;line-height:1.08">${mark(s.title, true)}</h1>
        ${s.sub ? `<div style="align-self:flex-start;border:6px solid #FF2D2D;color:#FF2D2D;background:rgba(0,0,0,.7);font-family:Poppins;font-weight:900;font-size:50px;text-transform:uppercase;padding:8px 30px;transform:rotate(-2deg)">${esc(String(s.sub).replace(/(\*\*|==|\+\+|!!)/g, ''))}</div>` : ''}
        ${boxes.length ? `<div style="display:flex;gap:24px">${boxes.map((b) => { const [a, v] = splitLabel(b); return `<div style="flex:1;border:6px solid #FFC800;background:rgba(0,0,0,.78);border-radius:18px;padding:14px 20px;text-align:center;font-family:Poppins;font-weight:800;text-transform:uppercase"><div style="font-size:32px">${esc(a || '')}</div><div class="big" style="font-size:56px">${esc(v || b)}</div></div>`; }).join('')}</div>` : ''}
      </div>${FOOT_LEFT(handle)}`;
  } else { // math (also verdict content slides)
    if (s.type === 'cover') {
      inner = `${photo('fade', 'top:0')}<div class="wrap" style="top:470px;bottom:96px;justify-content:flex-start">
        <h1 style="font-size:84px;text-transform:uppercase">${mark(s.title, true)}</h1>
        ${s.sub ? `<div style="margin-top:22px;font-size:44px;font-weight:700;line-height:1.25">${mark(s.sub, true)}</div>` : ''}</div>${FOOT_LEFT(handle)}`;
    } else if (s.type === 'list') {
      const rows = (s.items || lines(s.text).filter(Boolean)).map((t) => { const [lb, v] = splitLabel(t); return `<div class="row"><span>${esc(lb || t)}</span><span class="d"></span><span class="v">${esc(v || '')}</span></div>`; }).join('');
      inner = `${photo('fade', 'height:330px;top:0')}<div class="wrap" style="top:300px;bottom:96px"><h2 style="font-size:60px;text-transform:uppercase;margin-bottom:14px">${mark(s.title, true)}</h2>${rows}
        ${s.stat ? `<div class="big" style="font-size:78px;margin-top:16px;border-top:4px solid #FFC800;padding-top:10px;text-transform:uppercase">${esc(s.stat)}</div>` : ''}</div>${FOOT_LEFT(handle)}`;
    } else {
      const ls = (s.items && s.items.length ? s.items : lines(s.text).filter(Boolean));
      inner = `${photo('fade', 'height:400px;top:0')}<div class="wrap" style="top:372px;bottom:96px"><h2 style="font-size:64px;text-transform:uppercase;margin-bottom:14px">${mark(s.title, true)}</h2>
        ${ls.map((l) => `<span class="ln">${s.items ? '&bull; ' : ''}${mark(l, true)}</span>`).join('')}
        ${s.stat ? `<div class="big" style="font-size:${String(s.stat).length > 22 ? 70 : 100}px;margin-top:18px;border-top:4px solid #FFC800;padding-top:12px;text-transform:uppercase">${esc(s.stat)}</div>` : ''}
        ${s.teaser ? `<div style="margin-top:14px;font-family:Poppins;font-weight:800;font-size:40px">${mark(s.teaser, true)}</div>` : ''}</div>${FOOT_LEFT(handle)}`;
    }
  }
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${inner}</body></html>`;
}

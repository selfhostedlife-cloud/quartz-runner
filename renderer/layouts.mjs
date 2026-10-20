// Photo-free slide designs for data posts. Each layout is a different visual idea so a swipe never repeats itself.
// Themes are CSS-variable sets (--bg --fg --ac --on --mu --ac2 --pill); fonts come from spec.font (--disp).
export const GRAPHIC_BANDS = ['linear-gradient(135deg,#1E2A5E,#0B1230)', 'linear-gradient(135deg,#5B21B6,#2E1065)', 'linear-gradient(135deg,#B45309,#7C2D12)', 'linear-gradient(135deg,#0F766E,#0B1230)'];

export const THEME_VARS = {
  dark:    { bg: 'radial-gradient(1200px 700px at 85% -10%,#1B2A66 0%,#0A0F1E 60%)', fg: '#fff', ac: '#FFE600', on: '#0A0F1E', mu: 'rgba(255,255,255,.2)', ac2: '#8A2BFF', pill: 'rgba(10,15,30,.55)' },
  light:   { bg: '#F4EFE6', fg: '#0A0F1E', ac: '#5B21B6', on: '#fff', mu: 'rgba(10,15,30,.15)', ac2: '#E11D2E', pill: 'rgba(10,15,30,.9)' },
  gold:    { bg: 'linear-gradient(160deg,#FFE600,#FFC800)', fg: '#0A0F1E', ac: '#0A0F1E', on: '#FFE600', mu: 'rgba(10,15,30,.18)', ac2: '#8A2BFF', pill: 'rgba(10,15,30,.9)' },
  purple:  { bg: 'linear-gradient(160deg,#6D28D9,#2E1065)', fg: '#fff', ac: '#FFE600', on: '#0A0F1E', mu: 'rgba(255,255,255,.22)', ac2: '#FF5A00', pill: 'rgba(10,15,30,.55)' },
  amber:   { bg: 'radial-gradient(900px 600px at 15% 0%,#6B4510 0%,#241503 70%)', fg: '#FFF1D6', ac: '#FFB020', on: '#241503', mu: 'rgba(255,241,214,.18)', ac2: '#FF6B35', pill: 'rgba(36,21,3,.7)' },
  monored: { bg: '#0B0B0C', fg: '#FFFFFF', ac: '#FF2D3D', on: '#FFFFFF', mu: 'rgba(255,255,255,.16)', ac2: '#FFFFFF', pill: 'rgba(255,45,61,.9)' },
  mint:    { bg: 'linear-gradient(160deg,#06140B,#000)', fg: '#FFFFFF', ac: '#39FF14', on: '#06140B', mu: 'rgba(255,255,255,.2)', ac2: '#FF5A00', pill: 'rgba(0,0,0,.7)' },
  cream:   { bg: '#F7F3EA', fg: '#0B1B4D', ac: '#E11D2E', on: '#FFFFFF', mu: 'rgba(11,27,77,.13)', ac2: '#0B1B4D', pill: 'rgba(11,27,77,.92)' },
  lime:    { bg: 'linear-gradient(160deg,#101010,#000)', fg: '#FFFFFF', ac: '#D4FF00', on: '#000000', mu: 'rgba(255,255,255,.2)', ac2: '#FF2D00', pill: 'rgba(0,0,0,.7)' },
};

export const FONT_IMPORT = "@import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;600;800;900&family=Poppins:wght@800;900&family=Montserrat:wght@800;900&family=Bebas+Neue&family=DM+Serif+Display&family=Anton&family=Rubik:wght@800&family=Fraunces:opsz,wght@9..144,900&family=Space+Mono:wght@400;700&display=swap');";

export const layoutCss = `
body{font-family:Inter,sans-serif}
.th{background:var(--bg);color:var(--fg)}
.th .handle,.th .num{background:var(--pill);color:#fff}
.th .tag{background:var(--ac);color:var(--on)}
.th h2,.th h1,.th .big2,.th .disp{font-family:var(--disp,'Archivo Black'),Inter,sans-serif}
.th p{color:inherit;opacity:.92}
.th .teaser span.l{color:var(--fg)}.th .teaser{color:var(--ac)}
.th em{color:var(--ac)}
.th mark.y{background:var(--ac);color:var(--on)}.th mark.p{background:var(--ac2);color:#fff}
.nophoto{background:var(--g)}
.nophoto:before{content:'';position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.14) 2px,transparent 2.5px);background-size:34px 34px}
.nophoto:after{background:linear-gradient(to bottom,rgba(10,15,30,0) 55%,#0A0F1E 100%)}
.ly{position:absolute;left:70px;right:70px}
.big2{line-height:1.05;letter-spacing:.005em;color:var(--ac)}
.wm{position:absolute;right:40px;top:130px;font-family:var(--disp,'Archivo Black');font-size:430px;line-height:1;opacity:.08;letter-spacing:-.04em}
/* leaderboard */
.row{display:flex;align-items:center;gap:18px;height:84px}
.row .nm{width:290px;font-weight:800;font-size:29px;line-height:1.1;opacity:.75}
.row .br{height:46px;border-radius:10px;background:var(--fg);opacity:.2;min-width:14px}
.row .vl{font-weight:800;font-size:27px;opacity:.75;white-space:nowrap}
.row.hi .nm,.row.hi .vl{opacity:1;font-size:32px}.row.hi .br{opacity:1;background:var(--ac)}
/* versus */
.vs{display:flex;align-items:flex-end;justify-content:center;gap:70px;height:430px}
.vs .col{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;width:280px}
.vs .bar{width:100%;border-radius:18px 18px 0 0;background:var(--fg);opacity:.25}
.vs .col.now .bar{opacity:1;background:var(--ac)}
.vs .v{font-family:var(--disp,'Archivo Black');font-size:46px;margin-bottom:12px}.vs .y{font-weight:800;font-size:30px;margin-top:14px;opacity:.85}
.delta{position:absolute;font-family:var(--disp,'Archivo Black');font-size:44px;padding:14px 26px;border-radius:999px;background:#F26A1B;color:#fff;box-shadow:0 12px 34px rgba(0,0,0,.35)}
/* movers */
.card{border-radius:26px;padding:22px 36px;margin-top:20px}
.card .pct{font-family:var(--disp,'Archivo Black');font-size:84px;line-height:1}
.card .nm2{font-family:var(--disp,'Archivo Black');font-size:40px;margin-top:4px}.card .ft{font-size:29px;margin-top:6px;opacity:.9}
.up{background:var(--ac);color:var(--on)}.down{background:var(--ac2);color:#fff}
/* duel */
.duel{display:flex;gap:22px;height:560px}
.dcard{flex:1;border-radius:30px;padding:34px 30px;display:flex;flex-direction:column;justify-content:flex-end;position:relative;overflow:hidden}
.dcard .dl{font-weight:800;font-size:32px;line-height:1.1}
.dcard .dv{font-family:var(--disp,'Archivo Black');font-size:112px;line-height:1;margin-top:10px;letter-spacing:-.02em}
.dcard .du{font-size:30px;font-weight:800;opacity:.85;margin-top:2px}.dcard .ds{font-size:27px;margin-top:18px;opacity:.85;line-height:1.3}
.vsb{position:absolute;left:50%;top:330px;margin-left:-50px;width:100px;height:100px;border-radius:50%;background:#F26A1B;color:#fff;font-family:var(--disp,'Archivo Black');font-size:36px;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 30px rgba(0,0,0,.4)}
/* podium */
.pod{display:flex;align-items:flex-end;justify-content:center;gap:18px;height:560px}
.pod .p{width:290px;border-radius:22px 22px 0 0;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding-top:22px;background:var(--mu)}
.pod .p.first{background:var(--ac);color:var(--on)}
.pod .pn{font-family:var(--disp,'Archivo Black');font-size:96px;line-height:1}
.pod .pv{font-family:var(--disp,'Archivo Black');font-size:50px;margin-top:8px}.pod .pu{font-size:24px;font-weight:800;opacity:.8}
.pod .pc{font-weight:800;font-size:31px;text-align:center;margin-bottom:14px;line-height:1.1}
/* receipt */
.rcpt{background:#FFFDF4;color:#1b1b1b;font-family:'Space Mono',monospace;padding:26px 38px 34px;border-radius:6px;box-shadow:0 24px 60px rgba(0,0,0,.45);transform:rotate(-1.2deg);position:relative}
.rcpt:after{content:'';position:absolute;left:0;right:0;bottom:-14px;height:16px;background:linear-gradient(135deg,#FFFDF4 33.3%,transparent 33.3%) -10px 0,linear-gradient(225deg,#FFFDF4 33.3%,transparent 33.3%) -10px 0;background-size:20px 16px}
.rcpt .rh{text-align:center;font-weight:700;font-size:30px;letter-spacing:.18em;border-bottom:3px dashed #1b1b1b;padding-bottom:10px;margin-bottom:8px}
.rcpt .rr{display:flex;align-items:baseline;gap:10px;font-size:27px;height:43px}
.rcpt .rr .a{white-space:nowrap}.rcpt .rr .d{flex:1;border-bottom:3px dotted #1b1b1b;opacity:.45;transform:translateY(-6px)}.rcpt .rr .b{font-weight:700;white-space:nowrap}
.rcpt .rr.hi{background:var(--ac);color:var(--on);padding:0 8px;margin:0 -8px}.rcpt .rr.lo{background:#1b1b1b;color:#FFFDF4;padding:0 8px;margin:0 -8px}
.rcpt .rf{border-top:3px dashed #1b1b1b;margin-top:8px;padding-top:8px;font-size:23px;text-align:center}
/* statement */
.stm{border-left:16px solid var(--ac);padding-left:40px}
.stm .sl{font-family:var(--disp,'Archivo Black');line-height:1.14;letter-spacing:.01em}
.stm .ss{font-size:30px;margin-top:30px;opacity:.85;line-height:1.35}
`;

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const hl = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<em>$1</em>').replace(/==(.+?)==/g, '<mark class="y">$1</mark>').replace(/\+\+(.+?)\+\+/g, '<mark class="p">$1</mark>').replace(/!!(.+?)!!/g, '<mark class="o">$1</mark>');
const para = (s) => String(s ?? '').split('\n').map((ln) => (ln.trim() === '' ? '<span class="gap"></span>' : `<span class="ln">${hl(ln)}</span>`)).join('');

// circle packing: biggest circle first, every other circle touches the cluster at the free spot closest to the big one; shrinks the scale until everything fits
function pack(items, W, H, maxR) {
  const top = Math.max(...items.map((x) => x.value));
  for (let sc = 1; sc > 0.3; sc *= 0.92) {
    const scale = (maxR * sc) / Math.sqrt(top);
    const cs = items.map((x) => ({ ...x, r: Math.max(12, Math.sqrt(x.value) * scale) }));
    const placed = []; let ok = true;
    for (const [k, c] of cs.entries()) {
      if (k === 0) { c.x = c.r + 6; c.y = H / 2; placed.push(c); continue; }
      let best = null;
      for (const p of placed) {
        for (let a = 0; a < 360; a += 8) {
          const d = p.r + c.r + 6; const x = p.x + d * Math.cos(a * Math.PI / 180), y = p.y + d * Math.sin(a * Math.PI / 180);
          if (x - c.r < 0 || x + c.r > W || y - c.r < 0 || y + c.r > H) continue;
          if (!placed.every((q) => Math.hypot(q.x - x, q.y - y) >= q.r + c.r + 4)) continue;
          const dist = Math.hypot(x - placed[0].x, y - placed[0].y);
          if (!best || dist < best.dist) best = { x, y, dist };
        }
      }
      if (!best) { ok = false; break; }
      c.x = best.x; c.y = best.y; placed.push(c);
    }
    if (ok) return cs;
  }
  return items.map((x, k) => ({ ...x, r: 20, x: 40 + k * 50, y: H / 2 }));
}

export function layoutHtml(s, i, total, handle) {
  const th = THEME_VARS[s.theme] ? s.theme : 'dark';
  const frame = (inner) => `<div class="handle">${esc(handle)}</div><div class="num">${i + 1}/${total}</div>${inner}`;
  const head = (size = 58) => `<div class="ly" style="top:128px"><span class="tag">${esc(s.kicker || '')}</span><h2 style="font-size:${Math.round(size * 1.28)}px;margin-top:16px;line-height:1.12;letter-spacing:.01em">${hl(s.title)}</h2></div>`;
  const note = (top, size = 31) => (s.text ? `<div class="ly" style="top:${top}px"><p style="font-size:${size}px;margin-top:0;line-height:1.3">${para(s.text)}</p></div>` : '');

  if (s.layout === 'hero') {
    return frame(`${s.rank ? `<div class="wm">#${esc(s.rank)}</div>` : ''}
      <div class="ly" style="top:150px;bottom:140px;display:flex;flex-direction:column;justify-content:center">
        <div><span class="tag">${esc(s.kicker || '')}</span></div>
        <div class="big2" style="font-size:${s.bigSize || 210}px;margin-top:26px">${esc(s.stat)}</div>
        <h2 style="font-size:80px;margin-top:10px">${hl(s.title)}</h2>${s.text ? `<p style="font-size:38px">${para(s.text)}</p>` : ''}</div>`);
  }
  if (s.layout === 'leaderboard') {
    const rows = s.rows || []; const max = Math.max(...rows.map((r) => r.value), 1);
    return frame(`${head(54)}<div class="ly" style="top:310px">${rows.map((r) => `<div class="row${r.hi ? ' hi' : ''}"><div class="nm">${esc(r.label)}</div><div class="br" style="width:${Math.round((r.value / max) * 430) + 14}px"></div><div class="vl">${esc(r.vl)}</div></div>`).join('')}</div>${note(310 + rows.length * 84 + 12, 32)}`);
  }
  if (s.layout === 'versus') {
    const b = s.bars || []; const max = Math.max(...b.map((x) => x.value), 1);
    return frame(`${head(54)}<div class="ly" style="top:350px"><div class="vs">${b.map((x, k) => `<div class="col${k === b.length - 1 ? ' now' : ''}"><div class="v">${esc(x.vl)}</div><div class="bar" style="height:${Math.max(40, Math.round((x.value / max) * 300))}px"></div><div class="y">${esc(x.label)}</div></div>`).join('')}</div></div>
      ${s.delta ? `<div class="delta" style="left:50%;margin-left:-70px;top:560px">${esc(s.delta)}</div>` : ''}${note(810, 33)}`);
  }
  if (s.layout === 'donut') {
    const R = 150, C = 2 * Math.PI * R, p = Math.max(0.5, Math.min(100, Number(s.pct))) / 100;
    return frame(`${head(56)}<div class="ly" style="top:330px;display:flex;align-items:center;gap:50px">
        <svg width="400" height="400" viewBox="0 0 400 400"><circle cx="200" cy="200" r="${R}" fill="none" stroke="currentColor" stroke-opacity=".2" stroke-width="64"/><circle cx="200" cy="200" r="${R}" fill="none" stroke="var(--ac)" stroke-width="64" stroke-dasharray="${(C * p).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 200 200)"/><text x="200" y="224" text-anchor="middle" font-family="${s.font || 'Archivo Black'}" font-size="92" fill="currentColor">${esc(s.stat)}</text></svg>
        <div style="flex:1;font-size:36px;line-height:1.35;font-weight:600">${para(s.text || '')}</div></div>`);
  }
  if (s.layout === 'movers') {
    return frame(`${head(60)}<div class="ly" style="top:290px">${(s.cards || []).map((cd) => `<div class="card ${cd.dir === 'up' ? 'up' : 'down'}"><div class="pct">${esc(cd.pct)}</div><div class="nm2">${esc(cd.name)}</div><div class="ft">${esc(cd.foot)}</div></div>`).join('')}${s.text ? `<p style="font-size:31px;margin-top:22px">${para(s.text)}</p>` : ''}</div>`);
  }
  if (s.layout === 'duel') {
    const card = (c, accent) => `<div class="dcard" style="${accent ? 'background:var(--ac);color:var(--on)' : 'background:var(--mu)'}"><div class="dl">${hl(c.label)}</div><div class="dv" style="font-size:${c.size || 112}px">${esc(c.value)}</div>${c.unit ? `<div class="du">${esc(c.unit)}</div>` : ''}${c.sub ? `<div class="ds">${para(c.sub)}</div>` : ''}</div>`;
    return frame(`${head(56)}<div class="ly" style="top:320px"><div class="duel">${card(s.a, false)}${card(s.b, true)}</div></div><div class="vsb">${esc(s.vs || 'VS')}</div>${s.badge ? `<div class="delta" style="left:50%;margin-left:-90px;top:930px;font-size:38px">${esc(s.badge)}</div>` : ''}`);
  }
  if (s.layout === 'drop') {
    const up = s.dir === 'up'; const y1 = up ? 230 : 50, y2 = up ? 50 : 230;
    return frame(`${head(52)}
      <div class="ly" style="top:285px"><div class="big2" style="font-size:200px;color:${up ? 'var(--ac)' : 'var(--ac2)'}">${esc(s.pct)}</div></div>
      <div class="ly" style="top:520px"><svg width="940" height="330" viewBox="0 0 940 330">
        <defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${up ? 'var(--ac)' : 'var(--ac2)'}" stop-opacity=".55"/><stop offset="1" stop-color="${up ? 'var(--ac)' : 'var(--ac2)'}" stop-opacity="0"/></linearGradient></defs>
        <polygon points="70,${y1 + 40} 870,${y2 + 40} 870,300 70,300" fill="url(#g)"/>
        <line x1="70" y1="${y1 + 40}" x2="870" y2="${y2 + 40}" stroke="${up ? 'var(--ac)' : 'var(--ac2)'}" stroke-width="12" stroke-linecap="round"/>
        <circle cx="70" cy="${y1 + 40}" r="20" fill="var(--fg)"/><circle cx="870" cy="${y2 + 40}" r="26" fill="${up ? 'var(--ac)' : 'var(--ac2)'}" stroke="var(--fg)" stroke-width="6"/>
        <text x="70" y="${y1 - 10}" font-family="Inter" font-weight="800" font-size="34" fill="currentColor" opacity=".8">${esc(s.from.label)}  ${esc(s.from.vl)}</text>
        <text x="870" y="${y2 + 100}" text-anchor="end" font-family="Inter" font-weight="800" font-size="40" fill="currentColor">${esc(s.to.label)}  ${esc(s.to.vl)}</text></svg></div>${note(870, 31)}`);
  }
  if (s.layout === 'multiplier') {
    const R = 170; const rs = Math.max(26, R * Math.sqrt(s.small.v / s.big.v));
    return frame(`${head(52)}
      <div class="ly" style="top:290px"><div class="big2" style="font-size:190px">${esc(s.x)}</div></div>
      <div class="ly" style="top:520px"><svg width="940" height="470" viewBox="0 0 940 470">
        <circle cx="150" cy="${370 - rs}" r="${rs}" fill="var(--mu)" stroke="var(--fg)" stroke-opacity=".5" stroke-width="3" stroke-dasharray="10 8"/>
        <circle cx="640" cy="200" r="${R}" fill="var(--ac)"/>
        <path d="M ${150 + rs + 24} 300 L 380 300" stroke="var(--fg)" stroke-width="8" stroke-linecap="round" fill="none"/><path d="M 380 300 l -26 -20 m 26 20 l -26 20" stroke="var(--fg)" stroke-width="8" stroke-linecap="round" fill="none" transform="translate(0 0)"/>
        <text x="150" y="418" text-anchor="middle" font-family="Inter" font-weight="800" font-size="34" fill="currentColor">${esc(s.small.vl)}</text><text x="150" y="452" text-anchor="middle" font-family="Inter" font-weight="600" font-size="28" fill="currentColor" opacity=".8">${esc(s.small.label)}</text>
        <text x="640" y="214" text-anchor="middle" font-family="${s.font || 'Archivo Black'}" font-size="64" fill="var(--on)">${esc(s.big.vl)}</text><text x="640" y="258" text-anchor="middle" font-family="Inter" font-weight="800" font-size="30" fill="var(--on)">${esc(s.big.label)}</text></svg></div>${note(930, 28)}`);
  }
  if (s.layout === 'slope') {
    const rows = s.rows || []; const n = rows.length; const stepY = Math.min(70, Math.floor(560 / n)); const H = n * stepY + 20;
    const y22 = (r) => 20 + (r - 1) * stepY + stepY / 2;
    const lines = rows.map((r) => `<line x1="330" y1="${y22(r.r22)}" x2="610" y2="${y22(r.r23)}" stroke="${r.r23 < r.r22 ? 'var(--ac)' : r.r23 > r.r22 ? 'var(--ac2)' : 'var(--fg)'}" stroke-opacity="${r.r23 === r.r22 ? .3 : 1}" stroke-width="${r.r23 === r.r22 ? 4 : 9}" stroke-linecap="round"/>`).join('');
    const left = rows.map((r) => `<text x="310" y="${y22(r.r22) + 9}" text-anchor="end" font-family="Inter" font-weight="800" font-size="27" fill="currentColor" opacity=".8">${esc(r.label)}  ${r.r22}</text>`).join('');
    const right = rows.map((r) => `<text x="630" y="${y22(r.r23) + 9}" font-family="Inter" font-weight="800" font-size="${r.r23 < r.r22 ? 32 : 27}" fill="currentColor" opacity="${r.r23 < r.r22 ? 1 : .8}">${r.r23}  ${esc(r.label)}${r.r23 < r.r22 ? '  ▲' + (r.r22 - r.r23) : r.r23 > r.r22 ? '  ▼' + (r.r23 - r.r22) : ''}</text>`).join('');
    return frame(`${head(52)}<div class="ly" style="top:300px"><div style="display:flex;justify-content:space-between;font-weight:800;font-size:26px;opacity:.7;padding:0 70px 0 200px"><span>2022 rank</span><span>2023 rank</span></div><svg width="940" height="${H}" viewBox="0 0 940 ${H}" style="margin-top:10px">${lines}${left}${right}</svg></div>${note(300 + 40 + H + 20, 30)}`);
  }
  if (s.layout === 'bubbles') {
    const cs = pack(s.items || [], 940, 540, 260);
    const svg = cs.map((c, k) => `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${c.r.toFixed(1)}" fill="${k === 0 ? 'var(--ac)' : 'var(--mu)'}" stroke="var(--fg)" stroke-opacity="${k === 0 ? 0 : .35}" stroke-width="2"/>`
      + (c.r >= 90 ? `<text x="${c.x.toFixed(1)}" y="${(c.y - 6).toFixed(1)}" text-anchor="middle" font-family="${s.font || 'Archivo Black'}" font-size="${Math.min(78, c.r * .42)}" fill="${k === 0 ? 'var(--on)' : 'currentColor'}">${esc(c.vl)}</text><text x="${c.x.toFixed(1)}" y="${(c.y + Math.min(78, c.r * .42) * .8).toFixed(1)}" text-anchor="middle" font-family="Inter" font-weight="800" font-size="${Math.min(34, c.r * .2)}" fill="${k === 0 ? 'var(--on)' : 'currentColor'}">${esc(c.label)}</text>`
        : c.r >= 36 ? `<text x="${c.x.toFixed(1)}" y="${(c.y + 7).toFixed(1)}" text-anchor="middle" font-family="Inter" font-weight="800" font-size="${Math.max(16, c.r * .36)}" fill="currentColor">${esc(c.short || c.label.slice(0, 3))}</text>` : '')).join('');
    return frame(`${head(52)}<div class="ly" style="top:300px"><svg width="940" height="560" viewBox="0 0 940 560">${svg}</svg></div>${note(880, 28)}`);
  }
  if (s.layout === 'podium') {
    const it = s.items || []; const order = [it[1], it[0], it[2]]; const hs = [360, 470, 290];
    return frame(`${head(54)}<div class="ly" style="top:300px"><div class="pod">${order.map((x, k) => x ? `<div style="display:flex;flex-direction:column;align-items:center"><div class="pc">${esc(x.label)}</div><div class="p${k === 1 ? ' first' : ''}" style="height:${hs[k]}px"><div class="pn">${k === 1 ? 1 : k === 0 ? 2 : 3}</div><div class="pv">${esc(x.vl)}</div><div class="pu">${esc(s.unit || '')}</div></div></div>` : '').join('')}</div></div>${note(880, 29)}`);
  }
  if (s.layout === 'receipt') {
    const rows = s.rows || [];
    return frame(`${head(50)}<div class="ly" style="top:${s.text ? 290 : 300}px;left:90px;right:90px"><div class="rcpt"><div class="rh">${esc(s.head || 'PRICE LIST')}</div>${rows.map((r) => `<div class="rr${r.hi ? ' hi' : r.lo ? ' lo' : ''}"><span class="a">${esc(r.label)}</span><span class="d"></span><span class="b">${esc(r.vl)}</span></div>`).join('')}${s.foot ? `<div class="rf">${esc(s.foot)}</div>` : ''}</div></div>`);
  }
  if (s.layout === 'statement') {
    const sz = s.size || 100;
    return frame(`<div class="ly" style="top:150px;bottom:140px;display:flex;flex-direction:column;justify-content:center"><div><span class="tag">${esc(s.kicker || '')}</span></div><div class="stm" style="margin-top:34px"><div class="sl" style="font-size:${sz}px">${hl(s.title)}</div>${s.text ? `<div class="ss">${para(s.text)}</div>` : ''}</div></div>`);
  }
  return frame(head());
}

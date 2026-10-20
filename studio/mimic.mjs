// Applies the look of a reference post (palette, font, typographic vs photo style) to a generated post and re-renders its slides.
// Usage: node mimic.mjs <postDir> <style.json>     (style.design = { palette:{bg,fg,accent,accent2}, theme_guess, font_guess, typographic })
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const [dir, styleFile] = process.argv.slice(2);
if (!dir || !styleFile) { console.error('usage: node mimic.mjs <postDir> <style.json>'); process.exit(1); }
const style = JSON.parse(fs.readFileSync(styleFile, 'utf8'));
const d = style.design || {};
const FONTS = ['Archivo Black', 'Poppins', 'Montserrat', 'DM Serif Display', 'Rubik', 'Fraunces', 'Inter'];
const THEMES = ['dark', 'light', 'gold', 'purple', 'amber', 'monored', 'mint', 'cream', 'lime'];
const hexOk = (h) => /^#[0-9a-f]{6}$/i.test(String(h || ''));
const lum = (h) => { const n = parseInt(h.slice(1), 16); const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const rgba = (h, a) => { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

const spec = JSON.parse(fs.readFileSync(path.join(dir, 'spec.json'), 'utf8'));
const font = FONTS.includes(d.font_guess) ? d.font_guess : null;
let themeVars = null;
const p = d.palette || {};
if (hexOk(p.bg) && hexOk(p.accent)) {
  const bg = p.bg; const dark = lum(bg) < 0.4;
  const fg = hexOk(p.fg) ? p.fg : (dark ? '#FFFFFF' : '#0A0F1E');
  themeVars = { bg, fg, ac: p.accent, on: lum(p.accent) < 0.4 ? '#FFFFFF' : '#0A0F1E', mu: rgba(fg, 0.2), ac2: hexOk(p.accent2) ? p.accent2 : p.accent, pill: dark ? rgba(bg, 0.8) : rgba(fg, 0.92) }; // the handle/number pill must contrast with the page: dark pill on light looks
}
const typographic = d.typographic === true || /typograph|text/i.test(String(d.cover_style || ''));
let changed = 0;
if (font) spec.font = font;
if (typographic && (themeVars || THEMES.includes(d.theme_guess))) {
  for (const s of spec.slides) {
    if (s.type === 'cta') { if (font) s.font = font; continue; }
    const text = [s.type === 'cover' ? (s.sub || s.text) : s.text, ...(s.items || [])].filter(Boolean).join('\n');
    const len = String(s.title || '').length;
    Object.assign(s, { layout: 'statement', size: len > 70 ? 60 : len > 50 ? 70 : len > 32 ? 82 : 96, text, ...(themeVars ? { themeVars } : { theme: d.theme_guess }), ...(font ? { font } : {}) });
    delete s.items; changed++;
  }
}
fs.writeFileSync(path.join(dir, 'spec.json'), JSON.stringify(spec, null, 2));
const r = spawnSync(process.execPath, [path.join(here, '..', 'renderer', 'render.mjs'), path.join(dir, 'spec.json'), dir], { encoding: 'utf8' });
if (r.status !== 0) { console.error(r.stderr.slice(-400)); process.exit(1); }
console.log(JSON.stringify({ restyledSlides: changed, font, palette: themeVars ? { bg: themeVars.bg, accent: themeVars.ac } : d.theme_guess || null, typographic }));

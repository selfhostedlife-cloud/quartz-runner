// Design rotation. Owner rule (2026-10-13): the stock photo behind the subject stays on almost every post (it makes the post feel connected to what it talks about);
// what rotates is colour, font and headline style OVER the photo. A few text-only looks (no photo) run only as occasional tests (about 1 post in 5),
// so the learning loop can compare them (feature `look=`).
//   node looks.mjs list | pick | apply <postDir> [name]
// Photo looks write spec.photoTheme (render.mjs restyles tag, highlights, overlay tint, headline font/case) and re-render with --keep-photos (same photos, no Gemini).
// Text-only looks go through mimic.mjs. spec.pre-look.json keeps the unstyled spec so any look can be swapped later.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, 'data');
const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8')); } catch { return d; } };

export const LOOKS = {
  // owner 2026-10-20: neon, high-contrast colours that stop the scroll (no soft teal / pink); loose, wide fonts (no tight condensed ones like Anton / Bebas Neue)
  'ink-gold': { photo: true, label: 'Black-navy overlay, neon yellow highlights, Archivo Black', theme: { ink: '#070B18', accent: '#FFE600', accent2: '#FF5A00', tagText: '#000000', font: 'Archivo Black' } },
  'volt-photo': { photo: true, label: 'Black overlay, volt-yellow highlights, electric-violet pills, Poppins', theme: { ink: '#050505', accent: '#E6FF00', accent2: '#7A00FF', tagText: '#000000', font: 'Poppins' } },
  'neon-green-photo': { photo: true, label: 'Near-black overlay, neon green highlights, blue pills, Montserrat', theme: { ink: '#030A05', accent: '#39FF14', accent2: '#0047FF', tagText: '#000000', font: 'Montserrat' } },
  'fire-photo': { photo: true, label: 'Black overlay, neon orange highlights, red pills, Archivo Black', theme: { ink: '#0A0500', accent: '#FF6A00', accent2: '#E10600', tagText: '#000000', font: 'Archivo Black' } },
  'electric-photo': { photo: true, label: 'Deep blue-black overlay, neon yellow highlights, electric blue pills, Rubik', theme: { ink: '#00061F', accent: '#FFE600', accent2: '#0050FF', tagText: '#000000', font: 'Rubik' } },
  'signal-red-photo': { photo: true, label: 'Black overlay, signal-red highlights with white text, Poppins', theme: { ink: '#0A0000', accent: '#FF1F1F', accent2: '#FFE600', tagText: '#FFFFFF', font: 'Poppins' } },
  'royal-photo': { photo: true, label: 'Deep purple overlay, neon yellow highlights, Montserrat', theme: { ink: '#12002E', accent: '#FFE600', accent2: '#8A2BFF', tagText: '#000000', font: 'Montserrat' } },
  // ---- text-only test looks (no photo): used about 1 post in 5 to see whether they pull more or less ----
  'cream-serif': { photo: false, label: 'TEST no photo: cream paper, serif headlines, red highlight', design: { typographic: true, palette: { bg: '#FFF3DC', fg: '#111111', accent: '#E10600', accent2: '#111111' }, font_guess: 'DM Serif Display' } },
  'saffron-punch': { photo: false, label: 'TEST no photo: neon orange background, black text, navy highlight', design: { typographic: true, palette: { bg: '#FF6A00', fg: '#000000', accent: '#0B2A5B', accent2: '#7A00FF' }, font_guess: 'Archivo Black' } },
  'volt-black': { photo: false, label: 'TEST no photo: black page, white text, volt-yellow highlight', design: { typographic: true, palette: { bg: '#050505', fg: '#FFFFFF', accent: '#E6FF00', accent2: '#7A00FF' }, font_guess: 'Poppins' } },
  'red-news': { photo: false, label: 'TEST no photo: white page, black text, signal-red highlight, Archivo Black', design: { typographic: true, palette: { bg: '#FFFFFF', fg: '#000000', accent: '#E10600', accent2: '#000000' }, font_guess: 'Archivo Black' } },
};
const PHOTO = Object.keys(LOOKS).filter((k) => LOOKS[k].photo), TEXTONLY = Object.keys(LOOKS).filter((k) => !LOOKS[k].photo);

// the look a post wears: its own tag (old text-only names that no longer exist count as text-only tests), else the original look
export const lookOf = (p) => p.look || (p.kind === 'reference' ? 'reference' : p.kind === 'data' ? 'data' : 'ink-gold');

// rotation: a photo look that is not one of the last 3 used (least recently used first); a text-only test only when none of the last 4 posts was text-only
export function pickLook(posts = rd('state.json', { posts: [] }).posts) {
  const live = posts.filter((p) => p.status !== 'rejected');
  const recent = live.slice(-4).map(lookOf);
  const lastUse = {}; live.forEach((p, i) => { lastUse[lookOf(p)] = i; });
  const lru = (pool) => { const s = [...pool].sort((a, b) => (lastUse[a] ?? -1) - (lastUse[b] ?? -1)); const best = s.filter((k) => (lastUse[k] ?? -1) === (lastUse[s[0]] ?? -1)); return best[Math.floor(Math.random() * best.length)]; };
  // a text-only test is due after 4 posts without one (the recent text-only posts, if any, counted from the end)
  const lastText = Math.max(-1, ...live.map((p, i) => (LOOKS[lookOf(p)] && !LOOKS[lookOf(p)].photo ? i : -1)));
  if (live.length - 1 - lastText >= 4) return lru(TEXTONLY);
  const pool = PHOTO.filter((k) => !recent.slice(-3).includes(k));
  return lru(pool.length ? pool : PHOTO);
}

export function applyLook(dir, name) {
  const look = LOOKS[name]; if (!look) throw new Error('unknown look ' + name + ' (try: ' + Object.keys(LOOKS).join(', ') + ')');
  const pre = path.join(dir, 'spec.pre-look.json');
  if (!fs.existsSync(pre)) fs.copyFileSync(path.join(dir, 'spec.json'), pre);
  const spec = JSON.parse(fs.readFileSync(pre, 'utf8')); // always start from the unstyled version
  delete spec.photoTheme;
  if (look.photo) {
    if (look.theme) { spec.photoTheme = look.theme; spec.font = look.theme.font; }
    fs.writeFileSync(path.join(dir, 'spec.json'), JSON.stringify(spec, null, 2));
    const r = spawnSync(process.execPath, [path.join(here, '..', 'renderer', 'render.mjs'), path.join(dir, 'spec.json'), dir, '--keep-photos'], { encoding: 'utf8', timeout: 10 * 60e3 });
    if (r.status !== 0) throw new Error('look failed: ' + (r.stderr || '').slice(-300));
    return name;
  }
  fs.writeFileSync(path.join(dir, 'spec.json'), JSON.stringify(spec, null, 2));
  const styleFile = path.join(dir, 'look-style.json');
  fs.writeFileSync(styleFile, JSON.stringify({ design: look.design }));
  const r = spawnSync(process.execPath, [path.join(here, 'mimic.mjs'), dir, styleFile], { encoding: 'utf8', timeout: 10 * 60e3 });
  if (r.status !== 0) throw new Error('look failed: ' + (r.stderr || '').slice(-300));
  return name;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const [cmd, dir, name] = process.argv.slice(2);
  if (cmd === 'list') for (const [k, v] of Object.entries(LOOKS)) console.log(k.padEnd(17), v.label);
  else if (cmd === 'pick') console.log(pickLook());
  else if (cmd === 'apply' && dir) { const n = name || pickLook(); console.log(JSON.stringify({ look: applyLook(dir, n) })); }
  else console.log('usage: node looks.mjs list | pick | apply <postDir> [name]');
}

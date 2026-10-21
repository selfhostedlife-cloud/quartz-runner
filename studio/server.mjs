// Studio service: Telegram approval bot + daily generation run + insights sync, controlled by n8n over localhost.
// Start: node server.mjs   (see ../start-studio.cmd)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as tg from './telegram.mjs';
import { syncInsights, recentSent, sentByIds } from './insights.mjs';
import { buildSlotModel } from './slots.mjs';
import { pickLook, LOOKS, lookOf } from './looks.mjs';
import { plainCheck, plainHooksFor } from './plain.mjs';
import { gemini } from './agents.mjs';
import { feed, cleanupMedia } from './feeder.mjs';
import { persist, pruneImages, squashHistory } from './cloud.mjs';
import { addDirective } from './rules.mjs';
const TICK = process.env.TICK === '1'; // cloud mode: one bounded run (GitHub Actions), no HTTP server, no timers

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const dataDir = path.join(here, 'data');
const stateFile = path.join(dataDir, 'state.json');
const PORT = 5688;
const SLOTS = ['12:30', '19:00']; // IST slots, from your own posting history
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- secrets ----------
const envFile = path.join(root, '.env');
let env = fs.readFileSync(envFile, 'utf8');
if (!/^STUDIO_TOKEN=/m.test(env)) { fs.appendFileSync(envFile, `\nSTUDIO_TOKEN=${crypto.randomBytes(24).toString('hex')}\n`); env = fs.readFileSync(envFile, 'utf8'); }
const STUDIO_TOKEN = env.match(/^STUDIO_TOKEN=(.*)$/m)[1].trim();

// ---------- state ----------
const loadState = () => { try { return JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { return {}; } };
let state = Object.assign({ posts: [], chatId: null, offset: 0, seq: 0 }, loadState());
let dirty = false;
const save = () => { fs.writeFileSync(stateFile, JSON.stringify(state, null, 2)); dirty = true; };
// post folders are stored as absolute paths of whichever machine saved last: re-point them to this machine by folder name
for (const p of state.posts) if (p.dir && !fs.existsSync(p.dir)) { const cand = path.join(root, 'out', 'posts', String(p.dir).split(/[\\/]/).pop()); if (fs.existsSync(cand)) p.dir = cand; }
// background jobs started by commands (daily run, results image, learning...): a cloud run must wait for them before it exits
const bgTasks = new Set();
const bg = (p) => { const q = Promise.resolve(p).catch(() => {}); bgTasks.add(q); q.finally(() => bgTasks.delete(q)); return p; };
const byNo = (n) => state.posts.find((p) => p.no === Number(n));
const BOTS = { main: tg.mainBot, test: tg.testBot, fb: tg.fbBot };
state.chats ||= {}; if (state.chatId && !state.chats.main) state.chats.main = state.chatId;
// the Facebook bot talks to the same owner chat as the main bot (same person; the owner only has to press Start once in the Facebook bot)
if (!state.chats.fb && state.chats.main && BOTS.fb.hasToken()) state.chats.fb = state.chats.main;
state.offsets ||= {}; if (state.offset && state.offsets.main == null) state.offsets.main = state.offset;
// One bot per account. An account is served by its own bot when that bot is configured and paired; otherwise by the main bot (prefixed so you can tell).
const botFor = (acct) => (acct === 'test' && BOTS.test.hasToken() && state.chats.test ? 'test' : 'main');
const sendTo = (acct, text, extra) => {
  const who = botFor(acct); const chat = state.chats[who];
  if (!chat) { log('(unpaired) ' + String(text).slice(0, 80)); return null; }
  const t = who === 'main' && acct === 'test' ? '[TEST account] ' + text : text;
  return BOTS[who].sendMessage(chat, t, extra).catch((e) => log('send failed:', e.message));
};
const photoTo = (acct, file, caption, markup) => {
  const who = botFor(acct); const chat = state.chats[who];
  if (!chat) return null;
  return BOTS[who].sendPhoto(chat, file, (who === 'main' && acct === 'test' ? '[TEST account] ' : '') + (caption || ''), markup).catch((e) => log('photo failed:', e.message));
};
const say = (text, extra) => sendTo('main', text, extra);
const sendFb = (text, extra) => { const chat = state.chats.fb; if (!chat || !BOTS.fb.hasToken()) { log('(facebook bot unpaired) ' + String(text).slice(0, 80)); return null; } return BOTS.fb.sendMessage(chat, text, extra).catch((e) => log('facebook bot send failed:', e.message)); };
const ans = (cb, text) => BOTS[cb._who || 'main'].answerCallback(cb.id, text);

// ---------- child process runner ----------
let browserReady = !TICK;
let browserP = null;
function startBrowserInstall() { // cloud: every run starts on a fresh machine; install Chromium in the background at run start so /results, /edit and reference jobs do not wait ~3 min (and the bot keeps polling meanwhile)
  browserP ||= new Promise((resolve) => {
    const p = spawn('npx', ['playwright', 'install', '--with-deps', 'chromium'], { cwd: path.join(root, 'renderer'), stdio: 'ignore' });
    const done = (code) => { log('chromium install exit', code); browserReady = true; resolve(); };
    p.on('close', done); p.on('error', () => done('error'));
  });
  return browserP;
}
async function ensureBrowser(script) { // wait for the install only when a script that renders is about to run
  if (browserReady || !/render|results-image|results-table|make-from|restyle|mimic|reference|looks|leadmagnet|data-/.test(script)) return;
  await startBrowserInstall();
}
async function run(script, args = [], timeoutMs = 15 * 60e3) {
  await ensureBrowser(script);
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [path.join(here, script), ...args], { cwd: here });
    let out = '', err = '';
    const t = setTimeout(() => p.kill(), timeoutMs);
    p.stdout.on('data', (b) => (out += b)); p.stderr.on('data', (b) => (err += b));
    p.on('close', (code) => { clearTimeout(t); resolve({ code, out, err }); });
  });
}
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };

// ---------- slots ----------
function nextSlot() { // only a suggestion shown at approval: the next peak slot of the main account (the feeder picks the real slot per account)
  const taken = new Set(state.posts.filter((p) => p.dueAt && p.status !== 'rejected').map((p) => new Date(p.dueAt).toISOString()));
  const model = readJson(path.join(dataDir, 'slot-model.json'), null)?.accounts?.main?.slots;
  for (let d = 0; d < 30; d++) {
    const day = new Date(Date.now() + 5.5 * 3600e3 + d * 864e5);
    for (const s of (model ? model[day.getUTCDay()] : SLOTS) || SLOTS) {
      const date = day.toISOString().slice(0, 10); // IST calendar date
      const iso = new Date(`${date}T${s}:00+05:30`).toISOString();
      if (new Date(iso).getTime() > Date.now() + 45 * 60e3 && !taken.has(iso)) return { iso, label: `${date} ${s} IST` };
    }
  }
}

// ---------- preview ----------
const kb = (n) => ({ inline_keyboard: [
  [{ text: 'Approve', callback_data: `a:${n}` }, { text: 'Reject', callback_data: `r:${n}` }],
  [1, 2, 3, 4].map((s) => ({ text: `Swap img ${s}`, callback_data: `s:${n}:${s}` })),
  [5, 6, 7].map((s) => ({ text: `Swap img ${s}`, callback_data: `s:${n}:${s}` })),
  [{ text: 'Caption', callback_data: `c:${n}` }, { text: 'Facts to check', callback_data: `f:${n}` }, { text: 'PDF', callback_data: `d:${n}` }],
] });

async function sendPreview(post) {
  if (!state.chatId) { log('cannot preview: not paired yet'); return; }
  const slides = fs.readdirSync(post.dir).filter((f) => /^slide_\d+\.jpg$/.test(f)).sort().map((f) => path.join(post.dir, f));
  const review = readJson(path.join(post.dir, 'review.json'), {});
  await tg.sendAlbum(state.chatId, slides, `#${post.no} ${post.topic}`);
  const unver = review.factcheck?.unverified ? 'NOT fact-checked (search quota). Review the claims.' : (review.factcheck?.ok ? 'Fact-check passed.' : 'Fact-check flagged issues.');
  const slot = nextSlot();
  const sc = review.scores || {};
  const warns = [];
  if (Object.values(sc).some((v) => Number(v) <= 2)) warns.push('Critic scored this 2/5 or lower on: ' + Object.entries(sc).filter(([, v]) => Number(v) <= 2).map(([k]) => k).join(', '));
  if ((review.promise?.gaps || []).length) warns.push('CTA promises something the PDF does not deliver: ' + review.promise.gaps.join('; '));
  if (review.factcheck?.issues?.length) warns.push('Fact-check flagged ' + review.factcheck.issues.length + ' item(s). Tap "Facts to check".');
  await tg.sendMessage(state.chatId,
    `${warns.length ? 'WARNING - review before approving:\n- ' + warns.join('\n- ') + '\n\n' : ''}Post #${post.no}: ${post.topic}\nHook: ${post.hook}\nOffer: comment "${post.keyword}" -> ${post.leadmagnet || 'PDF'}\n${unver}\nSuggested slot: ${slot.label}\nScores: ${JSON.stringify(review.scores || {})}`,
    { reply_markup: kb(post.no) });
}

// ---------- Drive: approved lead magnets go into the shared "Freebies for IG Studio" folder (Drive for desktop syncs it) ----------
const DRIVE_DIR = 'H:/My Drive/Freebies for IG Studio';
function copyToDrive(post) {
  try {
    if (!fs.existsSync(DRIVE_DIR)) return TICK ? 'PDF saved in the cloud copy; it reaches your Drive folder the next time the laptop syncs (or add it by hand)' : 'Drive folder not mounted (sign in to Drive for desktop)';
    const pdf = fs.readdirSync(post.dir).find((f) => f.endsWith('.pdf'));
    if (!pdf) return 'no PDF found';
    const title = (readJson(path.join(post.dir, 'leadmagnet.json'), {}).title || pdf.replace(/.pdf$/, '')).replace(/[\/:*?"<>|]/g, '');
    const name = String(post.keyword).toUpperCase() + ' - ' + title + '.pdf';
    fs.copyFileSync(path.join(post.dir, pdf), path.join(DRIVE_DIR, name));
    return 'copied to Drive as "' + name + '"';
  } catch (e) { return 'Drive copy failed: ' + e.message; }
}

// ---------- feeder: bank -> Buffer ----------
let feeding = false;
async function runFeed(dryRun = false) {
  if (feeding) return { busy: true };
  feeding = true;
  try {
    const out = await feed(state, save, { dryRun, notify: (t, acct) => sendTo(acct || 'main', t), notifyFb: (t) => sendFb(t) });
    if (!dryRun) out.cleanup = await cleanupMedia(state, save);
    return out;
  } finally { feeding = false; }
}

// ---------- commands: help, /look, /hook ----------
const HELP_MAIN = [
  'MAIN BOT COMMANDS',
  '/status - only the posts scheduled from today onwards, with go-live times (past posts are not listed)',
  '/results - colour results chart + last-5 table (nothing is sent automatically except one 24-hour text summary a day)',
  '/rules - the standing rules you have given me. Any plain message without a / is saved as a standing rule and used in every post from now on; name a post to edit it instead, e.g. "post 21 slide 2 make the title yellow"',
  '/run - write new posts now (normally automatic at 11:30)',
  '/learn - re-read all results and update what the system does next',
  '/hook 17 - 5 plain-English hook options for post #17 (tap one to put it on the cover and caption)',
  '/fresh 17 - new plain hook AND new design for post #17 in one go',
  '/edit 21 2 make the title yellow and bigger - the one command to change a post: wording, colours, sizes, line gaps, fonts, pills and photo of one slide (or "all" slides)',
  '/ref - step-by-step: how to copy a competitor post',
  '',
  'COPY A COMPETITOR POST: select ALL its slides as screenshots and send them together in one message (a note in the caption is optional, e.g. "keep it shorter"). I read its hook, structure, caption style, colours and font and send back a NEW post in the same style with one better tweak: slides, caption and PDF. Approve it and it goes to the front of the queue. An Instagram link alone cannot be read by any tool, so the screenshots are needed.',
  '',
  'The test bot (@exportimportwithfaizan) only has /status and /results.',
].join('\n');

const REF_HELP = [
  'HOW TO COPY A COMPETITOR POST (/ref)',
  '1. Open the post on Instagram and screenshot EVERY slide, in order (cover first). Max 10 slides.',
  '2. Send all the screenshots to this bot together in ONE message (select them all in the gallery, then send). A note in the caption of the first one is optional, e.g. "keep it shorter" or "make it about rice".',
  '3. Wait 5-10 minutes. I read its hook, structure, caption style, colours and font, then send back a NEW post: fresh wording and images, one better tweak, a caption and a PDF lead magnet.',
  '4. Tap Approve and it goes to the front of the queue.',
  '',
  'An Instagram link alone cannot be read (login wall), so screenshots are needed. One reference at a time.',
].join('\n');

const hlNum = (t) => (/==/.test(t) ? t : t.replace(/(\bRs\.?\s?\d[\d,.]*(?:\s?(?:lakh|crore|k|L|Cr)\b)?|\b\d[\d,.]*\s?%|\b\d+\s(?:days|weeks|months|years|hours|things|steps|mistakes|documents)\b)/i, '==$1=='));
async function onHookCommand(text, reply) {
  const post = byNo(text.split(/\s+/)[1]);
  if (!post) return reply('Usage: /hook 17  (the post number from the preview)');
  if ((post.buffer || []).length) return reply('#' + post.no + ' is already in Buffer, so its cover cannot change here.');
  await reply('Writing plain-English hooks for #' + post.no + '...');
  const spec = readJson(path.join(post.dir, 'spec.json'), { slides: [] });
  let caption = ''; try { caption = fs.readFileSync(path.join(post.dir, 'caption.txt'), 'utf8'); } catch { /* none */ }
  const opts = await plainHooksFor({ topic: post.topic, current: post.hook, facts: { slides: spec.slides.map((s) => [s.title, s.sub, s.text, s.stat, ...(s.items || [])].filter(Boolean).join(' | ')), caption } });
  if (!opts.length) return reply('No options came back (Gemini quota?). Try again later.');
  post.hookOptions = opts; save();
  return BOTS.main.sendMessage(state.chats.main, 'Hooks for #' + post.no + ' (now: "' + post.hook + '")\n\n' + opts.map((o, i) => (i + 1) + '. ' + o.hook + '\n    ' + (o.sub || '')).join('\n') + '\n\nTap one to put it on the cover and the first line of the caption.', { reply_markup: { inline_keyboard: opts.map((o, i) => [{ text: (i + 1) + '. ' + o.hook.slice(0, 55), callback_data: 'h:' + post.no + ':' + i }]) } });
}
async function applyHook(post, opt, { quiet = false } = {}) {
  const size = (t) => { const len = String(t).length; return len > 70 ? 60 : len > 50 ? 70 : len > 32 ? 82 : 96; };
  for (const f of ['spec.json', 'spec.pre-look.json']) {
    const file = path.join(post.dir, f); const sp = readJson(file, null); if (!sp) continue;
    const c = sp.slides.find((s) => s.type === 'cover') || sp.slides[0];
    c.title = hlNum(opt.hook); if (opt.sub) { c.sub = opt.sub; if (c.layout) c.text = opt.sub; } if (c.layout) c.size = size(opt.hook);
    fs.writeFileSync(file, JSON.stringify(sp, null, 2));
  }
  try { const cf = path.join(post.dir, 'caption.txt'); const lines = fs.readFileSync(cf, 'utf8').split('\n'); lines[0] = opt.hook; fs.writeFileSync(cf, lines.join('\n')); } catch { /* caption missing */ }
  post.hook = opt.hook; save();
  const r = await run('../renderer/render.mjs', [path.join(post.dir, 'spec.json'), post.dir, '--only', '1'], 5 * 60e3);
  if (r.code !== 0) throw new Error(r.err.slice(-200));
  if (quiet) return;
  await tg.sendPhoto(state.chatId, path.join(post.dir, 'slide_01.jpg'), '#' + post.no + ' new cover: ' + opt.hook, { inline_keyboard: [[{ text: 'Approve', callback_data: 'a:' + post.no }, { text: 'Other hooks', callback_data: 'x:' + post.no }]] });
}

// new plain hook + next look in one go (for posts that wait for approval or sit in the bank)
async function refreshPost(post) {
  if ((post.buffer || []).length) throw new Error('#' + post.no + ' is already in Buffer');
  const spec = readJson(path.join(post.dir, 'spec.json'), { slides: [] });
  let caption = ''; try { caption = fs.readFileSync(path.join(post.dir, 'caption.txt'), 'utf8'); } catch { /* none */ }
  const opts = await plainHooksFor({ topic: post.topic, current: post.hook, facts: { slides: spec.slides.map((s) => [s.title, s.sub, s.text, s.stat, ...(s.items || [])].filter(Boolean).join(' | ')), caption } });
  if (!opts.length) throw new Error('no hook options (Gemini quota?)');
  const opt = opts.find((o) => plainCheck(o.hook).ok) || opts[0];
  await applyHook(post, opt, { quiet: true });
  const pick = pickLook(state.posts.filter((p) => p.no !== post.no));
  const r = await run('looks.mjs', ['apply', post.dir, pick], 10 * 60e3);
  if (r.code !== 0) throw new Error('look failed: ' + r.err.slice(-200));
  post.look = pick; post.hookOptions = opts; save();
  await sendPreview(post);
  return { no: post.no, hook: post.hook, look: pick };
}

// /fix <post> <slide> <instruction>: the owner says what a slide should say; the slide text is rewritten (facts of the post only) and re-rendered
async function fixSlide(post, slideNo, instruction) {
  const spec = readJson(path.join(post.dir, 'spec.json'), null); const idx = slideNo - 1;
  if (!spec?.slides?.[idx]) throw new Error('post #' + post.no + ' has no slide ' + slideNo);
  const cur = spec.slides[idx];
  const out = await gemini(`You edit ONE slide of an Instagram carousel for Indian exporters, exactly as the owner asks.
OWNER'S INSTRUCTION: ${instruction}
CURRENT SLIDE ${slideNo}: ${JSON.stringify({ title: cur.title, text: cur.text, items: cur.items, teaser: cur.teaser })}
ALL SLIDES OF THE POST (for facts and context): ${JSON.stringify(spec.slides.map((s, i) => ({ n: i + 1, title: s.title, text: s.text, items: s.items })))}
RULES: plain easy English (short sentences, everyday words, max 12 words per line). Do NOT invent numbers or new claims; use only what the post already says plus the owner's instruction. title = max 7 words, only the headline, never the body. text = the body, ONE point per line separated by \\n, blank line (\\n\\n) between groups. Markup: ==x== yellow highlight (numbers), ++x++ purple highlight, !!x!! orange (ONLY for the word Mistake:). At most 2 highlights. For a Mistake/Fix slide use exactly: "!!Mistake:!!\\n<what the exporter did wrong>\\n\\n++Fix:++\\n<the action that prevents it>". A Fix is what to DO next time, never the bad outcome.
Return JSON: {"title":"","text":"","items":[],"teaser":""} (teaser max 6 words; keep the current teaser if it still fits).`);
  if (!out?.title) throw new Error('no rewrite came back (Gemini quota?)');
  const size = (t) => { const len = String(t).length; return len > 70 ? 60 : len > 50 ? 70 : len > 32 ? 82 : 96; };
  for (const f of ['spec.json', 'spec.pre-look.json']) {
    const file = path.join(post.dir, f); const sp = readJson(file, null); if (!sp?.slides?.[idx]) continue;
    const s = sp.slides[idx]; s.title = out.title; s.text = out.text || ''; if (out.items?.length) s.items = out.items; else if (!s.layout) s.items = s.items || [];
    if (out.teaser) s.teaser = out.teaser; if (s.layout) delete s.size;
    fs.writeFileSync(file, JSON.stringify(sp, null, 2));
  }
  const r = await run('../renderer/render.mjs', [path.join(post.dir, 'spec.json'), post.dir, '--only', String(slideNo), '--keep-photos'], 5 * 60e3);
  if (r.code !== 0) throw new Error(r.err.slice(-200));
  await tg.sendPhoto(state.chatId, path.join(post.dir, 'slide_' + String(slideNo).padStart(2, '0') + '.jpg'), '#' + post.no + ' slide ' + slideNo + ' rewritten', { inline_keyboard: [[{ text: 'Approve', callback_data: 'a:' + post.no }]] });
  return { no: post.no, slide: slideNo, title: out.title, text: out.text };
}


// /edit <post> [<slide>|all] <plain-English instruction>: colours, sizes, gaps, fonts, pills, photo and wording of a slide (owner request 2026-10-21: /edit is the only edit command; /fix, /look and /looks were removed)
const STYLE_KEYS = ['titleColor', 'bodyColor', 'accent', 'accent2', 'ink', 'tagText', 'pillColor', 'pillTextColor', 'titleSize', 'bodySize', 'lineGap', 'font', 'upper'];
const EDIT_FONTS = ['Archivo Black', 'Poppins', 'Montserrat', 'Inter', 'Bebas Neue', 'DM Serif Display', 'Anton', 'Rubik', 'Fraunces', 'Space Mono'];
const isHex = (v) => /^#[0-9a-f]{3,8}$/i.test(String(v || ''));
// V2 posts (blueprint families + cine): slides are {type,title,sub,label,bullets,items,text,button,note,q|imageId}; the owner's request is turned into a patch of those fields
const V2_FIELDS = ['title', 'sub', 'label', 'bullets', 'items', 'text', 'button', 'note', 'q', 'imageId'];
async function editV2(post, spec, scope, instruction) {
  const idxs = scope === 'all' ? spec.slides.map((_, i) => i) : [Number(scope) - 1];
  const view = idxs.map((i) => { const x = spec.slides[i]; const o = { n: i + 1 }; for (const k of [...V2_FIELDS, 'style']) if (x[k] != null) o[k] = x[k]; return o; });
  const out = await gemini(`You edit slides of an Instagram carousel for Indian exporters, exactly as the owner asks. Slide type: ${spec.family || 'cine'} template.
OWNER'S REQUEST: ${instruction}
SLIDES YOU MAY CHANGE: ${JSON.stringify(view)}
Markup inside text: **x** = gold highlight, ==x== = highlight, newline = line break, ^ at line start in a cover title = coloured line.
Return JSON only: {"slides":{"<n>":{ ONLY the fields that change, same shape as above }},"summary":"one short sentence","cannot":""}
Allowed fields: title, sub, label, bullets (array of strings), items (array, keep each item's keys), text, button, note, q (2-4 English keywords for a NEW photo, only if the owner asks to change the picture), style {"titleColor":"#RRGGBB" (white headline/name text),"accentColor":"#RRGGBB" (gold/yellow text)} for colour requests.
Rules: plain easy English, no new facts or numbers, no duty/GST/licence claims. Size, spacing and layout are fixed by the template: if the owner asks only for that, set "cannot" to a short reason and say what you can do instead. Never return empty strings for fields that should stay.`);
  if (!out) throw new Error('no answer came back (Gemini quota?)');
  const patch = out.slides || {}; const changed = [];
  const sizesOk = (k, v) => (k === 'bullets' ? Array.isArray(v) && v.length : k === 'items' ? Array.isArray(v) && v.length : typeof v === 'string' ? v.trim() : k === 'style' ? v && typeof v === 'object' : true);
  for (const fn of ['spec.json', 'spec.pre-look.json']) {
    const file = path.join(post.dir, fn); const sp = readJson(file, null); if (!sp?.slides) continue;
    for (const [n, p] of Object.entries(patch)) { const sl = sp.slides[Number(n) - 1]; if (!sl || !idxs.includes(Number(n) - 1)) continue;
      for (const k of [...V2_FIELDS, 'style']) { if (p[k] == null || !sizesOk(k, p[k])) continue;
        if (k === 'style') { const st = {}; for (const c of ['titleColor', 'accentColor']) if (isHex(p.style[c])) st[c] = p.style[c]; if (Object.keys(st).length) sl.style = { ...(sl.style || {}), ...st }; else continue; }
        else sl[k] = p[k];
        if (k === 'q') { delete sl.imageId; delete sl.pick; }
        if (fn === 'spec.json' && !changed.includes(Number(n))) changed.push(Number(n)); } }
    fs.writeFileSync(file, JSON.stringify(sp, null, 2));
  }
  if (!changed.length) throw new Error(out.cannot || 'I could not turn that into a change to the words, photo or colours of this slide. Size and layout are fixed by the template of this post. Try e.g. /edit ' + post.no + ' 2 change the title to ... or make the photo show a port');
  for (const n of changed) if (patch[n]?.q) for (const x of ['img_' + String(n).padStart(2, '0') + '.jpg']) try { fs.unlinkSync(path.join(post.dir, x)); } catch { /* none */ }
  for (const n of changed) { const r = await run('../renderer/render.mjs', [path.join(post.dir, 'spec.json'), post.dir, '--only', String(n), '--keep-photos'], 8 * 60e3); if (r.code !== 0) throw new Error(r.err.slice(-200)); }
  if (scope === 'all' || changed.length > 1) await sendPreview(post);
  else await tg.sendPhoto(state.chatId, path.join(post.dir, 'slide_' + String(changed[0]).padStart(2, '0') + '.jpg'), '#' + post.no + ' slide ' + changed[0] + ': ' + (out.summary || 'changed'), { inline_keyboard: [[{ text: 'Approve', callback_data: 'a:' + post.no }, { text: 'Reject', callback_data: 'r:' + post.no }]] });
  return { no: post.no, scope, summary: out.summary, changed };
}
async function editSlides(post, scope, instruction) {
  const specFile = path.join(post.dir, 'spec.json'); const spec = readJson(specFile, null);
  if (!spec?.slides?.length) throw new Error('post #' + post.no + ' has no slides');
  if (spec.family || spec.template === 'cine') { if (scope !== 'all' && !spec.slides[Number(scope) - 1]) throw new Error('post #' + post.no + ' has no slide ' + scope + ' (it has ' + spec.slides.length + ')'); return editV2(post, spec, scope, instruction); }
  const idxs = scope === 'all' ? spec.slides.map((_, i) => i) : [Number(scope) - 1];
  if (idxs.some((i) => !spec.slides[i])) throw new Error('post #' + post.no + ' has no slide ' + scope + ' (it has ' + spec.slides.length + ')');
  const cur = spec.slides[idxs[0]];
  const out = await gemini(`You turn an owner's plain-English request into a design change for ONE slide (or all slides) of an Instagram carousel (1080x1080, dark overlay on a photo, big headline, body text, a gold/coloured tag and highlight).
OWNER'S REQUEST: ${instruction}
SCOPE: ${scope === 'all' ? 'all slides' : 'slide ' + scope}
CURRENT SLIDE: ${JSON.stringify({ title: cur.title, text: cur.text, items: cur.items, style: cur.style || {} })}
Return JSON only, include ONLY what the owner asked for:
{"style":{"titleColor":"#RRGGBB","bodyColor":"#RRGGBB","accent":"#RRGGBB (tag, highlights, bullets)","accent2":"#RRGGBB (purple highlight)","ink":"#RRGGBB (background overlay tint)","tagText":"#RRGGBB","pillColor":"#RRGGBB","pillTextColor":"#RRGGBB","titleSize":number px (default 56-96; bigger = 110+),"bodySize":number px (default 36; bigger = 44+),"lineGap":number px between text lines (default 14; more space = 30+),"font":one of ${JSON.stringify(EDIT_FONTS)},"upper":true|false for capital headlines},
"pills":["exact words from the slide to show as a rounded button/pill"],
"imageQuery":"2-4 English keywords for a NEW photo, only if the owner asked to change the picture",
"title":"new headline (max 7 words), only if the owner asked to change wording","text":"new body, one point per line separated by \\n, only if the owner asked to change wording; plain easy English, no new facts",
"reset":true if the owner wants to undo all custom styling of this slide,
"summary":"one short sentence saying what you changed"}
Convert colour names to hex. Relative requests ("bigger", "more space") are relative to the current style or the defaults above. If the request cannot be done with these fields, return {"summary":"", "cannot":"why"}.`);
  if (!out || out.cannot) throw new Error(out?.cannot || 'no answer came back (Gemini quota?)');
  const st = {};
  for (const k of STYLE_KEYS) { const v = out.style?.[k]; if (v == null || v === '') continue;
    if (/Color$|^accent|^ink$|tagText/.test(k)) { if (isHex(v)) st[k] = v; } else if (k === 'font') { if (EDIT_FONTS.includes(v)) st[k] = v; } else if (k === 'upper') st[k] = !!v; else if (Number.isFinite(Number(v))) st[k] = Number(v); }
  const pills = scope === 'all' ? [] : (out.pills || []).map(String).filter(Boolean);
  const newImg = scope === 'all' ? '' : String(out.imageQuery || '').trim();
  const newText = scope === 'all' ? null : (out.title || out.text ? { title: out.title, text: out.text } : null);
  if (!out.reset && !Object.keys(st).length && !pills.length && !newImg && !newText) throw new Error('I could not turn that into a change. Try e.g. /edit ' + post.no + ' 2 make the title yellow and bigger');
  const size = (t) => { const len = String(t).length; return len > 70 ? 60 : len > 50 ? 70 : len > 32 ? 82 : 96; };
  for (const fn of ['spec.json', 'spec.pre-look.json']) {
    const file = path.join(post.dir, fn); const sp = readJson(file, null); if (!sp?.slides) continue;
    for (const i of idxs) { const sl = sp.slides[i]; if (!sl) continue;
      if (out.reset) delete sl.style;
      if (Object.keys(st).length || pills.length) { sl.style = { ...(sl.style || {}), ...st }; if (pills.length) sl.style.pills = [...new Set([...(sl.style.pills || []), ...pills])]; }
      if (newText?.title) sl.title = newText.title; if (newText?.text) sl.text = newText.text;
      if (newText?.title && sl.layout) delete sl.size;
      if (newImg) { sl.imageQueries = [newImg]; sl.imageQuery = newImg; delete sl.imageId; delete sl.imageSkip; }
    }
    fs.writeFileSync(file, JSON.stringify(sp, null, 2));
  }
  if (newImg) { const n = String(idxs[0] + 1).padStart(2, '0'); for (const x of ['img_' + n + '.jpg', 'img_' + n + '.jpg.nophoto']) try { fs.unlinkSync(path.join(post.dir, x)); } catch { /* none */ } }
  const args = [specFile, post.dir]; if (scope !== 'all') args.push('--only', String(scope)); if (!newImg) args.push('--keep-photos');
  const r = await run('../renderer/render.mjs', args, 8 * 60e3);
  if (r.code !== 0) throw new Error(r.err.slice(-200));
  if (scope === 'all') await sendPreview(post);
  else await tg.sendPhoto(state.chatId, path.join(post.dir, 'slide_' + String(scope).padStart(2, '0') + '.jpg'), '#' + post.no + ' slide ' + scope + ': ' + (out.summary || 'changed'), { inline_keyboard: [[{ text: 'Approve', callback_data: 'a:' + post.no }]] });
  return { no: post.no, scope, summary: out.summary, style: st, pills, imageQuery: newImg };
}
async function onEditCommand(text, reply) {
  const m = text.match(/^\/edit\s+(\d+)\s+(?:(all|\d+)\s+)?([\s\S]+)/i); const post = m && byNo(m[1]);
  if (!m || !post) return reply(EDIT_HELP);
  if ((post.buffer || []).length) return reply('#' + post.no + ' is already in Buffer, so its slides cannot change here.');
  const scope = (m[2] || 'all').toLowerCase();
  await reply('Changing ' + (scope === 'all' ? 'all slides' : 'slide ' + scope) + ' of #' + post.no + ' (about a minute)...');
  return editSlides(post, scope, m[3].trim()).catch((e) => reply('Could not edit: ' + e.message));
}
const EDIT_HELP = 'Usage: /edit <post> <slide or all> <what you want>\nExample: /edit 21 2 make the title yellow and bigger. Post number = the # in the preview.';

// ---------- handlers ----------
async function onApprove(post, cb) {
  const slot = nextSlot();
  post.status = 'approved'; post.dueAt = slot.iso; post.approvedAt = new Date().toISOString(); save();
  const out = path.join(root, 'out', 'approved', path.basename(post.dir));
  fs.mkdirSync(out, { recursive: true });
  for (const f of fs.readdirSync(post.dir)) if (/^slide_\d+\.jpg$|\.pdf$|^caption\.txt$/.test(f)) fs.copyFileSync(path.join(post.dir, f), path.join(out, f));
  await ans(cb, 'Approved');
  const driveNote = copyToDrive(post);
  const caption = fs.readFileSync(path.join(post.dir, 'caption.txt'), 'utf8').trim();
  const bank = state.posts.filter((p) => p.status === 'approved' && !(p.buffer || []).length).length;
  await say(`Approved #${post.no} - added to the bank (${bank} approved waiting${bank > BANK_TARGET ? '; more than ' + BANK_TARGET + ' means the oldest were written with older learnings, so approve fewer at a time' : ''}).\nLead magnet: ${driveNote}.\nThe feeder puts it into Buffer on both accounts as soon as slots are free (checked every 30 min). You get a message when it is queued and another when it goes live.`);
  bg(runFeed().catch((e) => log('feed error:', e.message)));
}

async function onSwap(post, slide, cb) {
  const specFile = path.join(post.dir, 'spec.json');
  const spec = readJson(specFile, null);
  if (!spec || !spec.slides[slide - 1]) return ans(cb, 'No such slide');
  spec.slides[slide - 1].imageSkip = (spec.slides[slide - 1].imageSkip || 0) + 1;
  fs.writeFileSync(specFile, JSON.stringify(spec, null, 2));
  await ans(cb, `Swapping image ${slide}...`);
  const r = await run('../renderer/render.mjs', [specFile, post.dir, '--only', String(slide)], 3 * 60e3);
  if (r.code !== 0) return say(`Swap failed: ${r.err.slice(0, 200)}`);
  await tg.sendPhoto(state.chatId, path.join(post.dir, `slide_${String(slide).padStart(2, '0')}.jpg`), `#${post.no} slide ${slide} with a new photo`, { inline_keyboard: [[{ text: `Swap img ${slide} again`, callback_data: `s:${post.no}:${slide}` }, { text: 'Approve', callback_data: `a:${post.no}` }]] });
}

async function onCallback(cb) {
  if (!Object.values(state.chats).map(String).includes(String(cb.message?.chat?.id))) return ans(cb, 'Not authorised');
  const [kind, no, extra] = String(cb.data).split(':');
  const post = byNo(no);
  if (!post) return ans(cb, 'Unknown post');
  if (kind === 'a') return onApprove(post, cb);
  if (kind === 'r') { post.status = 'rejected'; save(); await ans(cb, 'Rejected'); return say(`Rejected #${post.no}. Tell me why in one line (reply to this message) and I will remember it.`, { reply_markup: { force_reply: true } }); }
  if (kind === 'm') {
    post.music ||= {}; const m = (post.music[extra] ||= {});
    m.added = true; m.addedAt = new Date().toISOString(); m.delayMin = m.liveAt ? Math.round((Date.now() - new Date(m.liveAt).getTime()) / 60e3) : null; save();
    return ans(cb, 'Recorded - the model will learn from music vs no music');
  }
  if (kind === 's') return onSwap(post, Number(extra), cb);
  if (kind === 'x') { await ans(cb); return onHookCommand('/hook ' + post.no, (t, x) => BOTS.main.sendMessage(state.chats.main, t, x)); }
  if (kind === 'h') { const opt = (post.hookOptions || [])[Number(extra)]; if (!opt) return ans(cb, 'Option expired, send /hook ' + post.no + ' again'); await ans(cb, 'Applying...'); return applyHook(post, opt).catch((e) => say('Could not apply the hook: ' + e.message)); }
  if (kind === 'c') { await ans(cb); return say(fs.readFileSync(path.join(post.dir, 'caption.txt'), 'utf8')); }
  if (kind === 'f') {
    await ans(cb);
    const rv = readJson(path.join(post.dir, 'review.json'), {});
    return say(`Facts to verify for #${post.no}:\n- ${(rv.claims || []).join('\n- ')}\n\n${rv.factcheck?.unverified ? 'None of these were auto-checked (search quota).' : (rv.factcheck?.issues?.length ? 'Flagged:\n' + rv.factcheck.issues.join('\n') : 'Auto-check found no problems.')}`);
  }
  if (kind === 'd') { await ans(cb); const pdf = fs.readdirSync(post.dir).find((f) => f.endsWith('.pdf')); return pdf ? tg.sendDocument(state.chatId, path.join(post.dir, pdf), `Lead magnet for "${post.keyword}"`) : say('No PDF found'); }
}

async function onMessage(m, who = 'main') {
  const chat = m.chat.id, text = (m.text || '').trim();
  const reply = (t, x) => BOTS[who].sendMessage(chat, t, x);
  if (!state.chats[who] && text.startsWith('/start')) {
    state.chats[who] = chat; if (who === 'main') state.chatId = chat; save(); log('paired', who, 'bot with chat', chat);
    return reply(who === 'test'
      ? 'Paired. This bot carries everything about the TEST account @exportimportwithfaizan: what is queued, go-live alerts with the post link and the music reminder, and its results charts.\nCommands: /status, /results'
      : 'Paired. This is the MAIN bot (@faizanali.shahji): approvals of new posts, reference posts you send me, queue, go-live alerts, music reminders and results charts.\nCommands: /status, /results, /run, /learn, /help');
  }
  if (String(chat) !== String(state.chats[who])) return reply('This bot is private.');
  if (who === 'fb') return onFbMessage(text, reply);
  if (who === 'main' && m.reply_to_message && m.reply_to_message.text?.startsWith('Rejected #')) {
    const no = Number(m.reply_to_message.text.match(/#(\d+)/)[1]); const p = byNo(no);
    if (p) { p.rejectReason = text; save(); const f = path.join(dataDir, 'feedback.json'); const fb = readJson(f, []); fb.push({ at: new Date().toISOString(), topic: p.topic, hook: p.hook, reason: text }); fs.writeFileSync(f, JSON.stringify(fb, null, 2)); }
    return reply('Noted. I will avoid that next time.');
  }
  if (who === 'main' && (m.photo || (m.document && /^image\//.test(m.document.mime_type || '')))) return collectReference(m);
  if (who === 'main' && /https?:\/\/\S+/.test(text)) return onReferenceLink(text.match(/https?:\/\/\S+/)[0], reply);
  if (who === 'main' && text === '/ref') return reply(REF_HELP);
  if (who === 'main' && text === '/help') return reply(HELP_MAIN);
  if (who === 'main' && /^\/edit\b/.test(text)) return onEditCommand(text, reply);
  if (who === 'main' && /^\/fresh\b/.test(text)) { const p = byNo(text.split(/\s+/)[1]); if (!p) return reply('Usage: /fresh 17 (new plain hook + new design for post #17)'); reply('Refreshing #' + p.no + ' (hook + design), about 2 minutes...'); return refreshPost(p).catch((e) => reply('Refresh failed: ' + e.message)); }
  if (who === 'main' && /^\/hook\b/.test(text)) return onHookCommand(text, reply);
  if (text === '/status') {
    const acct = who;
    const fmt = (d) => new Date(d).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) + ' IST';
    const startToday = new Date(istDate() + 'T00:00:00+05:30').getTime(); // midnight IST today: earlier posts are history, not queue
    const rows = state.posts.map((p) => {
      const e = (p.buffer || []).find((x) => String(x.account).startsWith(acct));
      const when = e?.dueAt || (who === 'main' && !(p.buffer || []).length ? p.dueAt : null);
      return { p, when: when ? new Date(when).getTime() : null };
    }).filter((r) => r.p.status === 'scheduled' && r.when && r.when >= startToday).sort((x, y) => x.when - y.when);
    const bank = who === 'main' ? state.posts.filter((p) => p.status === 'approved' && !(p.buffer || []).length).map((p) => '#' + p.no) : [];
    const head = rows.length ? 'SCHEDULED from today (' + rows.length + '), earliest first:\n' + rows.map((r) => '#' + r.p.no + ' ' + r.p.topic + ' | ' + fmt(r.when)).join('\n') : 'Nothing is scheduled from today onwards.';
    return reply(head + (bank.length ? '\n\nApproved, waiting for a free slot: ' + bank.join(', ') : ''));
  }
  if (text === '/results') { bg(sendResults(who).catch((e) => reply('Could not build the results image: ' + e.message))); return reply('Building the chart and the last-5 table...'); }
  if (who === 'main' && /^\/rules\b/.test(text)) return onRulesCommand(text, reply);
  if (who === 'main' && text === '/learn') { bg(relearn(true).catch((e) => say('Learning failed: ' + e.message))); return reply('Re-analysing all results...'); }
  if (who === 'main' && text === '/run') { bg(dailyRun(2, { force: true }).catch((e) => say('Daily run failed: ' + e.message))); return reply('Starting a daily run. This takes several minutes.'); }
  if (who === 'main' && text && !text.startsWith('/')) return onFreeText(text, reply);
  return reply(who === 'main' ? HELP_MAIN : 'Commands on this bot: /status (the queue of this account), /results (chart + last-5 table). Everything else is on the main bot.');
}

// plain text from the owner: a post number makes it a design edit of that post, anything else becomes a standing rule that is injected into every writing prompt
function onFbMessage(text, reply) {
  const cap = (p) => path.join(p.dir, 'caption_fb.txt');
  if (/^\/(start|help)\b/.test(text) || !text.startsWith('/')) return reply('Facebook bot for the page "Faizan Ali Shahji".\nEvery post you approve on the main bot is queued on Facebook automatically, 60 minutes after its main Instagram slot, as a multi-photo post with its OWN caption (written for older small-business readers, a question to get comments).\n\n/status - the Facebook queue\n/caption 21 - show the Facebook caption of post #21\n/fbedit 21 <new caption> - replace it (before it is queued)');
  if (/^\/status\b/.test(text)) {
    const ist = (d) => new Date(d).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) + ' IST';
    const l = state.posts.slice(-8).map((p) => '#' + p.no + ' [' + (p.fb ? 'queued ' + ist(p.fb.dueAt) : p.fbError ? 'FAILED: ' + p.fbError.slice(0, 60) : p.status === 'approved' ? 'waits for a slot' : p.status === 'scheduled' ? 'not on Facebook' : p.status) + '] ' + p.topic);
    return reply(l.join('\n') || 'No posts yet.');
  }
  let m = text.match(/^\/caption\s+(\d+)/); if (m) { const p = byNo(m[1]); if (!p) return reply('No post #' + m[1]); try { return reply('Facebook caption of #' + p.no + ':\n\n' + fs.readFileSync(cap(p), 'utf8')); } catch { return reply('#' + p.no + ' has no separate Facebook caption (the Instagram caption without hashtags is used).'); } }
  m = text.match(/^\/fbedit\s+(\d+)\s+([\s\S]+)/); if (m) { const p = byNo(m[1]); if (!p) return reply('No post #' + m[1]); if (p.fb) return reply('#' + p.no + ' is already queued on Facebook; change it in Buffer.'); fs.writeFileSync(cap(p), m[2].trim()); dirty = true; return reply('Saved. This caption is used when #' + p.no + ' is queued on Facebook.'); }
  return reply('Commands: /status, /caption N, /fbedit N <text>');
}
async function onFreeText(text, reply) {
  if (text.length < 15 || /\?\s*$/.test(text)) return reply(HELP_MAIN);
  const m = text.match(/(?:#|\bpost\s*(?:no\.?|number)?\s*|\bno\.?\s*)(\d{1,3})\b/i); const post = m && byNo(m[1]);
  if (post) {
    const sl = text.match(/\bslide\s*(\d+)\b/i);
    await reply('Reading that as a design edit of post #' + post.no + (sl ? ' slide ' + sl[1] : ' (all slides)') + '. One moment...');
    return onEditCommand('/edit ' + post.no + ' ' + (sl ? sl[1] : 'all') + ' ' + text, reply);
  }
  const n = addDirective(text);
  return reply('Saved as standing rule #' + n + ' - I add it to every post I write from now on:\n"' + text.slice(0, 300) + '"\n\n/rules lists them, "/rules remove ' + n + '" deletes this one. Changes to one existing post: name it, e.g. "post 21 slide 2 make the title yellow".');
}
function onRulesCommand(text, reply) {
  const f = path.join(dataDir, 'directives.json'); const d = readJson(f, []);
  const rm = text.match(/^\/rules\s+(?:remove|delete)\s+(\d+)/i);
  if (rm) { const i = Number(rm[1]) - 1; if (!d[i]) return reply('No rule number ' + rm[1] + '.'); const [gone] = d.splice(i, 1); fs.writeFileSync(f, JSON.stringify(d, null, 2)); dirty = true; return reply('Removed: "' + gone.text.slice(0, 120) + '"'); }
  return reply(d.length ? 'Standing rules (used in every new post):\n' + d.map((x, i) => (i + 1) + '. ' + x.text).join('\n') + '\n\n"/rules remove N" deletes one.' : 'No standing rules yet. Send me any plain message (no /) and I will save it as one.');
}

async function pollLoop(who = 'main') {
  const bot = BOTS[who];
  if (!bot.hasToken()) return log('no token for the ' + who + ' bot; polling disabled' + (who === 'test' ? ' (set TELEGRAM_BOT_TOKEN_TEST in .env)' : ''));
  log(who, 'telegram polling started', state.chats[who] ? '(paired)' : '(waiting for /start)');
  for (;;) {
    try {
      const updates = await bot.getUpdates(state.offsets[who] || 0, 25);
      for (const u of updates) {
        state.offsets[who] = u.update_id + 1;
        try { if (u.callback_query) { u.callback_query._who = who; await onCallback(u.callback_query); } else if (u.message) await onMessage(u.message, who); }
        catch (e) { log('handler error:', e.message); }
      }
      if (updates.length) save();
    } catch (e) { log('poll error:', e.message); await sleep(e.message.includes('Conflict') ? 30000 : 5000); }
  }
}

// ---------- daily run ----------
let running = false;
// Bank cap: every post waiting (approved-not-queued + awaiting approval) was written with older knowledge, so keep that pile small
// and refill it only as it drains. Automatic runs obey the cap; a manual /run from Telegram bypasses it.
const BANK_TARGET = 4;
const pipelineSize = () => state.posts.filter((p) => (p.status === 'approved' && !(p.buffer || []).length) || p.status === 'awaiting_approval').length;
const DAILY_AT = { h: 11, m: 30 }; // IST; n8n triggers it, the studio catches up if the laptop was off at that time
const istNow = () => new Date(Date.now() + 5.5 * 3600e3);
const istDate = () => istNow().toISOString().slice(0, 10);
const ranToday = () => state.lastDailyRunDate === istDate();
// first start with this feature: a post already drafted today counts as today's run
if (!state.lastDailyRunDate) { const last = state.posts.map((p) => p.createdAt).filter(Boolean).sort().pop(); if (last) state.lastDailyRunDate = new Date(new Date(last).getTime() + 5.5 * 3600e3).toISOString().slice(0, 10); }
async function dailyRun(count = 2, { force = false } = {}) {
  if (running) return { started: false, reason: 'already running' };
  if (!force) {
    if (ranToday()) return { started: false, reason: 'already ran today' };
    state.lastDailyRunDate = istDate(); save();
    const room = BANK_TARGET - pipelineSize();
    if (room <= 0) { log(`daily run skipped: ${pipelineSize()} posts already waiting (cap ${BANK_TARGET})`); await say(`Daily run skipped: ${pipelineSize()} posts are already waiting for approval or a slot (cap ${BANK_TARGET}). Approve or reject those first - newer posts are written with newer learnings.`); return { started: false, reason: 'bank full' }; }
    count = Math.min(count, room);
  }
  running = true;
  try {
    await say(`Daily run started (${count} carousels). I will send previews here.`);
    const used = new Set(state.posts.map((p) => (p.keyword || '').toUpperCase()));
    const c = await run('concepts.mjs', [String(count + 3)]);
    if (c.code !== 0) throw new Error('concept planning failed: ' + c.err.slice(-300));
    const concepts = readJson(path.join(dataDir, 'concepts-latest.json'), { concepts: [] }).concepts;
    const picks = [];
    concepts.forEach((x, i) => { if (picks.length < count && x.offer?.keyword && !used.has(String(x.offer.keyword).toUpperCase())) picks.push(i + 1); });
    if (!picks.length) throw new Error('no fresh concepts (all keywords already used)');
    const h = await run('hooks.mjs', picks.map(String));
    if (h.code !== 0) throw new Error('hooks failed: ' + h.err.slice(-300));
    const hk = readJson(path.join(dataDir, 'hooks-latest.json'), { hooks: [] });
    const hooks = Array.isArray(hk) ? hk : (hk.hooks || Object.values(hk).find(Array.isArray) || []);
    for (const no of picks) {
      const hs = hooks.find((x) => Number(x.concept) === no);
      const best = hs?.options?.[hs?.best_index ?? 0]; const opt = (best && plainCheck(best.hook).ok ? best : (hs?.options || []).find((o) => plainCheck(o.hook).ok)) || best || hs?.options?.[0]; // plain English first
      if (!opt) { await say(`Skipped concept ${no}: no hook.`); continue; }
      const sub = /comment|dm\b/i.test(opt.sub || '') ? 'Illustrative case. Here is what to check before it happens to you.' : opt.sub;
      const r = await run('make-from-concept.mjs', [String(no), '--hook', opt.hook, '--sub', sub]);
      if (r.code !== 0) { await say(`Generation failed for concept ${no}: ${r.err.slice(-200)}`); continue; }
      const info = JSON.parse(r.out.trim().slice(r.out.indexOf('{')));
      const concept = concepts[no - 1];
      let lookName = 'ink-gold'; // design rotation: never one of the last 4 looks
      if (info.template) lookName = 'winner-' + info.template; // owner's winning templates have one fixed look (black + literal photo + one accent colour)
      else try { lookName = pickLook(state.posts); if (lookName !== 'ink-gold') { const lr = await run('looks.mjs', ['apply', info.outDir, lookName], 10 * 60e3); if (lr.code !== 0) throw new Error(lr.err.slice(-200)); } } catch (e) { log('look failed, keeping the original look:', e.message); lookName = 'ink-gold'; }
      const post = { no: ++state.seq, id: info.id, dir: info.outDir, topic: concept.title, hook: opt.hook, keyword: info.keyword, leadmagnet: path.basename(info.pdf || ''), look: lookName, status: 'awaiting_approval', createdAt: new Date().toISOString() };
      post.template = info.template || null;
      state.posts.push(post); save();
      await sendPreview(post);
      try { const fbc = fs.readFileSync(path.join(post.dir, 'caption_fb.txt'), 'utf8').trim(); if (fbc) await sendFb('Facebook caption for new post #' + post.no + ' (used automatically when you approve it on the main bot):\n\n' + fbc + '\n\nChange it with: /fbedit ' + post.no + ' <new caption>'); } catch { /* no fb caption */ }
    }
    return { started: true };
  } catch (e) { await say('Daily run failed: ' + e.message + '\nSend /run to try again.'); throw e; }
  finally { running = false; }
}

// ---------- reference posts: owner sends slides of a post that worked, the studio builds a similar-but-better one ----------
let refBuf = null; let referenceRunning = false;
function collectReference(m) {
  if (TICK) { // persisted buffer: slides of one album arrive in the same run or the next one
    state.refBuf ||= { items: [], caption: '' }; const b = state.refBuf;
    b.items.push({ id: m.message_id, fileId: m.photo ? m.photo[m.photo.length - 1].file_id : m.document.file_id, ext: m.document ? (path.extname(m.document.file_name || '') || '.jpg') : '.jpg' });
    if (m.caption) b.caption = m.caption; b.at = Date.now(); save(); return;
  }
  refBuf ||= { items: [], caption: '' };
  const fileId = m.photo ? m.photo[m.photo.length - 1].file_id : m.document.file_id;
  refBuf.items.push({ id: m.message_id, fileId, ext: m.document ? (path.extname(m.document.file_name || '') || '.jpg') : '.jpg' });
  if (m.caption) refBuf.caption = m.caption;
  clearTimeout(refBuf.timer);
  refBuf.timer = setTimeout(() => { const b = refBuf; refBuf = null; startReference(b).catch((e) => say('Reference job failed: ' + e.message)); }, 10000); // wait 10s for the rest of the slides
}
async function onReferenceLink(url, reply) {
  if (!/instagram\.com|instagr\.am/i.test(url)) {
    try { // other pages: try the public preview image
      const html = await (await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 Chrome/124' }, signal: AbortSignal.timeout(15000) })).text();
      const og = (html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i) || [])[1];
      if (og) {
        const jobDir = path.join(root, 'out', 'reference', Date.now().toString(36)); fs.mkdirSync(jobDir, { recursive: true });
        const f = path.join(jobDir, 'ref_01.jpg'); fs.writeFileSync(f, Buffer.from(await (await fetch(og.replace(/&amp;/g, '&'))).arrayBuffer()));
        const cap = (html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)/i) || [])[1] || '';
        await reply('Found one preview image on that page. Building from it (a single image gives me less to copy than a full set of slides).');
        return runReferenceJob(jobDir, [f], cap, url);
      }
    } catch { /* fall through to the explanation */ }
  }
  state.pendingRef = { url, at: Date.now() }; save();
  return reply("I can't read a post from its link: Instagram shows scripts nothing without a login (I tested your own public posts, and I won't put your password in a bot). Please send the slides as screenshots/photos, all together in one message, and I'll build from them. I kept the link as the source.");
}
async function startReference(b) {
  const jobDir = path.join(root, 'out', 'reference', Date.now().toString(36)); fs.mkdirSync(jobDir, { recursive: true });
  const files = [];
  for (const [i, it] of b.items.sort((x, y) => x.id - y.id).slice(0, 10).entries()) files.push(await tg.mainBot.downloadFile(it.fileId, path.join(jobDir, 'ref_' + String(i + 1).padStart(2, '0') + it.ext)));
  const url = state.pendingRef && Date.now() - state.pendingRef.at < 30 * 60e3 ? state.pendingRef.url : null;
  return runReferenceJob(jobDir, files, b.caption, url);
}
async function runReferenceJob(jobDir, files, note, url) {
  if (referenceRunning) return say('A reference post is still being built. Send this one again in a few minutes.');
  referenceRunning = true;
  try {
    fs.writeFileSync(path.join(jobDir, 'meta.json'), JSON.stringify({ files, note, caption: note, url }, null, 2));
    await say('Got ' + files.length + ' slide(s). Reading the hook, structure, caption style, colours and font, then writing our version with caption and PDF. About 5-10 minutes.');
    const r = await run('reference.mjs', [jobDir], 30 * 60e3);
    if (r.code !== 0) {
      if (/quota/i.test(r.err)) throw new Error('Gemini free quota is used up for today on every model (it resets about 12:30 IST). Send the same screenshots again after that and the build will run.');
      throw new Error(r.err.split('\n').filter((l) => l && !/^\s+at |^Node\.js v/.test(l)).slice(-3).join(' | ').slice(0, 400));
    }
    const info = JSON.parse(r.out.trim().slice(r.out.indexOf('{')));
    const post = { no: ++state.seq, id: info.id, dir: info.outDir, topic: info.title, hook: info.hook, keyword: info.keyword, leadmagnet: path.basename(info.pdf || ''), status: 'awaiting_approval', kind: 'reference', look: 'reference', boost: true, reference: { url, pattern: info.pattern, tweak: info.tweak }, createdAt: new Date().toISOString() };
    state.posts.push(post); save();
    try { // outside evidence for the learning analyst (a competitor's post is a hypothesis, never our own result)
      const refs = readJson(path.join(dataDir, 'references.json'), []);
      const st = readJson(path.join(jobDir, 'style.json'), {});
      refs.push({ at: new Date().toISOString(), postNo: post.no, source: url || 'screenshots', ownerNote: String(note || '').slice(0, 300), hookText: st.hook_text, hookPattern: st.hook_pattern, slideCount: st.slide_count, ctaType: st.cta?.type, captionStyle: st.caption_style, whyItWorks: st.why_it_works, theme: st.design?.theme_guess });
      fs.writeFileSync(path.join(dataDir, 'references.json'), JSON.stringify(refs.slice(-40), null, 2));
    } catch (e) { log('could not save reference evidence:', e.message); }
    await sendPreview(post);
    const caption = fs.readFileSync(path.join(post.dir, 'caption.txt'), 'utf8').trim();
    await say('BUILT FROM YOUR REFERENCE (#' + post.no + ')\nKept from the original: ' + info.pattern + ' | ' + info.slideCount + ' slides | look: ' + [info.look?.font, info.look?.typographic ? 'typographic' : 'photo style'].filter(Boolean).join(', ') + '\nOur tweak: ' + info.tweak + '\nWhy the original works: ' + (info.why || []).slice(0, 3).join('; ') + '\n\nEvery word, image and number is fresh (nothing copied).\nWhen you approve it goes to the front of the queue. At go-live each account gets the post link and the track to add.\n\nCAPTION:\n' + caption);
  } finally { referenceRunning = false; }
}

// ---------- results charts (image per account, sent by that account's bot) ----------
const HANDLE = { main: '@faizanali.shahji', test: '@exportimportwithfaizan' };
async function renderReport(script, acct, name) {
  const out = path.join(root, 'out', 'reports', name + '-' + acct + '-' + new Date().toISOString().slice(0, 10) + '.png');
  const r = await run('../renderer/' + script, [acct, out], 3 * 60e3);
  if (r.code !== 0) throw new Error(r.err.slice(-200));
  return out;
}
// on request only (/results, /table): the colour chart and the last-5 table. Nothing here is sent automatically any more (owner, 2026-10-20).
async function sendResults(acct, { table = true } = {}) {
  const img = await renderReport('results-image.mjs', acct, 'results');
  await photoTo(acct, img, 'Results for ' + HANDLE[acct] + '. Each post keeps one colour: its bar and its growth curve match.');
  if (table) await sendTable(acct);
}
async function sendTable(acct) {
  const img = await renderReport('results-table.mjs', acct, 'table');
  await photoTo(acct, img, 'Last 5 posts of ' + HANDLE[acct] + ': first 24 hours (views, likes, comments, shares, saves, follows).');
}

// daily 24-hour digest as TEXT: one message per account, at most once per IST day (first sync after 09:00 IST that has a new 24h reading)
const baselineViews = (acct) => { const m = readJson(path.join(dataDir, 'learning-model.json'), null); return ((m?.baseline || readJson(path.join(dataDir, 'learnings.json'), {}).baseline || {})[acct] || {}).views || 0; };
if (!state.lastDigestAt) state.lastDigestAt = Date.now() - 30 * 3600e3; // first run: only 24h readings from the last 30 hours count as new
const fresh24 = (acct) => state.posts.filter((p) => { const sn = p.metrics?.[acct]?.h24; return sn && new Date(sn.at).getTime() > (state.lastDigestAt || 0); }).sort((a, b) => a.no - b.no);
const num = (v) => (v == null ? 'n/a' : Number(v).toLocaleString('en-IN'));
function digestText(acct) {
  const rows = fresh24(acct); if (!rows.length) return null;
  const base = baselineViews(acct);
  const body = rows.map((p) => {
    const m = p.metrics[acct].h24; const vs = base ? ' (' + (m.views >= base ? '+' : '') + Math.round(((m.views - base) / base) * 100) + '% vs your normal)' : '';
    return '#' + p.no + ' ' + String(p.hook || p.topic || '').replace(/\s+/g, ' ').slice(0, 70) + '\nViews ' + num(m.views) + vs + '\nLikes ' + num(m.likes) + ' | Comments ' + num(m.comments) + ' | Shares ' + num(m.shares) + ' | Saves ' + num(m.saves) + ' | Follows ' + num(m.follows);
  }).join('\n\n');
  return '24-HOUR RESULTS ' + HANDLE[acct] + ' (' + istDate() + ')\n\n' + body + '\n\nChart and the last-5 table: send /results';
}
const digestDue = () => state.lastDigestDate !== istDate() && istNow().getUTCHours() >= 9 && (fresh24('main').length || fresh24('test').length);
async function sendDigest() {
  for (const acct of ['main', 'test']) { const t = digestText(acct); if (t) await sendTo(acct, t); }
  if (state.lastReport?.main) await say(state.lastReport.main); // learning report: kept, but only inside the daily digest
  state.lastDigestAt = Date.now(); state.lastDigestDate = istDate(); save();
}

// ---------- learning loop ----------
async function relearn(announce, earlyOnly = false) {
  const r = await run('learn.mjs', [], 5 * 60e3);
  if (r.code !== 0) { log('learn failed:', r.err.slice(-200)); return { error: r.err.slice(-200) }; }
  const out = JSON.parse(r.out.trim().slice(r.out.indexOf('{')));
  state.lastReport = { main: out.report, at: new Date().toISOString() }; save();
  if (announce) { await say(out.report); if (out.reportTest) await sendTo('test', out.reportTest); } // only a manual /learn announces now; the daily digest carries the report otherwise
  return { posts: out.posts, best: out.best };
}

// ---------- data posts: built from the Comtrade snapshot, no AI-written facts ----------
async function dataPosts(codes) {
  const out = [];
  for (const hs of codes) {
    const exists = state.posts.find((p) => p.dataHs === hs && p.status !== 'rejected');
    if (exists) { out.push({ hs, skipped: 'already post #' + exists.no }); continue; }
    const r = await run('data-post.mjs', [hs]);
    if (r.code !== 0) { await say(`Data post ${hs} failed: ${r.err.slice(-200)}`); out.push({ hs, error: true }); continue; }
    const info = JSON.parse(r.out.trim().slice(r.out.indexOf('{')));
    const post = { no: ++state.seq, id: info.id, dir: info.outDir, topic: info.topic, hook: info.hook, keyword: info.keyword, leadmagnet: path.basename(info.pdf || ''), status: 'awaiting_approval', kind: 'data', dataHs: hs, createdAt: new Date().toISOString() };
    state.posts.push(post); save();
    await sendPreview(post);
    out.push({ hs, no: post.no });
  }
  return out;
}

async function doInsightsSync() {
  const r = await syncInsights(state); save();
  try { fs.writeFileSync(path.join(dataDir, 'slot-model.json'), JSON.stringify(buildSlotModel(), null, 2)); } catch (e) { log('slot model failed:', e.message); }
  // per-result messages are no longer sent (owner 2026-10-20: too frequent); the 24h numbers go out once a day as a text digest
  // learning loop: new 24h/72h/7d results -> re-learn -> directives for the next generation + bank ranking
  let learned = null;
  if (r.updated > 0 || !fs.existsSync(path.join(dataDir, 'learning-model.json'))) learned = await relearn(false); // full report only for 24h/72h/7d results; h6-only updates send the short early read
  if (digestDue()) await sendDigest().catch((e) => log('digest failed:', e.message));
  return { updated: r.updated, messages: r.messages.length, history: r.historyCount, baseline: r.baseline, learned };
}

// ---------- http ----------
const server = http.createServer(async (req, res) => {
  const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
  try {
    if (req.method === 'GET' && req.url === '/health') return send(200, { ok: true, paired: !!state.chatId, bots: { main: !!state.chats.main, test: !!state.chats.test, testConfigured: BOTS.test.hasToken() }, running, posts: state.posts.length });
    if (req.headers['x-studio-token'] !== STUDIO_TOKEN) return send(401, { error: 'unauthorised' });
    if (req.method === 'POST' && req.url.startsWith('/daily-run')) { if (req.url.includes('retry=1')) { state.lastDailyRunDate = null; save(); } dailyRun().catch((e) => log('daily run error:', e.message)); return send(202, { started: true }); }
    if (req.method === 'POST' && req.url.startsWith('/preview/')) { const p = byNo(req.url.split('/')[2]); if (!p) return send(404, { error: 'no such post' }); await sendPreview(p); return send(200, { sent: p.no }); }
    if (req.method === 'POST' && (req.url === '/feed' || req.url === '/feed?dry=1')) { const out = await runFeed(req.url.endsWith('dry=1')).catch((e) => ({ error: e.message })); return send(200, out); }
    if (req.method === 'POST' && req.url.startsWith('/data-posts')) { const codes = (new URL(req.url, 'http://x').searchParams.get('hs') || '').split(',').filter(Boolean); dataPosts(codes).then((o) => log('data posts:', JSON.stringify(o))).catch((e) => log('data posts error:', e.message)); return send(202, { started: codes }); }
    if (req.method === 'POST' && req.url === '/insights-sync') return send(200, await doInsightsSync());
    if (req.method === 'POST' && req.url.startsWith('/refresh/')) { const nos = req.url.split('/')[2].split(','); const outc = []; for (const n of nos) { const p = byNo(n); if (!p) { outc.push({ no: n, error: 'no such post' }); continue; } try { outc.push(await refreshPost(p)); } catch (e) { outc.push({ no: n, error: e.message }); } } return send(200, outc); }
    if (req.method === 'POST' && req.url.startsWith('/fix/')) { const u = new URL(req.url, 'http://x'); const [, , no, sl] = u.pathname.split('/'); const p = byNo(no); if (!p) return send(404, { error: 'no such post' }); return send(200, await fixSlide(p, Number(sl), u.searchParams.get('i') || '').catch((e) => ({ error: e.message }))); }
    if (req.method === 'POST' && req.url === '/learn') { const out = await relearn(true); return send(200, out); }
    if (req.method === 'POST' && req.url.startsWith('/results')) { const acct = new URL(req.url, 'http://x').searchParams.get('acct') || 'main'; await sendResults(acct); return send(200, { sent: acct }); }
    if (req.method === 'POST' && req.url === '/learn-quiet') { const out = await relearn(false); return send(200, out); }
    return send(404, { error: 'not found' });
  } catch (e) { log('http error:', e.message); return send(500, { error: e.message }); }
});

// ---------- go-live watcher: tells you (Telegram) when Buffer has published a post, with the WhatsApp channel text ready to paste ----------
const DRIVE_FOLDER = readJson(path.join(dataDir, 'config.json'), {}).driveFolder || ''; // private config (data repo), not in the public code
const SUPERPROFILE_CONNECTED = ['main']; // accounts connected to Superprofile AutoDM (test is not)
function channelPostText(p) {
  const lm = readJson(path.join(dataDir, 'leadmagnets.json'), { magnets: {} }).magnets || {};
  const link = lm[p.keyword]?.viewLink || DRIVE_FOLDER;
  let title = p.topic;
  try { title = readJson(path.join(p.dir, 'leadmagnet.json'), {}).title || title; } catch { /* keep topic */ }
  return [
    'FREE GUIDE: ' + title,
    '',
    p.hook,
    '',
    'Download here: ' + link,
    '(Comment ' + p.keyword + ' on the Instagram post to get it by DM too.)',
  ].join('\n');
}
let watching = false;
const CHECK_AFTER_MIN = [3, 25, 60, 180, 360]; // minutes after the due time
function resetChecksOnStart() { // after a restart, give posts due in the last 48h a fresh set of checks so a missed go-live is announced
  for (const p of state.posts) for (const e of p.buffer || []) if (!(p.notified || {})[e.bufferId] && e.dueAt && Date.now() - new Date(e.dueAt).getTime() < 48 * 3600e3 && (e.checks || 0) >= CHECK_AFTER_MIN.length) { e.checks = 0; e.lastCheck = 0; }
  save();
}
async function goLiveWatcher() {
  if (watching || !Object.keys(state.chats).length) return;
  // Buffer's API is rate limited (24h window): only call it when some scheduled post is due (or overdue) and not yet announced
  // Each post/channel is checked at most 5 times: 3, 13, 25, 60 and 180 minutes after its due time (min. 10 min apart), then never again by the timer.
  const due = [];
  for (const p of state.posts) for (const e of p.buffer || []) {
    const k = e.checks || 0;
    if ((p.notified || {})[e.bufferId] || !e.dueAt || k >= CHECK_AFTER_MIN.length) continue;
    if (Date.now() >= Math.max(new Date(e.dueAt).getTime() + CHECK_AFTER_MIN[k] * 60e3, (e.lastCheck || 0) + 10 * 60e3)) due.push(e);
  }
  if (!due.length) return;
  if ((readJson(path.join(dataDir, 'buffer-cooldown.json'), {}).until || 0) > Date.now()) return; // Buffer rate-limit pause: do not spend a check, ask again after it ends
  for (const e of due) e.lastCheck = Date.now(); // spacing only; the check is COUNTED below, once Buffer really answered
  save();
  watching = true;
  try {
    const sent = await sentByIds(due);
    for (const e of due) e.checks = (e.checks || 0) + 1; save();
    for (const p of state.posts) {
      p.notified ||= {};
      for (const e of p.buffer || []) {
        const hit = sent.find((x) => x.id === e.bufferId);
        if (!hit || p.notified[e.bufferId]) continue;
        const acct = e.account.split(' ')[0];
        const warn = SUPERPROFILE_CONNECTED.includes(acct) ? '' : '\nNOTE: this account is not connected to Superprofile, so comments here get no auto-DM.';
        const when = new Date(hit.sentAt).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
        const track = p.musicUsed?.[acct];
        const link = hit.externalLink || null;
        p.music ||= {}; p.music[acct] = { added: false, liveAt: hit.sentAt || new Date().toISOString(), bufferId: e.bufferId, link };
        const stale = Date.now() - new Date(hit.sentAt || Date.now()).getTime() > 3 * 3600e3;
        const musicLine = stale ? `(Published ${Math.round((Date.now() - new Date(hit.sentAt).getTime()) / 3600e3)} h ago, this alert came late. If you can still add music: Open the post > ... > Edit > Add music${track ? ' > search: ' + track : ''}.)

` : `ADD MUSIC NOW (Instagram's API cannot add it; posts with trending music get more reach, and the first hour matters most):\nOpen the post > ... > Edit > Add music${track ? ' > search: ' + track : ' > pick a trending instrumental'}\n\n`;
        const channelText = acct === 'main' ? `WhatsApp channel post - copy and paste:\n\n${channelPostText(p)}` : '(WhatsApp channel text is sent by the main bot.)';
        await sendTo(acct, `LIVE on ${e.account} (published ${when} IST)\n#${p.no} ${p.topic}\n${link || '(link not available yet)'}${warn}\n\n${musicLine}${channelText}`, { reply_markup: musicButtons(p.no, acct, link) });
        p.notified[e.bufferId] = new Date().toISOString(); save();
      }
    }
  } catch (err) { log('go-live watcher error:', err.message); } finally { watching = false; }
}
// one reminder, 40 min after go-live, if the music step has not been confirmed (no Buffer API call needed)
const musicButtons = (no, acct, link) => ({ inline_keyboard: [...(link && /^https?:/.test(link) ? [[{ text: 'Open the post', url: link }]] : []), [{ text: 'Music added', callback_data: `m:${no}:${acct}` }]] });
async function musicReminders() {
  if (!Object.keys(state.chats).length) return;
  for (const p of state.posts) {
    for (const [acct, m] of Object.entries(p.music || {})) {
      if (m.added || m.reminded || !m.liveAt) continue;
      const age = Date.now() - new Date(m.liveAt).getTime();
      if (age < 40 * 60e3 || age > 12 * 3600e3) continue;
      if (!m.link) { try { const hit = (await sentByIds([{ bufferId: m.bufferId }]))[0]; if (hit?.externalLink) m.link = hit.externalLink; } catch { /* Buffer unavailable: fall back to the profile */ } }
      const handle = acct === 'main' ? 'faizanali.shahji' : 'exportimportwithfaizan';
      const link = m.link || `https://www.instagram.com/${handle}/`;
      m.reminded = true; save();
      await sendTo(acct, `REMINDER: music is not added yet - #${p.no} "${p.topic}" on @${handle}.\nOpen the post: ${link}\nThen ... > Edit > Add music${p.musicUsed?.[acct] ? ' > search: ' + p.musicUsed[acct] : ''}. The first hours decide reach.`, { reply_markup: musicButtons(p.no, acct, m.link || link) });
    }
  }
}
// catch-up: if today's 11:30 run never happened (laptop was off or asleep, n8n down), run it as soon as the studio is up and it is past 11:30 IST
function catchUpDaily() {
  const t = istNow(); const past = t.getUTCHours() > DAILY_AT.h || (t.getUTCHours() === DAILY_AT.h && t.getUTCMinutes() >= DAILY_AT.m + (TICK ? 0 : 5));
  if (!past || t.getUTCHours() >= 23 || ranToday() || running || !state.chats?.main) return;
  log('daily run catch-up (it did not run at 11:30 IST today)');
  // bg(): in the cloud tick the process must wait for the run, else exit(0) kills it mid-render (drafts were lost 13-19 Oct)
  bg(dailyRun().catch((e) => { log('daily run error:', e.message); if (state.lastDailyRunDate === istDate() && !state.posts.some((p) => p.createdAt && p.createdAt.slice(0, 10) === new Date().toISOString().slice(0, 10))) { state.lastDailyRunDate = null; save(); } }));
}
const MENU_VERSION = 'v5-2026-10-21-cleanup';
function setMenus() {
  const main = [['status', 'Scheduled posts from today onwards'], ['results', 'Colour results chart + last-5 table'], ['run', 'Write new posts now'], ['learn', 'Re-read results, update the plan'], ['hook', 'Plain-English hooks: /hook 17'], ['fresh', 'New hook + design: /fresh 17'], ['edit', 'Change a slide: wording, colours, photo: /edit 21 2 ...'], ['rules', 'Your standing rules (any plain message adds one)'], ['ref', 'How to copy a competitor post'], ['help', 'All commands']].map(([command, description]) => ({ command, description }));
  BOTS.main.setCommands(main).catch((e) => log('commands menu:', e.message));
  if (BOTS.test.hasToken()) BOTS.test.setCommands([{ command: 'status', description: 'Queue of this account' }, { command: 'results', description: 'Colour chart + last-5 table' }]).catch(() => {});
  if (BOTS.fb.hasToken()) BOTS.fb.setCommands([{ command: 'status', description: 'Facebook queue' }, { command: 'caption', description: 'Show a post Facebook caption: /caption 21' }, { command: 'fbedit', description: 'Change it: /fbedit 21 new caption' }, { command: 'help', description: 'How it works' }]).catch(() => {});
  state.cmdMenu = MENU_VERSION; save();
}
if (!TICK) {
setInterval(catchUpDaily, 15 * 60e3);
setTimeout(catchUpDaily, 90e3);
setInterval(musicReminders, 5 * 60e3);
setInterval(goLiveWatcher, 5 * 60e3);
setTimeout(() => { resetChecksOnStart(); goLiveWatcher(); }, 25e3);

server.listen(PORT, '127.0.0.1', () => { log(`studio listening on http://127.0.0.1:${PORT}`); pollLoop('main'); pollLoop('test'); pollLoop('fb');
  setMenus();
});
}

// ---------- cloud run (GitHub Actions): scheduler + Telegram polling + watchers in one bounded process ----------
const FEED_AT = ['08:45', '13:30', '17:30', '22:00'], SYNC_AT = ['03:30', '09:30', '15:30', '21:30']; // IST
function dueNow(list, tag) { // true once per listed time of day; if several were missed only one run happens
  const hm = istNow().toISOString().slice(11, 16), day = istDate(); state.sched ||= {};
  const due = list.filter((x) => hm >= x && !state.sched[tag + '@' + day + '@' + x]);
  if (!due.length) return false;
  for (const x of due) state.sched[tag + '@' + day + '@' + x] = true;
  for (const k of Object.keys(state.sched)) if (!k.includes(day) && k.split('@')[1] < new Date(Date.now() + 5.5 * 3600e3 - 3 * 864e5).toISOString().slice(0, 10)) delete state.sched[k];
  save(); return true;
}
async function pollOnce(who, timeout = 0) {
  const bot = BOTS[who]; if (!bot.hasToken()) return 0;
  try {
    const updates = await bot.getUpdates(state.offsets[who] || 0, timeout);
    for (const u of updates) {
      state.offsets[who] = u.update_id + 1;
      try { if (u.callback_query) { u.callback_query._who = who; await onCallback(u.callback_query); } else if (u.message) await onMessage(u.message, who); }
      catch (e) { log('handler error:', e.message); }
    }
    if (updates.length) save();
    return updates.length;
  } catch (e) { log('poll error:', e.message); await sleep(2000); return 0; }
}
function flushReference() {
  const b = state.refBuf; if (!b || Date.now() - (b.at || 0) < 25e3) return;
  state.refBuf = null; save();
  bg(startReference(b).catch((e) => say('Reference job failed: ' + e.message)));
}
// posts dropped into <data>/inbox/*.json by the laptop are registered here, inside the run that owns the state (editing state.json from outside gets overwritten by the run's own save)
// <data>/queue/*.json: one post at a time; the next is sent as soon as no v2 post is waiting for approval (i.e. the previous one was approved or rejected)
function releaseQueue() {
  if (state.posts.some((p) => p.look === 'v2' && p.status === 'awaiting_approval')) return;
  const q = path.join(dataDir, 'queue'); let files = [];
  try { files = fs.readdirSync(q).filter((f) => f.endsWith('.json')).sort(); } catch { return; }
  if (!files.length) return;
  const ib = path.join(dataDir, 'inbox'); fs.mkdirSync(ib, { recursive: true });
  fs.renameSync(path.join(q, files[0]), path.join(ib, files[0]));
}
async function ingestInbox() {
  releaseQueue();
  const d = path.join(dataDir, 'inbox'); let files = [];
  try { files = fs.readdirSync(d).filter((f) => f.endsWith('.json')); } catch { return; }
  for (const f of files) {
    const fp = path.join(d, f); let o = null;
    try { o = JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { /* bad file */ }
    try { fs.unlinkSync(fp); } catch { /* already gone */ }
    if (!o || !o.id || state.posts.some((p) => p.id === o.id)) continue;
    if (o.replaces) { const old = state.posts.find((p) => p.id === o.replaces); if (old && old.status === 'awaiting_approval') { old.status = 'rejected'; old.rejectReason = 'replaced by a revised version'; } delete o.replaces; }
    const post = Object.assign({ dir: path.join(root, 'out', 'posts', o.id), status: 'awaiting_approval', kind: 'reference', look: 'v2', createdAt: new Date().toISOString() }, o, { no: ++state.seq });
    state.posts.push(post); save();
    await sendPreview(post);
  }
}
async function runTick() {
  const deadline = Date.now() + Number(process.env.TICK_SECONDS || 270) * 1000;
  log('cloud run started; paired chats:', Object.keys(state.chats).join(',') || 'none');
  if (state.cmdMenu !== MENU_VERSION) setMenus(); // register the Telegram / menu once per version (the cloud never did, so /edit was missing)
  resetChecksOnStart();
  if (!browserReady) startBrowserInstall();
  const noSched = process.env.TICK_SKIP_SCHEDULE === '1'; // local test: no scheduled jobs
  if (!noSched && dueNow(FEED_AT, 'feed')) bg(runFeed().then((o) => log('feed done, queued: ' + (o.fed || []).length)).catch((e) => log('feed error:', e.message)));
  if (!noSched && dueNow(SYNC_AT, 'sync')) bg(doInsightsSync().then((o) => log('sync done, updated: ' + o.updated)).catch((e) => log('sync error:', e.message)));
  if (!noSched) catchUpDaily();
  if (!noSched && dueNow(['04:00'], 'prune')) { const r = pruneImages(state, path.join(root, 'out', 'posts')); log('pruned ' + r.files + ' files, ' + Math.round(r.bytes / 1e6) + ' MB'); save(); }
  const ym = istDate().slice(0, 7); const doSquash = !noSched && process.env.DATA_REPO_DIR && state.lastSquash !== ym && istNow().getUTCHours() >= 5; if (doSquash) { state.lastSquash = ym; save(); }
  let lastWatch = 0, lastPersist = 0;
  while (Date.now() < deadline || bgTasks.size) {
    for (const who of ['main', 'test', 'fb']) await pollOnce(who, 6);
    flushReference();
    await ingestInbox();
    if (Date.now() - lastWatch > 120e3) { await goLiveWatcher(); await musicReminders(); lastWatch = Date.now(); }
    if (dirty && Date.now() - lastPersist > 15e3) { dirty = false; lastPersist = Date.now(); const r = persist('studio state'); if (r.error) log('persist:', r.error); }
    if (Date.now() > deadline + 50 * 60e3) { log('giving up on background jobs after 50 min'); break; }
  }
  save(); const r = persist('studio state (end of run)'); if (r.error) log('persist:', r.error);
  if (doSquash) log('history squash:', JSON.stringify(squashHistory()));
  log('cloud run finished');
}
if (TICK) { await runTick(); process.exit(0); }

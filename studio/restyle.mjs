const ROOT = process.env.IG_ROOT || 'C:/Users/smfab/ig-automation';
// V2 restyle: rewrites a generated post into the owner-approved V2 look (solid hook, easy English, highlighted keywords,
// one point per line, Mistake/Fix labels, PDF preview card) WITHOUT changing facts, then re-renders the slides.
// Always starts from the ORIGINAL post (spec.v1.json / caption.v1.txt) so it can be re-run safely.
// Usage: node restyle.mjs <postDir> [--hook "<cover hook to keep>"] [--sub "<cover sub to keep>"]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { gemini, PHOTO_VOCAB } from './agents.mjs';
import { renderLeadMagnet } from './leadmagnet.mjs';
import { directivesBlock } from './rules.mjs';

const dir = process.argv[2];
if (!dir) { console.error('usage: node restyle.mjs <postDir> [--hook "..."] [--sub "..."]'); process.exit(1); }
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const KEEP_HOOK = arg('--hook'), KEEP_SUB = arg('--sub');
const rd = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const log = (...a) => console.error('[restyle]', ...a);

// source = original (v1) version
if (!fs.existsSync(path.join(dir, 'spec.v1.json'))) { fs.copyFileSync(path.join(dir, 'spec.json'), path.join(dir, 'spec.v1.json')); fs.copyFileSync(path.join(dir, 'caption.txt'), path.join(dir, 'caption.v1.txt')); }
const spec = rd('spec.v1.json');
const caption = fs.readFileSync(path.join(dir, 'caption.v1.txt'), 'utf8').trim();
const lm = rd('leadmagnet.json');
const pdf = fs.readdirSync(dir).find((f) => f.endsWith('.pdf'));

await renderLeadMagnet(lm, path.join(dir, pdf), path.join(dir, 'pdf_preview.png'));   // real first page for the CTA card

const KEYWORD = (spec.slides.find((s) => s.type === 'cta')?.button || '').replace(/comment/i, '').trim();
const plain = (t) => String(t || '').replace(/(==|\+\+|!!|\*\*)/g, '').replace(/\s*\n+\s*/g, ' ').trim();
const nums = (t) => new Set((String(t).match(/\d[\d,.]*/g) || []).map((x) => x.replace(/[,.]+$/, '')));
const textOf = (slides, cap) => slides.map((s) => [s.title, s.sub, s.text, s.stat, ...(s.items || [])].filter(Boolean).join(' ')).join(' ') + ' ' + cap;
const oldText = textOf(spec.slides, caption);
const oldNums = nums(oldText);
const RISKY = /\b(penalt\w*|fines?|fined|ban(ned)?|jail|punish\w*|illegal|fraud\w*|scam\w*|lawsuit|sue[ds]?|seiz\w*|blacklist\w*|guarantee[ds]?)\b/gi;
const oldRisky = new Set((oldText.match(RISKY) || []).map((x) => x.toLowerCase()));

const prompt = `${directivesBlock()}
You are the final editor for an Instagram carousel (@faizanali.shahji, Indian import-export education). Rewrite this post in the owner's approved "V2" style.
HARD RULES:
1. NEVER change or add facts or claims. Keep every number, amount, deadline, scheme name, paragraph reference, notification number and website exactly. Do NOT introduce any new number, and do NOT add any new claim about consequences (no penalties, fines, bans, guarantees, legal action) unless the original already says it. If unsure, keep the original wording. Do NOT add examples, products, countries, companies or scenarios that are not already in the original; do not turn a rule that depends on value or conditions into a product list.
2. EASY ENGLISH: short sentences (max 12 words), everyday words, active voice, explain jargon in plain words the first time (e.g. "AD Bank (your bank that handles foreign payments)"). Write for a first-time exporter.
3. COVER HOOK (most important): max 12 words. It MUST contain the single most important number/time/amount from the post AND a clear stake or surprise that is already in the post, in a direct, spoken style. Good patterns: "You have only ==9 months== to get paid." / "Ship up to ==Rs 3 lakh== with ++no RCMC++." Never a vague topic line like "Save money on your first order". ${KEEP_HOOK ? `KEEP this exact hook text (only add markup/line breaks): "${KEEP_HOOK}".` : ''} Cover "sub": one or two complete plain sentences (18-30 words) that say what the reader gains or loses; never just a few words. ${KEEP_SUB ? `KEEP this exact sub: "${KEEP_SUB}".` : ''} No lead-magnet pitch on the cover.
4. Titles max 8 words. The "text" of every content slide = one or two COMPLETE descriptive plain sentences (14-30 words in total, never a 2-3 word fragment); put a second sentence on its own line using \\n.
5. HIGHLIGHT MARKUP: ==x== yellow highlight (numbers, amounts, deadlines, key nouns), ++x++ purple highlight (key action words), !!x!! orange (ONLY for the word "Mistake:"). Use AT MOST 2 highlights per slide, each covering 1-4 consecutive words (never two highlights side by side, never whole sentences). The "stat" field must be plain text with NO markup.
6. Never ADD a Mistake/Fix slide (the owner allows that format only once a week and the writer already decided). If the original slide already has a mistake and a fix, format its text exactly as: "!!Mistake:!!\\n<one line>\\n\\n++Fix:++\\n<one or two lines>".
7. Keep the same number of slides and slide types. Teasers max 6 words, simple. The last slide stays type "cta": title "Get the ++<guide name>++" (max 5 words, must fit on two lines) where the guide name is a short form of the PDF title "${lm.title}", button "Comment ${KEYWORD}", text "Inside:\\n<item 1>\\n<item 2>\\n<item 3>" (3 short items, NO highlight markup in this text, that match the PDF sections: ${JSON.stringify((lm.sections || []).map((s) => s.heading))}).
8. imageQueries: for every slide give 2 options chosen verbatim from: ${PHOTO_VOCAB.join(' | ')} . Pick scenes that fit the slide.
9. CAPTION: easy English. Line 1 = the cover hook as plain text. Then 2-3 short lines using only facts from the original. Then: "Comment ${KEYWORD} and I'll DM you the <guide name>. Follow so the DM reaches you." Then a blank line and EXACTLY 5 hashtags. Plain text, no asterisks, no emoji.
Return JSON: {"slides":[{"type":"","kicker":"","title":"","sub":"","text":"","items":[],"stat":"","teaser":"","button":"","imageQueries":["",""]}],"caption":"..."} (omit fields a slide does not use).

ORIGINAL SLIDES: ${JSON.stringify(spec.slides)}
ORIGINAL CAPTION: ${caption}`;

// ---- markup hygiene ----
function normalizeMarkup(s) {
  if (s.type !== 'cover' && s.type !== 'cta' && typeof s.title === 'string' && /\n/.test(s.title)) { // body text written into the title: move everything after the first line into text
    const [t, ...rest] = s.title.split('\n'); const lead = /!!Mistake:!!\s*$/.test(t) ? '!!Mistake:!!\n' : '';
    s.title = t.replace(/\s*!!Mistake:!!\s*$/, '').trim();
    s.text = [lead + rest.join('\n').trim(), s.text].filter(Boolean).join('\n');
  }
  const fix = (t) => {
    if (typeof t !== 'string') return t;
    t = t.replace(/==([^=]+?)==\s*==([^=]+?)==/g, '==$1 $2==').replace(/\+\+([^+]+?)\+\+\s*\+\+([^+]+?)\+\+/g, '++$1 $2++');  // merge side-by-side highlights
    return t;
  };
  for (const k of ['title', 'sub', 'text']) if (s[k]) s[k] = fix(s[k]);
  if (s.items) s.items = s.items.map(fix);
  if (s.stat) s.stat = plain(s.stat);
  // cap highlights per slide at 3 segments (Mistake/Fix labels do not count)
  let count = 0;
  const cap = (t) => (typeof t !== 'string' ? t : t.replace(/(==|\+\+)([^=+]+?)\1/g, (m, _o, inner) => (/^(Fix:?)$/i.test(inner.trim()) ? m : (++count <= 3 ? m : inner))));
  for (const k of ['title', 'sub', 'text']) if (s[k]) s[k] = cap(s[k]);
  if (s.items) s.items = s.items.map(cap);
  return s;
}

let out;
for (let attempt = 1; attempt <= 3; attempt++) {
  const cand = await gemini(prompt + (attempt > 1 ? '\nYour previous answer broke a rule (new numbers, a new risky claim, wrong slide/hashtag count, or a weak hook). Fix that.' : ''));
  const newText = textOf(cand.slides || [], cand.caption || '');
  const badNums = [...nums(newText)].filter((n) => !oldNums.has(n) && !/^[1-9]$|^10$/.test(n));
  const badRisky = (newText.match(RISKY) || []).map((x) => x.toLowerCase()).filter((x) => !oldRisky.has(x));
  const tags = ((cand.caption || '').match(/#\w+/g) || []).length;
  const hookOk = /\d/.test(plain(cand.slides?.[0]?.title)) || !!KEEP_HOOK;
  if (cand.slides?.length === spec.slides.length && !badNums.length && !badRisky.length && tags === 5 && hookOk) { out = cand; break; }
  log(`attempt ${attempt} rejected: slides ${cand.slides?.length}/${spec.slides.length}, new numbers [${badNums.join(', ')}], new risky words [${badRisky.join(', ')}], hashtags ${tags}, hook has number: ${hookOk}`);
}
if (!out) { console.error('restyle failed validation; current files left unchanged'); process.exit(2); }

// ---- apply ----
const last = out.slides.length - 1;
out.slides.forEach((s, i) => {
  normalizeMarkup(s);
  s.imageQueries = (s.imageQueries || []).filter((q) => PHOTO_VOCAB.includes(q));
  if (!s.imageQueries.length) s.imageQueries = spec.slides[i].imageQueries || ['container ship port'];
  if (i === 0) { s.type = 'cover'; if (KEEP_SUB) s.sub = KEEP_SUB; }
  if (i === last) { s.type = 'cta'; s.pdfPreview = 'pdf_preview.png'; s.kicker = 'Free PDF'; }
});
// caption line 1 must equal the cover hook
const lines = out.caption.replace(/[*_`]/g, '').trim().split('\n');
lines[0] = plain(out.slides[0].title);
fs.writeFileSync(path.join(dir, 'spec.json'), JSON.stringify({ handle: spec.handle || '@faizanali.shahji', slides: out.slides }, null, 2));
fs.writeFileSync(path.join(dir, 'caption.txt'), lines.join('\n'));
for (const f of fs.readdirSync(dir)) if (/^img_\d+\.jpg(\.credit\.json)?$|^slide_\d+\.jpg$/.test(f)) fs.rmSync(path.join(dir, f));

const r = spawnSync(process.execPath, [(ROOT + '/renderer/render.mjs'), path.join(dir, 'spec.json'), dir], { encoding: 'utf8' });
if (r.status !== 0) { console.error(r.stderr.slice(0, 400)); process.exit(1); }
console.log(JSON.stringify({ restyled: dir, slides: out.slides.length, hook: plain(out.slides[0].title), sub: plain(out.slides[0].sub) }));

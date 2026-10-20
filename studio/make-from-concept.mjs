// Full pipeline for a planned concept: Copywriter -> Critic/reviser -> Fact-check (if search quota allows) -> Pixabay slides -> lead-magnet PDF.
// Usage: node make-from-concept.mjs <conceptNo> --hook "<hook>" --sub "<sub>"
import fs from 'node:fs';
import { addFixedLines, stripFixedLines } from './caption.mjs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gemini, factCheck, slugify, RULES, SLIDE_SCHEMA, PHOTO_VOCAB } from './agents.mjs';
import { renderLeadMagnet } from './leadmagnet.mjs';
import { mistakeFixAllowed, MF_RULE_ON, MF_RULE_OFF } from './rules.mjs';
import { winningBlock, chooseTemplate, TEMPLATES, FB_RULES } from './winning.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const no = Number(process.argv[2]);
const data = JSON.parse(fs.readFileSync(arg('--concepts') || path.join(here, 'data', 'concepts-latest.json'), 'utf8'));
// reference mode (reference.mjs): --style <file> carries what we learned from a post the owner shared (structure, caption style, design)
const style = arg('--style') ? JSON.parse(fs.readFileSync(arg('--style'), 'utf8')) : null;
const N_SLIDES = Math.max(5, Math.min(10, Number(style?.slide_count) || 7));
const playbook = JSON.parse(fs.readFileSync(path.join(here, 'data', 'playbook.json'), 'utf8'));
const concept = data.concepts[no - 1];
let live = null; try { live = JSON.parse(fs.readFileSync(path.join(here, 'data', 'playbook-live.json'), 'utf8')); } catch { /* none yet */ }
const hook = arg('--hook'), sub = arg('--sub');
const log = (...a) => console.error('[studio]', ...a);
const MF_ON = mistakeFixAllowed(); log('Mistake/Fix slide allowed this week:', MF_ON);
// the owner's winning formula + template (winner.mjs): reference posts keep their own look, everything else follows the formula
const TEMPLATE = style ? null : (arg('--template') || (TEMPLATES[concept.format] ? concept.format : chooseTemplate(concept)));
log('slide template:', TEMPLATE || 'none (reference look)');
const TEMPLATE_FORMAT = {
  guide: 'TEMPLATE FORMAT "guide" (overrides rule 5 wording): slide 1 = cover. Content slides: type "point", title = a QUESTION of max 6 words ("Where to source from?", "Whom to sell to in India?", "How much does a container cost?"), items = 2 or 3 strings, each "Short label: specific fact" (max 22 words each; name real countries, buyer segments or companies, Rs amounts, documents). Exactly one slide of type "list" for the documents the buyer and shipper usually handle (title is a question like "Which documents do you need?", items = 5-8 generic document names only, no rule, rate or registration requirement). imageQueries: the FIRST query on EVERY slide is the exact commodity/product in 1-3 plain English words (e.g. "copper scrap", "turmeric", "rice bags") so the photo shows the real thing, the other two from the allowed list. Last slide = cta.',
  math: 'TEMPLATE FORMAT "math" (overrides rule 5 wording): slide 1 = cover (the Rs amount in the title, sub = a "Spoiler:" line). Then one slide per cost, type "stat": title "N. Cost name" (max 5 words), text = 2-3 short lines (max 9 words each) with the Rs amount of THIS cost, stat = the running balance sentence exactly like "₹1,00,000 − ₹60,000 = ₹40,000 LEFT", teaser "And we are still NOT done." (not on the last cost slide). Then one slide of type "list": title "So where did your ₹X go?", items "Label: ₹amount" (6-9 rows), stat "ACTUAL PROFIT = ₹Y". Put the line "Illustrative example: actual numbers depend on product, quantity, destination and Incoterm." as text on the list slide. Then cta. All arithmetic must be exactly right. First imageQueries entry may be a free-text real scene (warehouse, port, documents on desk, the product).',
  verdict: 'TEMPLATE FORMAT "verdict" (overrides rule 5 wording): slide 1 = cover whose title has the loss amount ("Loss of ₹2,64,800 per onion container. Is the trade dead?"), sub = the verdict in 2-4 words ("Verdict: unprofitable"), items = exactly 2 strings "Landed cost|AED 2.35/kg" and "Sale price|AED 1.9/kg" (label|value). Then calculation slides in the "math" format (type "stat", running balance in stat), one list slide with the cost table, final comparison, cta. Arithmetic must be exactly right and every number labelled illustrative. First imageQueries entry = the exact commodity in 1-3 plain words.',
}[TEMPLATE] || '';
const OWNER_RULES = [winningBlock(), TEMPLATE ? 'TEMPLATE: ' + TEMPLATES[TEMPLATE] + '\n' + TEMPLATE_FORMAT : ''].filter(Boolean).join('\n\n');

const BANNED = 'unlock, secret, ultimate, master, game-changer, shocking, hack, revolutionary, "in today\'s world", "it is important to", "many exporters", "most exporters", "countless", "significant"';

const copyPrompt = `You are the Copywriter for @faizanali.shahji, India import-export education. Audience: first-time and small Indian exporters. Voice: direct, practical, plain English, like an experienced exporter talking to a friend. Real data about this account:
${JSON.stringify({ winners: playbook.winners, flops: playbook.flops, voice: playbook.voice })}

${OWNER_RULES}

Write ONE carousel for this approved concept:
${JSON.stringify({ title: concept.title, pain_point: concept.pain_point, outline: concept.slide_outline, offer: concept.offer, fact_risks: concept.fact_risks })}
COVER HOOK (use EXACTLY as the cover title, you may add **bold** around 1-2 key words): "${hook}"
COVER SUB (exactly): "${sub}"

${live ? 'LIVE LEARNINGS from our measured results (goal 50K views in 24h; apply them to slide design/length and caption without breaking any rule below): ' + JSON.stringify({ caption_rules: live.caption_rules, design_rules: live.design_rules, double_down: live.double_down, stop: live.stop }) + ' ' : ''}

${style ? 'REFERENCE POST ANALYSIS (the owner shared a competitor post that performed well; copy its STRUCTURE, rhythm, hook pattern and caption style, but write every word fresh, use no brand names, keep our facts rules): ' + JSON.stringify({ structure: style.structure, hook_pattern: style.hook_pattern, caption_style: style.caption_style, cta: style.cta, tweak: style.tweak }) + ' ' : ''}

QUALITY BAR - every rule is mandatory:
1. ${N_SLIDES} slides: cover, ${N_SLIDES - 2} content slides, 1 cta. Story arc: hook -> the real scenario and what went wrong -> 3-4 specific insights/steps -> the fix/payoff -> offer.
2. Every content slide teaches ONE concrete, usable thing: a named document, clause, platform, certificate, scheme, step order, or number. A reader must be able to act on it today. No slide may be a vague statement.
3. ${MF_ON ? MF_RULE_ON : MF_RULE_OFF} Include one mini-example with numbers. Invented people/numbers MUST be labelled "illustrative" on the slide where they first appear.
4. Only name real, well-known things (e.g. ICC UCP 600, ECGC, DGFT, Heimtextil, Europages, OEKO-TEX Standard 100). If you are not certain a platform/clause/rule exists exactly as you describe, do NOT name it; instead tell the reader what to check and where.
5. Titles <= 8 words (big, plain words). Every content slide has a DESCRIPTION under the title: one or two COMPLETE plain sentences (14-30 words in total) that explain the point and why it matters to the reader. Never a 2-3 word fragment. No filler. Each content slide ends with a teaser (<=7 words) that pulls to the next slide.
6. BANNED words/phrases: ${BANNED}.
7. CTA slide: title "Get the <Offer Name>", button "Comment  ${concept.offer.keyword}", text = "Inside: " + exactly 3 concrete things in the PDF + ". Follow so the DM reaches you." (max 28 words).
8. Caption (plain text, no asterisks): line 1 = the hook; then a DESCRIPTIVE body of 110-170 words in 3-4 short paragraphs (what the situation is, why it costs money or time, 3-4 concrete points taken from the slides, and the practical takeaway; plain easy English, no filler); then ONE CTA line: "Comment ${concept.offer.keyword} and I'll DM you the <offer name>. Follow so the DM reaches you."; max 1400 chars. Do NOT write the consultancy/Impexq lines (they are added automatically). hashtags: EXACTLY 5 relevant (Instagram allows max 5), no brand/person names.
9. NEVER invent statistics ("3x higher", "typically", percentages) - use a labelled illustrative example or leave the number out.
10. If a slide promises named items (platforms, clauses, documents) it must NAME them on the slide itself.
11. Never state what a law or regulation REQUIRES unless you are certain; say "many buyers ask for ..." and "check <official source>".
12. Where practices differ (LC, payment terms), give the safer default and note when it depends on buyer/country; mention confirmed vs unconfirmed LC where LC is discussed.
13. English only: no Hinglish words anywhere (slides or caption).
14. claims: list every factual claim about Indian/international rules, documents, platforms, rates or procedures made on the slides.

${SLIDE_SCHEMA}
Return JSON: {"slides":[...],"caption":"...","hashtags":["#..."],"claims":["..."]}`;

log('Copywriter...');
let draft = await gemini(copyPrompt);

log('Critic + reviser...');
const reviewPrompt = `You are a ruthless editor for an Instagram carousel about Indian import-export. Score the DRAFT 1-5 on: hook_strength, pain_relevance, specificity (named docs/clauses/numbers, not vague), story_pull (each slide earns the next swipe), offer_fit (offer solves the pain; CTA lists 3 concrete contents), accuracy_risk (5 = nothing doubtful; 1 = invented or doubtful facts stated as fact).
Then output a FINAL version that fixes every score below 4: replace vague lines with concrete ones, remove any claim you are not certain is true (rephrase as "check the current rule at <source>"), keep the cover hook and sub EXACTLY, ${TEMPLATE ? 'keep the ' + TEMPLATE + ' template format exactly (' + (TEMPLATE === 'guide' ? 'question titles, labelled items' : 'running balance in stat, label: value rows') + '), ' : 'keep every slide description as 1-2 complete descriptive sentences (never shorten it to a few words), '} ${MF_ON ? '' : 'remove any Mistake/Fix or wrong-vs-right slide (not allowed this week), '}keep imageQueries chosen verbatim from: ${PHOTO_VOCAB.join(' | ')}.
BANNED: ${BANNED}.
Concept pain: ${concept.pain_point}. Offer: ${JSON.stringify(concept.offer)}.
DRAFT: ${JSON.stringify(draft)}
Return JSON: {"scores":{"hook_strength":0,"pain_relevance":0,"specificity":0,"story_pull":0,"offer_fit":0,"accuracy_risk":0},"issues_found":["..."],"final":{"slides":[...],"caption":"...","hashtags":["#..."],"claims":["..."]}}`;
const review = await gemini(reviewPrompt);
console.error('[studio] scores:', JSON.stringify(review.scores), '| issues:', (review.issues_found || []).length);
const post = review.final?.slides?.length ? review.final : draft;
post.caption = String(post.caption || '').replace(/[*_`]/g, '').trim();
post.hashtags = (post.hashtags || []).filter((h) => !/faizan/i.test(h));
// enforce the approved hook on the cover
if (post.slides[0]) { post.slides[0].type = 'cover'; post.slides[0].title = hook.replace(/^(.*)$/, (h) => h); if (sub && !(TEMPLATE && post.slides[0].sub && String(post.slides[0].sub).length <= 90)) post.slides[0].text = undefined, post.slides[0].sub = sub; } // winner templates keep the writer's short cover line ("step by step guidelines", "Spoiler: ...", "Verdict: ...")
// vocab guard for photo queries
for (const s of post.slides) {
  const all = (s.imageQueries || []).map(String).filter(Boolean);
  const q = all.filter((x) => PHOTO_VOCAB.includes(x));
  const free = TEMPLATE ? all.filter((x) => !PHOTO_VOCAB.includes(x) && x.split(/\s+/).length <= 4).slice(0, 1) : []; // winner templates: first query = the literal product
  s.imageQueries = [...free, ...q].length ? [...free, ...q] : ['container ship port', 'shipping containers stacked'];
}

log('Claim extractor (independent of the writer)...');
const finalText = post.slides.map((x, i) => (i + 1) + '. ' + [x.title, x.text, x.sub, (x.items || []).join('; ')].filter(Boolean).join(' - ')).join('\n') + '\nCAPTION: ' + post.caption;
let extra = [];
try {
  const ex = await gemini('Extract EVERY checkable factual claim from this Instagram carousel text about Indian import-export: rules, thresholds, amounts, fees, deadlines, named schemes/paragraphs/notifications, named platforms, legal obligations, and who requires what. Ignore illustrative examples labelled as such. One short, self-contained sentence per claim. Return JSON {"claims":["..."]}.\n\n' + finalText);
  extra = ex.claims || [];
} catch (e) { log('claim extraction failed:', e.message); }
post.claims = [...new Set([...(post.claims || []), ...extra])].slice(0, 14);
log('Fact-checker...', post.claims.length, 'claims');
const fc = await factCheck(post.claims);
if (fc.unverified) log('claims UNVERIFIED (search quota)');

const id = new Date().toISOString().slice(0, 10) + (style ? '-ref-' : `-c${no}-`) + slugify(concept.title).slice(0, 30) + (style ? '-' + Date.now().toString(36) : '');
const outDir = path.join(root, 'out', 'posts', id);
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'spec.json'), JSON.stringify({ handle: '@faizanali.shahji', ...(TEMPLATE ? { template: TEMPLATE } : {}), slides: post.slides }, null, 2));
// Facebook caption (own text for the page "Faizan Ali Shahji"; feeder.mjs uses caption_fb.txt)
try {
  const fbr = await gemini(FB_RULES.replace('${KEYWORD}', concept.offer.keyword) + '\nPOST SLIDES (use their real numbers and answers): ' + JSON.stringify(post.slides.map((x) => [x.title, x.sub, x.text, x.stat, ...(x.items || [])].filter(Boolean).join(' - '))) + '\nReturn JSON {"fb_caption":"..."}');
  const fbc = String(fbr.fb_caption || '').replace(/[*_`]/g, '').trim();
  if (fbc.length > 60) fs.writeFileSync(path.join(outDir, 'caption_fb.txt'), fbc);
} catch (e) { log('facebook caption failed:', e.message); }
fs.writeFileSync(path.join(outDir, 'caption.txt'), post.caption + '\n\n' + (post.hashtags || []).join(' '));
fs.writeFileSync(path.join(outDir, 'review.json'), JSON.stringify({ hook, sub, scores: review.scores, issues_found: review.issues_found, claims: post.claims, factcheck: { ok: fc.ok, unverified: !!fc.unverified, issues: fc.issues }, raw_factcheck: fc.raw }, null, 2));

log('Designer (Pixabay + slides)...', post.slides.length, 'slides');
const r = spawnSync(process.execPath, [path.join(root, 'renderer', 'render.mjs'), path.join(outDir, 'spec.json'), outDir], { encoding: 'utf8' });
if (r.status !== 0) { console.error(r.stderr); process.exit(1); }

log('Lead magnet...');
const lmPrompt = `Create the lead-magnet PDF content for: "${concept.offer.deliverable}" (${concept.offer.format}). It is promised on the last carousel slide as: ${JSON.stringify(post.slides[post.slides.length - 1].text)}. Carousel context: ${JSON.stringify(post.slides.map((s) => s.title))}.
It MUST deliver exactly what the CTA promised (the 3 "Inside" items), be genuinely useful, 2 pages max, and contain: a short intro paragraph (the pain it solves), concrete checklist items, at least one copy-paste template or fill-in block in the "template" field if the offer is about outreach/negotiation, and a "red flags" or "common errors" section. Items <= 16 words. Only include facts you are certain are correct for India/international trade practice; otherwise phrase as "verify <what> with <source>".
Return JSON: {"title":"","subtitle":"","sections":[{"heading":"","paragraph":"(optional)","template":"(optional multi-line text)","items":["..."]}],"closing":"Not legal or customs advice. Verify rules in official sources. Follow @faizanali.shahji for daily export tips."}`;
const lm = await gemini(lmPrompt);
fs.writeFileSync(path.join(outDir, 'leadmagnet.json'), JSON.stringify(lm, null, 2));
const pdf = path.join(outDir, `${slugify(lm.title || concept.offer.deliverable).slice(0, 40)}.pdf`);
await renderLeadMagnet(lm, pdf);

log('V2 restyle (solid hook, easy English, highlights, PDF card)...');
if (TEMPLATE) { // winner templates are final as written: no V2 restyle; add the real PDF first page to the CTA slide and re-render with the same photos
  await renderLeadMagnet(lm, pdf, path.join(outDir, 'pdf_preview.png'));
  const sp = JSON.parse(fs.readFileSync(path.join(outDir, 'spec.json'), 'utf8'));
  const cta = sp.slides.find((x) => x.type === 'cta'); if (cta) cta.pdfPreview = 'pdf_preview.png';
  fs.writeFileSync(path.join(outDir, 'spec.json'), JSON.stringify(sp, null, 2));
  fs.copyFileSync(path.join(outDir, 'spec.json'), path.join(outDir, 'spec.pre-look.json'));
  const rr = spawnSync(process.execPath, [path.join(root, 'renderer', 'render.mjs'), path.join(outDir, 'spec.json'), outDir, '--keep-photos'], { encoding: 'utf8' });
  if (rr.status !== 0) log('final render failed:', (rr.stderr || '').slice(-200));
} else if (!process.argv.includes('--no-restyle')) {
  const rs = spawnSync(process.execPath, [path.join(here, 'restyle.mjs'), outDir, '--hook', hook, '--sub', sub || ''], { encoding: 'utf8' });
  if (rs.status !== 0) log('restyle skipped (kept original look):', (rs.stderr || '').split('\n').filter((l) => !/quota|HTTP 5|malformed/.test(l)).slice(-2).join(' '));
}
log('Promise check (does the PDF deliver what the CTA promises?)...');
let promise = { matches: true, gaps: [] };
try {
  promise = await gemini('A carousel CTA promises: "' + post.slides[post.slides.length - 1].text + '". The PDF actually contains: ' + JSON.stringify(lm) + '\nList every item the CTA promises that the PDF does NOT actually deliver in usable form (e.g. a "calculator" or "tracker" with no worksheet/table to fill in). Return JSON {"matches":true|false,"gaps":["..."]}.');
} catch (e) { log('promise check failed:', e.message); }
{
  const rf = path.join(outDir, 'review.json');
  const rv = JSON.parse(fs.readFileSync(rf, 'utf8'));
  rv.claims = post.claims; rv.promise = promise; rv.factcheck = { ok: fc.ok, unverified: !!fc.unverified, issues: fc.issues }; rv.raw_factcheck = fc.raw;
  fs.writeFileSync(rf, JSON.stringify(rv, null, 2));
}
{ const cf = path.join(outDir, 'caption.txt'); fs.writeFileSync(cf, addFixedLines(fs.readFileSync(cf, 'utf8'))); } // consultancy + Impexq lines before the hashtags (final step, after any restyle)
console.log(JSON.stringify({ id, outDir, template: TEMPLATE, keyword: concept.offer.keyword, scores: review.scores, promise_gaps: promise.gaps || [], factcheck_unverified: !!fc.unverified, pdf }, null, 1));

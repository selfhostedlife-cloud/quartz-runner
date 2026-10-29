const ROOT = process.env.IG_ROOT || 'C:/Users/smfab/ig-automation';
// Learning engine. Reads every studio post's measured results, tags posts with features (format, hook style, slides, slot, music),
// computes which features beat each account's own baseline, then writes:
//   data/learning-model.json  (lifts per feature, post table, goal progress; used by feeder.mjs to rank the bank)
//   data/playbook-live.json   (directives for the strategist / hook writer / copywriter: double down, stop, experiments; used by concepts.mjs, hooks.mjs, make-from-concept.mjs)
//   data/learning-log.json    (history of how the model changed)
// Prints a JSON object {report} (Telegram text). Usage: node learn.mjs [--no-ai]
import fs from 'node:fs';
import path from 'node:path';
import { featuresOf, featuresOfHistory, indexOf, views24, saveShare24, followRate, setFollowBaseline, GOAL_VIEWS_24H } from './features.mjs';

const dataDir = (ROOT + '/studio/data');
const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8')); } catch { return d; } };
const wr = (f, o) => fs.writeFileSync(path.join(dataDir, f), JSON.stringify(o, null, 2));
const noAi = process.argv.includes('--no-ai');

const state = rd('state.json', { posts: [] });
const learnings = rd('learnings.json', { baseline: {}, posts: [] });
const baseline = learnings.baseline || {};
const K = 2; // shrinkage: a feature with few posts is pulled toward the global mean

// ---- 0. early read: how much of a post's 24h views are already there at ~6h? (calibrated only from our own posts; needs 3+ pairs) ----
const pairs = [];
for (const p of state.posts) for (const acct of ['main', 'test']) { const m = p.metrics?.[acct]; if (m?.h6?.views > 0 && m?.h24?.views > 0) pairs.push(m.h6.views / m.h24.views); }
pairs.sort((a, b) => a - b);
const ratio6 = pairs.length >= 3 ? pairs[Math.floor(pairs.length / 2)] : null; // median share of 24h views visible at the first 6h snapshot
const earlyLines = [];

// ---- 1. post table ----
const fbase = {}; // median followers per 1000 views of the studio's own posts, per account (floor 0.5 so a run of zeros cannot make every follow look huge)
for (const acct of ['main', 'test']) { const rs = state.posts.map((p) => followRate(p, acct)).filter((x) => x != null).sort((a, b) => a - b); fbase[acct] = rs.length >= 5 ? Math.max(rs[Math.floor(rs.length / 2)], 0.5) : 0; }
setFollowBaseline(fbase);
const table = [];
for (const p of state.posts) {
  let idx = indexOf(p, baseline); let provisional = false;
  if (idx == null && ratio6) { // no 24h yet: project from the 6h snapshot (provisional, half weight)
    const xs = [];
    for (const acct of ['main', 'test']) { const v6 = p.metrics?.[acct]?.h6?.views; const b = baseline?.[acct]?.views; if (v6 != null && b) xs.push(v6 / ratio6 / b); }
    if (xs.length) { idx = xs.reduce((a, b) => a + b, 0) / xs.length; provisional = true; earlyLines.push(`#${p.no} ${String(p.hook).slice(0, 50)}: on track for about ${idx.toFixed(2)}x normal (6h read, provisional)`); }
  }
  if (idx == null) continue;
  const f = featuresOf(p);
  const musicFlags = Object.values(p.music || {});
  if (musicFlags.length) f.music = musicFlags.some((m) => m.added) ? 'added' : 'missing';
  let caption = ''; try { caption = fs.readFileSync(path.join(p.dir, 'caption.txt'), 'utf8').trim(); } catch { /* no caption */ }
  table.push({ no: p.no, provisional, topic: p.topic, hook: p.hook, keyword: p.keyword, features: f, idx: +idx.toFixed(2),
    main24: views24(p, 'main'), test24: views24(p, 'test'), fol_main: followRate(p, 'main') == null ? null : +followRate(p, 'main').toFixed(2), fol_test: followRate(p, 'test') == null ? null : +followRate(p, 'test').toFixed(2), ss_main: +(saveShare24(p, 'main') ?? 0).toFixed(4), ss_test: +(saveShare24(p, 'test') ?? 0).toFixed(4), caption: caption.slice(0, 280) });
}

// ---- 1b. older posts (everything Buffer ever sent for either account that the studio did not make): carousels at weight 0.7, reels 0.35 ----
// index = views / the account's own median for that format. Views of old posts are lifetime views (mature), the studio's are 24h views, so old posts
// count less and are never used for the goal tracker or the post ranking tables.
const CH = { test: '6ac275fa6a5c39ccb6114033', main: '6ac3579d6a5c39ccb61c8bad' };
const histRows = rd('history.json', []);
const studioIds = new Set(state.posts.flatMap((p) => (p.buffer || []).map((e) => e.bufferId)));
const medOf = (a) => { a = [...a].sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : 0; };
const kindMed = {};
for (const [acct, id] of Object.entries(CH)) for (const kind of ['post', 'reel']) kindMed[acct + kind] = medOf(histRows.filter((r) => r.channelId === id && r.kind === kind).map((r) => r.views || 0));
const hist = [];
for (const r of histRows) {
  if ((r.kind !== 'post' && r.kind !== 'reel') || studioIds.has(r.id) || r.views == null) continue;
  const acct = r.channelId === CH.main ? 'main' : 'test'; const b = kindMed[acct + r.kind]; if (!b) continue;
  hist.push({ w: r.kind === 'post' ? 0.7 : 0.35, kind: r.kind, acct, hook: String(r.text || '').split('\n')[0].slice(0, 90), views: r.views, idx: +Math.min(r.views / b, 4).toFixed(2), features: featuresOfHistory(r) });
}

// ---- 2. feature lifts ----
const W = (r) => (r.provisional ? 0.5 : r.w ?? 1);
const all = [...table, ...hist];
const g = all.length ? all.reduce((a, r) => a + W(r) * r.idx, 0) / all.reduce((a, r) => a + W(r), 0) : 1;
const acc = {};
for (const r of all) for (const [k, v] of Object.entries(r.features)) { const key = `${k}=${v}`; (acc[key] ||= []).push(r); }
const lifts = {};
for (const [key, rs] of Object.entries(acc)) {
  const sw = rs.reduce((a, r) => a + W(r), 0), s = rs.reduce((a, r) => a + W(r) * r.idx, 0);
  lifts[key] = { n: rs.length, mean: +(s / sw).toFixed(2), shrunk: +((s + K * g) / (sw + K)).toFixed(2) };
}

// ---- 3. goal progress ----
const best = table.reduce((b, r) => (r.main24 != null && r.main24 > (b?.main24 || 0) ? r : b), null);
const bestAny = Math.max(0, ...table.map((r) => Math.max(r.main24 || 0, r.test24 || 0)));
const goal = { target: GOAL_VIEWS_24H, bestMain24: best?.main24 || 0, bestPost: best ? `#${best.no} ${best.topic}` : null, bestAny24: bestAny, mainBaseline: baseline.main?.views || null,
  multipleNeeded: baseline.main?.views ? +(GOAL_VIEWS_24H / baseline.main.views).toFixed(1) : null };

const model = { updated: new Date().toISOString(), baseline, global: { mean: +g.toFixed(2), n: all.length }, history: { carousels: hist.filter((h) => h.kind === 'post').length, reels: hist.filter((h) => h.kind === 'reel').length, studioPosts: table.length }, lifts, goal, posts: table };
wr('learning-model.json', model);

// ---- 4. directives (Gemini reads the evidence; deterministic fallback) ----
const ranked = Object.entries(lifts).filter(([, v]) => v.n >= 2).sort((a, b) => b[1].shrunk - a[1].shrunk);
const sortedPosts = [...table].sort((a, b) => b.idx - a.idx);
const top = sortedPosts.slice(0, 3), bottom = sortedPosts.slice(-3).reverse();

function fallbackDirectives() {
  const win = ranked.slice(0, 3).map(([k, v]) => `${k} (avg ${v.mean}x baseline, ${v.n} posts)`);
  const lose = ranked.slice(-3).map(([k, v]) => `${k} (avg ${v.mean}x baseline, ${v.n} posts)`);
  return { summary: 'Automatic summary (AI analyst unavailable).', double_down: win, stop: lose, experiments: [{ variable: 'hook style', hypothesis: 'A money/loss story hook beats a neutral one', how: 'Run one of each on the same format' }],
    hook_rules: ['Lead with the biggest money number or a named loss.'], caption_rules: ['First line = hook; end with the comment keyword offer.'], design_rules: ['Keep the layouts of the top posts.'], next_batch_mix: { exploit_pct: 70, explore_pct: 30 }, topic_ideas: [] };
}
let directives; let aiNote = '';
const olderCar = hist.filter((h) => h.kind === 'post').sort((a, b) => b.idx - a.idx), olderReel = hist.filter((h) => h.kind === 'reel').sort((a, b) => b.idx - a.idx);
const refs = rd('references.json', []);
if (!noAi && all.length >= 3) {
  try {
    const { gemini } = await import('./agents.mjs');
    directives = await Promise.race([new Promise((_, rej) => setTimeout(() => rej(new Error('analyst timeout')), 150000)), gemini(`You are the growth analyst for two Instagram accounts (@faizanali.shahji ~22K followers, baseline carousel ~${baseline.main?.views} views; @exportimportwithfaizan ~3.5K, baseline ~${baseline.test?.views}). Indian import-export education carousels. GOAL: at least ${GOAL_VIEWS_24H} views in 24 hours on one post (about ${goal.multipleNeeded}x the main account's normal).
"idx" = a blend of 24h views vs that account's baseline (60%) and followers per 1000 views vs its median (40%); 1.0 = normal. fol_main/fol_test = followers gained per 1000 views: FOLLOWERS ARE A CO-PRIMARY GOAL, so name the formats that earn follows, not only views. Sample sizes are SMALL: never claim certainty, say what is a signal vs noise, and prefer testable next steps. Do not invent numbers; use only this data.
POSTS (idx high to low): ${JSON.stringify(sortedPosts.map(({ no, hook, features, idx, main24, test24, ss_main }) => ({ no, hook, format: features.format, features, idx, main24, test24, saveShareMain: ss_main })))}
FEATURE LIFTS (n = posts INCLUDING older posts, shrunk = idx pulled toward average; older carousels count 0.7, reels 0.35): ${JSON.stringify(lifts)}
OLDER CAROUSELS BEFORE THE STUDIO (both accounts; idx vs that account's own carousel median; lifetime views), best then worst: ${JSON.stringify([...olderCar.slice(0, 8), ...olderCar.slice(-6)].map((h) => ({ acct: h.acct, hook: h.hook, idx: h.idx, views: h.views })))}
OLDER REELS (idx vs that account's reel median), best: ${JSON.stringify(olderReel.slice(0, 6).map((h) => ({ acct: h.acct, hook: h.hook, idx: h.idx, views: h.views })))}
OUTSIDE SIGNALS (competitor posts the owner flagged as strong; hypotheses, NOT our results; use only to suggest experiments): ${JSON.stringify(refs.slice(-8).map((x) => ({ hook: x.hookText, pattern: x.hookPattern, slides: x.slideCount, cta: x.ctaType, note: x.ownerNote })))}
CAPTIONS OF BEST POSTS: ${JSON.stringify(top.map((r) => ({ no: r.no, caption: r.caption })))}
CAPTIONS OF WORST POSTS: ${JSON.stringify(bottom.map((r) => ({ no: r.no, caption: r.caption })))}
Context: the account's own history says money-twist stories, commodity risk stories and "how to find buyers in <market>" worked; generic scheme/definition posts flopped. Each post has a comment-keyword lead magnet. Posts go out as 7-10 slide carousels; hooks are cover titles.
Return JSON: {"summary":"3 sentences: what the data says, what is signal vs noise","double_down":["specific, repeatable pattern with the evidence"],"stop":["pattern to drop, with evidence"],"experiments":[{"variable":"ONE thing to change","hypothesis":"","how":"how the next post tests it"}],"hook_rules":["concrete rules for cover hooks"],"caption_rules":["concrete rules for captions"],"design_rules":["concrete rules for slide design/layout/length"],"next_batch_mix":{"exploit_pct":70,"explore_pct":30},"topic_ideas":["specific topics (product + country/document) that fit the winners"]}`)]);
  } catch (e) { aiNote = ' (AI analyst failed: ' + e.message.slice(0, 80) + ')'; }
}
directives ||= fallbackDirectives();
wr('playbook-live.json', { updated: new Date().toISOString(), basedOnPosts: table.length, ...directives });

// ---- 5. log + report ----
const log = rd('learning-log.json', []);
log.push({ at: model.updated, posts: table.length, globalIdx: model.global.mean, best24Main: goal.bestMain24, topFeatures: ranked.slice(0, 3).map(([k, v]) => `${k}:${v.mean}`) });
wr('learning-log.json', log.slice(-90));

const fmt = (r) => `#${r.no} ${String(r.hook).slice(0, 60)} | ${r.main24 ?? '-'} views in 24h (${r.idx}x)`; // main bot: main account numbers only
const fmtT = (r) => `#${r.no} ${String(r.hook).slice(0, 60)} | ${r.test24 ?? '-'} views in 24h`;
const testRows = table.filter((r) => r.test24 != null).sort((a, b) => b.test24 - a.test24);
const reportTest = 'RESULTS for @exportimportwithfaizan (24h views)\n' + (testRows.length ? testRows.slice(0, 6).map(fmtT).join('\n') : 'No 24h results yet.');
const pct = goal.bestMain24 ? Math.round((goal.bestMain24 / GOAL_VIEWS_24H) * 100) : 0;
const report = [
  `LEARNING REPORT (${table.length} studio posts with 24h results + ${hist.length} older posts of both accounts: ${hist.filter((h) => h.kind === 'post').length} carousels, ${hist.filter((h) => h.kind === 'reel').length} reels)${aiNote}`,
  `Goal: ${GOAL_VIEWS_24H} views in 24h. Best so far on main: ${goal.bestMain24} (${pct}% of goal) - ${goal.bestPost || 'n/a'}. Main baseline ${goal.mainBaseline} so the goal is ${goal.multipleNeeded}x normal.`,
  '',
  'Best:', ...top.map(fmt), '', 'Weakest:', ...bottom.map(fmt), '',
  'What the data says: ' + (directives.summary || ''),
  '', 'Doing more of:', ...(directives.double_down || []).slice(0, 4).map((x) => '- ' + x),
  '', 'Stopping / avoiding:', ...(directives.stop || []).slice(0, 3).map((x) => '- ' + x),
  '', 'Experiments for the next posts:', ...(directives.experiments || []).slice(0, 3).map((x) => `- ${x.variable}: ${x.hypothesis}`),
  '', `Next batch mix: ${directives.next_batch_mix?.exploit_pct ?? 70}% proven patterns / ${directives.next_batch_mix?.explore_pct ?? 30}% experiments.`,
].join('\n');
const earlyNote = earlyLines.length ? 'EARLY READ (6h, provisional - ' + pairs.length + ' calibration pairs; the 24h result decides):\n' + earlyLines.join('\n') : (ratio6 ? '' : `Early read not active yet: needs 3 posts with both 6h and 24h numbers (have ${pairs.length}).`);
console.log(JSON.stringify({ report: report + (earlyLines.length ? '\n\n' + earlyNote : ''), earlyNote, reportTest, posts: table.length, best: goal.bestMain24 }));
process.exit(0); // do not wait for a timed-out Gemini retry loop

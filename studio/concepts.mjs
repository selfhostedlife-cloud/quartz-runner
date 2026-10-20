const ROOT = process.env.IG_ROOT || 'C:/Users/smfab/ig-automation';
// Strategist v2: data-driven concept planning. Step 1 = grounded news brief (Google Search), step 2 = concepts using the real-data playbook.
// Usage: node concepts.mjs [count=4]
import fs from 'node:fs';
import { gemini } from './agents.mjs';
import { directivesBlock } from './rules.mjs';

const playbook = JSON.parse(fs.readFileSync((ROOT + '/studio/data/playbook.json'), 'utf8'));
const count = Number(process.argv[2] || 4);
const rd = (f, d) => { try { return JSON.parse(fs.readFileSync((ROOT + '/studio/data/') + f, 'utf8')); } catch { return d; } };
const used = (rd('state.json', { posts: [] }).posts || []).map((p) => ({ topic: p.topic, keyword: p.keyword }));
const learnings = rd('learnings.json', { posts: [] });
const feedback = rd('feedback.json', []);
const live = rd('playbook-live.json', null); // written by learn.mjs after every insights sync
const model = rd('learning-model.json', null);
const ctx = [
  'ALREADY USED (do NOT repeat these topics or keywords): ' + JSON.stringify(used),
  'RESULTS OF POSTS WE GENERATED SO FAR (learn from them; prefer patterns with higher save+share rate): ' + JSON.stringify((learnings.posts || []).map((p) => ({ topic: p.topic, hook: p.hook, metrics: p.metrics }))),
  'OWNER REJECTION FEEDBACK (avoid): ' + JSON.stringify(feedback.slice(-10)),
  live ? 'LIVE LEARNINGS FROM OUR OWN MEASURED RESULTS (GOAL: 50,000 views in 24h on one post; these override the older playbook where they disagree). Follow them: ' + JSON.stringify({ summary: live.summary, double_down: live.double_down, stop: live.stop, experiments: live.experiments, hook_rules: live.hook_rules, topic_ideas: live.topic_ideas, next_batch_mix: live.next_batch_mix, feature_lifts_vs_baseline: model?.lifts }) : '',
].join('\n') + '\n';

console.error('[strategist] gathering current export-import news (search-grounded)...');
let brief;
try {
brief = await gemini(`Today is ${new Date().toISOString().slice(0, 10)}. For Indian exporters and importers, list 10 concrete developments from roughly the last 60 days that affect real businesses: export/import policy or duty changes, MEP or export bans, DGFT notifications, RoDTEP/drawback changes, port or freight disruptions, demand shifts in specific countries, price swings in specific commodities (onion, rice, spices, aluminium scrap, etc.), buyer-fraud patterns. For each: one line with the specific fact, product/country and approximate date. Only include things you can verify via search; skip anything uncertain.`, { json: false, search: true });
} catch (e) {
  if (e.name !== 'QuotaError') throw e;
  brief = 'NOT AVAILABLE: search quota exhausted today. Do NOT cite any current news or dates; every concept must be marked evergreen.';
  console.error('[strategist] ' + e.message + ' -> planning evergreen concepts only');
}
console.error('[strategist] brief ready (' + brief.length + ' chars)');

const prompt = `${directivesBlock()}
OWNER RULE: do not plan a "mistake vs fix" slide in any slide_outline (that format is limited to one post a week and is decided later by the writer).
You are the Strategist for the Instagram account @faizanali.shahji (India import-export education, audience: first-time and small Indian exporters/importers, many asking "how do I find genuine buyers" and "will I get paid").
REAL DATA about what works on this account:
${JSON.stringify(playbook, null, 1)}

CURRENT NEWS/DEVELOPMENTS (verified by search, may be partial):
${brief}

${ctx}
Propose ${count} carousel CONCEPTS. Each must:
1. Be about a SPECIFIC product, country, scheme, document or situation (never "a generic guide to X").
2. Have a hook that is a pain or money-twist a viewer feels instantly (6-10 plain words an Indian trader understands at a glance; no fancy words like ghosted/vanished/unlock). Examples of the style that worked: "Container value Rs 32 lakh, profit Rs 9 lakh. Really?" / "Onion export is the riskiest bet in export" / "How to find buyers in Europe".
3. Attack ONE real pain point from the list, and say which.
4. Offer a concrete lead-magnet deliverable the viewer gets by commenting a short keyword (3-7 letters). The deliverable must be something we can actually produce as a 1-3 page PDF checklist/template/list WITHOUT inventing private data (e.g. "buyer-vetting checklist + 10 red flags", "payment-terms decision sheet", "email template pack to approach importers"). Do NOT promise lists of named buyer contacts.
5. Use a story arc: hook -> real-scenario tension -> 3-5 specific insights/steps (name platforms, documents, schemes, numbers where verifiable) -> payoff -> offer.
6. If it is tied to a current development from the news above, say which; otherwise mark evergreen.
Rank by expected saves+shares on this account.
8. MIX: follow LIVE LEARNINGS next_batch_mix. Roughly 70% of concepts must repeat a proven pattern from double_down (new product/country/document, same winning structure); the rest are EXPERIMENTS from the experiments list, each changing ONE variable. Add "format" (one of: payment-risk, buyer-finding, policy-rule, logistics, data-map, other), "mode" ("proven" or "experiment") and "tests" (the one variable being tested, or "") to every concept.
Return JSON: {"concepts":[{"title":"","hook":"","pain_point":"","why_it_works_here":"(cite the playbook pattern)","slide_outline":["slide 1: ...","slide 2: ..."],"offer":{"keyword":"","deliverable":"","format":""},"format":"","mode":"proven|experiment","tests":"","news_link":"or evergreen","fact_risks":"claims that must be verified before posting"}]}`;
const out = await gemini(prompt);
fs.writeFileSync((ROOT + '/studio/data/concepts-latest.json'), JSON.stringify({ brief, ...out }, null, 2));
console.log('\n=== NEWS BRIEF (first 1500 chars) ===\n' + brief.slice(0, 1500));
for (const [i, c] of (out.concepts || []).entries()) {
  console.log(`\n=== CONCEPT ${i + 1}: ${c.title}\nHOOK: ${c.hook}\nPAIN: ${c.pain_point}\nWHY: ${c.why_it_works_here}\nOFFER: Comment "${c.offer?.keyword}" -> ${c.offer?.deliverable} (${c.offer?.format})\nNEWS: ${c.news_link}\nOUTLINE:\n  ${(c.slide_outline || []).join('\n  ')}\nFACT RISKS: ${c.fact_risks}`);
}

const ROOT = process.env.IG_ROOT || 'C:/Users/smfab/ig-automation';
// Writes 5 hook variants (different patterns) for chosen concepts. Usage: node hooks.mjs 1 2
import fs from 'node:fs';
import { gemini } from './agents.mjs';
import { PLAIN_RULES, plainCheck } from './plain.mjs';
import { winningBlock } from './winning.mjs';

const data = JSON.parse(fs.readFileSync((ROOT + '/studio/data/concepts-latest.json'), 'utf8'));
const playbook = JSON.parse(fs.readFileSync((ROOT + '/studio/data/playbook.json'), 'utf8'));
let live = null; try { live = JSON.parse(fs.readFileSync((ROOT + '/studio/data/playbook-live.json'), 'utf8')); } catch { /* none yet */ }
const picks = process.argv.slice(2).map(Number).filter(Boolean);
const chosen = picks.map((n) => ({ n, c: data.concepts[n - 1] }));

const prompt = `${winningBlock()}
You write cover-slide hooks for @faizanali.shahji (Indian import-export education; audience = first-time/small Indian exporters).
The owner's biggest winners (study their shape): "How to Import Copper Scrap in India" (80 lakh+ views, 300+ followers), "Rs 1 lakh export order? Here is how much you actually make" (15K+ twice), "Loss of Rs 2,64,800 per onion container: is the trade dead?" (14K, 365 comments). Prefer hooks of exactly these shapes: how-to for ONE named commodity, a Rs amount + a myth-bust, or a loss number + a verdict question.
Other real hooks that worked for this account: "Container Value Rs 32 Lacs, Profit Rs 9 Lacs - Really?" (55K views), "Onion export is always a very risky commodity" (35K), "How to Find Buyers in Europe?" (10K), "Comment 'Scrap' and I'll send you the complete guide of importing Aluminium Scrap".
Playbook: ${JSON.stringify(playbook.rules)}
${live ? 'LIVE LEARNINGS from our measured results (goal: 50K views in 24h; these beat the playbook if they disagree): ' + JSON.stringify({ hook_rules: live.hook_rules, double_down: live.double_down, stop: live.stop }) : ''}

For EACH concept below write exactly 5 hook options for the carousel cover. Rules:
- Name something specific (product, country, form, number) but keep it SIMPLE.
- Use 5 DIFFERENT patterns, one each: (1) money you can lose or earn, with a number, (2) a plain question the reader is asking, (3) a "do not do X before Y" warning, (4) specific "how to" for a named market/product, (5) a plain surprising fact with a number.
${PLAIN_RULES}
- Invented numbers/scenarios are fine for hooks only if they are plausible; the carousel will label them "illustrative".
- BANNED words: unlock, secret, ultimate, master, game-changer, shocking, mistake-proof, hack.
- Also give "sub": the line under the hook = one or two COMPLETE plain sentences (18-30 words) saying what the reader stands to lose or learn and why it matters now. Never just a few words.
- Pick best_index (0-4) = the one most likely to stop a scrolling exporter AND earn saves/shares.
Concepts: ${JSON.stringify(chosen.map(({ n, c }) => ({ concept: n, title: c.title, pain: c.pain_point, outline: c.slide_outline, offer: c.offer })))}
Return JSON: {"hooks":[{"concept":1,"options":[{"hook":"","sub":"","pattern":""}],"best_index":0}]}`;

const raw = await gemini(prompt);
const out = Array.isArray(raw) ? { hooks: raw } : (raw.hooks ? raw : { hooks: Object.values(raw).find(Array.isArray) || [] }); // tolerate a bare array or a differently named key
fs.writeFileSync((ROOT + '/studio/data/hooks-latest.json'), JSON.stringify(out, null, 2));
for (const h of out.hooks || []) {
  // safety net: mark options that still read like a headline; best_index is moved to the best plain option
  h.options = (h.options || []).map((o) => ({ ...o, plain: plainCheck(o.hook).ok }));
  if (!h.options[h.best_index]?.plain) { const i = h.options.findIndex((o) => o.plain); if (i >= 0) h.best_index = i; }
  fs.writeFileSync((ROOT + '/studio/data/hooks-latest.json'), JSON.stringify(out, null, 2));
  const c = data.concepts[h.concept - 1];
  console.log(`\n=== CONCEPT ${h.concept}: ${c.title}  (offer: Comment "${c.offer.keyword}")`);
  h.options.forEach((o, i) => console.log(`${i === h.best_index ? ' *' : '  '}${i + 1}. [${o.pattern}] ${o.hook}\n      sub: ${o.sub}`));
}

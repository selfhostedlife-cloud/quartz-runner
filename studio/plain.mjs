// Plain-English rules for cover hooks (owner, 2026-10-13): hooks must be instantly understood by an Indian small businessman who reads English as a second language.
// PLAIN_RULES goes into the hook prompts; plainCheck() is the safety net that rejects a hook that still reads like a magazine headline.
import { gemini } from './agents.mjs';

export const PLAIN_RULES = `PLAIN-ENGLISH RULES (the audience is Indian small traders and first-time exporters; many read English as a second language and decide in one second whether to swipe):
- 6 to 10 words. Every word is one a Class 8 student knows. Say it the way you would tell a friend at a tea stall.
- Talk to the reader ("you", "your") or state a plain fact with ONE number. Never a story told in first person ("My first shipment...", "We lost...") and never a character the reader does not know.
- BANNED fancy words: ghosted, vanished, sat at port, tumbled, plummeted, windfall, soared, skyrocketed, unlock, navigate, leverage, landscape, game-changer, nightmare, haunt, backfire, brutal, devastating, catastrophic, treacherous, mastermind, ultimate, secret.
- Money in Rs with lakh or crore ("Rs 5 lakh"), never millions. Say "days", "weeks", "per kg", "per container".
- One idea: one clear loss, gain, question or warning. No jokes, no metaphors, no two-part sentences with a dash.
- Good examples: "You can lose Rs 5 lakh on one export order." / "Buyer has not paid? Do this first." / "Is your buyer real? Check these 3 things." / "How to find buyers in Dubai, free." / "Rice exporters: this one form can cost you Rs 80,000."
- Bad examples (do NOT write like this): "My first French apple shipment sat at port while the buyer ghosted me." / "The hidden landscape of FOB pricing." / "Unlock the secret of RoDTEP."`;

export const FANCY = /\b(ghost\w*|vanish\w*|sat at|tumbl\w*|plummet\w*|windfall|soar\w*|skyrocket\w*|unlock\w*|navigat\w*|leverag\w*|landscape|game-?changer|nightmare|haunt\w*|backfir\w*|brutal\w*|devastat\w*|catastroph\w*|treacher\w*|mastermind|ultimate|secret)\b/i;

export function plainCheck(hook) {
  const h = String(hook || '').replace(/(==|\+\+|!!|\*\*)/g, '').trim(); const why = [];
  const words = h.split(/\s+/).filter(Boolean).length;
  if (words > 11) why.push(words + ' words');
  if (FANCY.test(h)) why.push('fancy word: ' + h.match(FANCY)[0]);
  if (/^(my|we|i|our)\b/i.test(h)) why.push('first-person story');
  if (/\b(million|billion|\$)\b|\$/.test(h)) why.push('not in Rs/lakh');
  if (h.split(/\s*[-–—]\s+/).length > 2) why.push('too many parts');
  return { ok: why.length === 0, why, words };
}

// 5 plain options for an existing post (used by the Telegram /hook command)
export async function plainHooksFor({ topic, outline, current, facts, n = 5 }) {
  const out = await gemini(`Write ${n} cover hooks for an Instagram carousel by @faizanali.shahji (Indian import-export education).
TOPIC: ${topic}
CURRENT HOOK (too hard to read, replace it): ${current}
WHAT THE POST SAYS (use only facts from here, never invent a number): ${JSON.stringify(facts).slice(0, 2500)}
${PLAIN_RULES}
Each option uses a different angle: (1) money you can lose or earn, with a number from the post, (2) a plain question the reader is asking, (3) a "do not do X before Y" warning, (4) "how to ..." for the named product/market, (5) a plain surprising fact with a number from the post.
For each also write "sub": one or two complete plain sentences (18-30 words) that say what the reader gains or loses and make them want to swipe. Never just a few words.
Return JSON: {"options":[{"hook":"","sub":"","angle":""}]}`);
  const list = Array.isArray(out) ? out : (out.options || Object.values(out).find(Array.isArray) || []);
  const good = list.filter((o) => o?.hook && plainCheck(o.hook).ok);
  return (good.length >= 3 ? good : list.filter((o) => o?.hook)).slice(0, n);
}

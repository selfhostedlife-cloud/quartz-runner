// Content agents (Gemini free tier). Each agent = one focused prompt returning JSON.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const brand = JSON.parse(fs.readFileSync(path.join(root, 'brand', 'brand.json'), 'utf8'));

if (fs.existsSync(path.join(root, '.env'))) {
  for (const line of fs.readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}
// Free-tier quotas are per model per day, so we fall back across models and remember which are exhausted.
const MODELS = (process.env.TEXT_MODELS || 'gemini-3.5-flash,gemini-3.6-flash,gemini-3.7-flash,gemini-3.5-flash-lite,gemini-2.5-flash').split(',').map((m) => m.trim()).filter(Boolean);
const STATE_FILE = path.join(here, 'data', 'model-state.json');
const loadState = () => { try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return {}; } };
const saveState = (st) => { fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true }); fs.writeFileSync(STATE_FILE, JSON.stringify(st, null, 2)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export class QuotaError extends Error { constructor(m, search) { super(m); this.name = 'QuotaError'; this.search = search; } }

function tryParseJson(t) {
  let s = String(t).replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, '').trim();
  const i = Math.min(...['{', '['].map((c) => (s.indexOf(c) < 0 ? Infinity : s.indexOf(c))));
  if (!Number.isFinite(i)) return undefined;
  s = s.slice(i);
  for (const cand of [s, s.replace(/,\s*([}\]])/g, '$1'), s.slice(0, Math.max(s.lastIndexOf('}'), s.lastIndexOf(']')) + 1).replace(/,\s*([}\]])/g, '$1')]) {
    try { return JSON.parse(cand); } catch { /* try next cleanup */ }
  }
  return undefined;
}

export async function gemini(prompt, { json = true, search = false, system, images = [] } = {}) {
  // images: [{ mime: 'image/jpeg', data: <base64> }] for vision calls (photo judge)
  const body = {
    contents: [{ parts: [{ text: prompt }, ...images.map((im) => ({ inlineData: { mimeType: im.mime, data: im.data } }))] }],
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    generationConfig: json && !search ? { responseMimeType: 'application/json', temperature: 0.6 } : { temperature: 0.7 },
    ...(search ? { tools: [{ google_search: {} }] } : {}),
  };
  const state = loadState();
  // Two keys from two Google projects = two free quotas: key 2 is only used once every model of key 1 is out of quota (cooldowns are tracked per key)
  const keys = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_2].filter(Boolean);
  let sawQuota = false;
  for (const [ki, apiKey] of keys.entries()) for (const model of MODELS) {
    const tag = (m) => m + (search ? ':search' : '') + (ki ? '#k' + (ki + 1) : '');
    if (state[tag(model)] && state[tag(model)] > Date.now()) { sawQuota = true; continue; }
    for (let a = 0; a < 3; a++) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST', headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (r.status === 404 || r.status === 400) { const t = (await r.text()).slice(0, 160); console.error(`[studio] ${model}: HTTP ${r.status} ${t}`); state[tag(model)] = Date.now() + 6 * 3600e3; saveState(state); break; }
      if (r.status === 429) {
        sawQuota = true;
        const j = await r.json().catch(() => ({}));
        const retry = (j.error?.details || []).map((x) => x.retryDelay).filter(Boolean)[0];
        const secs = retry ? parseFloat(retry) : 3600;
        console.error(`[studio] ${tag(model)}: quota 429 (retry in ${Math.round(secs)}s) -> next model`);
        if (secs <= 45 && a === 0) { await sleep(secs * 1000 + 500); continue; }
        state[tag(model)] = Date.now() + Math.min(secs, 24 * 3600) * 1000; saveState(state); break;
      }
      if (r.status >= 500) { console.error(`[studio] ${model}: HTTP ${r.status} (attempt ${a + 1})`); await sleep(5000 * (a + 1)); continue; }
      const j = await r.json();
      const t = j?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') ?? '';
      if (!t) { console.error(`[studio] ${model}: empty response`); continue; }
      if (!json) return t;
      const parsed = tryParseJson(t);
      if (parsed !== undefined) return parsed;
      console.error(`[studio] ${model}: malformed JSON, retrying (${a + 1})`);
    }
  }
  if (sawQuota) throw new QuotaError(search ? 'Search-grounded Gemini quota exhausted on all models' : 'Gemini quota exhausted on all models', search);
  throw new Error('Gemini failed on all models');
}

// Pixabay matches concrete objects well and abstract ideas badly. The Copywriter must pick from this list.
export const PHOTO_VOCAB = ['container ship port','port cranes containers','shipping containers stacked','cargo plane airport','truck highway cargo','warehouse pallets forklift','warehouse worker boxes','factory production line','textile factory','spices market','rice grains sacks','fruit vegetables market','packaging boxes tape','invoice documents desk','signing contract pen','customs inspection cargo','calculator money desk','coins stack growth','indian rupee notes','world map globe','handshake business deal','shipping label barcode','cargo containers sunset','warehouse shelves','harbor sea ship','paper stamp documents','wooden crates export','cargo ship ocean'];

export const RULES = brand.story_rules.map((r) => '- ' + r).join('\n');
export const SLIDE_SCHEMA = `Slide object fields: type ("cover"|"point"|"stat"|"list"|"cta"), kicker (2-4 words), title (use **word** to highlight 1-2 key words), text (optional, max 22 words), items (list type only, 3-4 short strings), stat (stat type only, a short number like "₹9,000" or "3 days"; the slide title must NOT repeat this number, it should say what the number means), teaser (<=7 words, opens a loop for the next slide; omit on the cta slide), imageQueries (array of exactly 3 strings, EACH chosen verbatim from this allowed list: ${PHOTO_VOCAB.join(" | ")} ; pick the 3 that best fit THAT slide, best first), button (cta only, e.g. "Comment  PRICE").`;

// Strategist: picks today's topics using the playbook (what has worked) + recent history (avoid repeats).
export async function planDay({ count = 2, playbook = {}, recentTopics = [] }) {
  const prompt = `You are the Strategist agent for an Instagram account about Indian import-export (@faizanali.shahji), audience: new/aspiring exporters and small manufacturers in India.
Pick ${count} DIFFERENT carousel topics for today. Each must be a "knowledge bomb": one concrete, surprising, useful insight, framed as a story or myth-vs-reality, never a generic explainer.
Playbook of what worked so far (may be empty): ${JSON.stringify(playbook)}
Recent topics (do NOT repeat): ${JSON.stringify(recentTopics)}
Rules: reuse winning patterns ~80%, test one new angle ~20%. Prefer topics where the real numbers/rules are verifiable (IEC, duty drawback, RoDTEP, FOB vs CIF, payment terms, incoterms, HS codes, DGFT, export documents, LC, ECGC, packing, testing).
Return JSON: {"plans":[{"topic":"...","angle":"story|myth_vs_reality|mistake|checklist|calculation","hook_idea":"...","leadmagnet_keyword":"ONE SHORT UPPERCASE WORD, 3-7 letters","leadmagnet_title":"..."}]}`;
  return gemini(prompt);
}

// Copywriter: full carousel spec.
export async function writeCarousel(plan, { slideMin = 4, slideMax = 8 } = {}) {
  const prompt = `You are the Copywriter agent for @faizanali.shahji (Indian import-export education).
Write one Instagram carousel for: ${JSON.stringify(plan)}.
Choose the slide count yourself between ${slideMin} and ${slideMax}: short tips = fewer slides, story/calculation = more. Do not pad.
STORY RULES:
${RULES}
${SLIDE_SCHEMA}
The LAST slide must be type "cta" offering the lead magnet "${plan.leadmagnet_title}" with button "Comment  ${plan.leadmagnet_keyword}" and text "I'll DM you the free ${plan.leadmagnet_title}. Follow so the DM reaches you."
Also write: caption (hook line + 2-3 short value lines + CTA line, <=900 chars, plain text, no markdown), hashtags (8-12, mix of niche and broad, array of strings without #... include the # in each).
KNOWLEDGE-BOMB TEST (all must pass): (a) at least 3 slides carry a CONCRETE number, named scheme/document, deadline or step the reader can act on; (b) no slide may be a vague statement like "many exporters lose money" without a number or example; (c) the reader should learn something they could use the same day.
CAPTION RULES: plain text only, no asterisks or markdown, no invented hashtags or brand names, max 3 emoji, end with the comment CTA using the keyword.
IMAGE RULE: photos are generic stock; keep slide text self-sufficient and never refer to what the photo shows.
KEYWORD RULE: the comment keyword must be ONE short word, 3-7 letters, easy to type (e.g. PRICE, IEC, DUTY, ROADMAP).
Every claim about rules, rates or procedures must be correct for India; if unsure, phrase generally ("check current notification") instead of inventing numbers. Invented story numbers must be labelled "illustrative example" on the cover or slide 2.
Return JSON: {"slides":[...],"caption":"...","hashtags":["#..."],"claims":["each factual claim about Indian rules/rates/procedures made in the slides, as a short sentence"]}`;
  const out = await gemini(prompt);
  out.caption = String(out.caption || '').replace(/[*_`]/g, '').trim();
  out.hashtags = (out.hashtags || []).filter((h) => !/faizan/i.test(h));
  return out;
}

// Fact-checker: verifies the claims with Google Search grounding; returns verdicts.
export async function factCheck(claims) {
  if (!claims?.length) return { ok: true, issues: [], raw: '' };
  const prompt = `You are a strict fact-checker for Indian import-export (DGFT, Customs, GST, RBI, ECGC rules). Using web search, verify each claim. For each, answer VERIFIED, WRONG or UNSURE with a one-line correction/reason. Be concise.
Claims:\n${claims.map((c, i) => `${i + 1}. ${c}`).join('\n')}`;
  let raw;
  try { raw = await gemini(prompt, { json: false, search: true }); }
  catch (e) {
    if (e.name !== 'QuotaError') throw e;
    return { ok: false, unverified: true, issues: ['UNVERIFIED: search quota exhausted - these claims were NOT checked: ' + claims.join(' | ')], raw: '' };
  }
  const issues = raw.split('\n').filter((l) => /\b(WRONG|UNSURE)\b/.test(l));
  return { ok: issues.length === 0, issues, raw };
}

// Lead-magnet: a 1-3 page checklist spec rendered to PDF by the renderer.
export async function writeLeadMagnet(plan, carousel) {
  const prompt = `Create a practical one-page checklist PDF content: "${plan.leadmagnet_title}" for Indian exporters, matching this carousel: ${JSON.stringify(carousel.slides.map((s) => s.title))}.
Return JSON: {"title":"...","subtitle":"...","sections":[{"heading":"...","items":["actionable checkbox item", "..."]}],"closing":"one line pointing to @faizanali.shahji"} with 3-4 sections, 3-5 items each, items <= 14 words. Only include facts you are certain are correct for India; otherwise phrase as "verify current rate/notification".`;
  return gemini(prompt);
}

export const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);

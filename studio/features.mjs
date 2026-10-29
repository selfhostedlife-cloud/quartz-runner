const ROOT = process.env.IG_ROOT || 'C:/Users/smfab/ig-automation';
// Shared learning helpers (no Gemini, no network): turns a studio post into tagged features, scores results, predicts a post's likely performance
// from the learned model (data/learning-model.json, written by learn.mjs). Used by learn.mjs (analysis) and feeder.mjs (ranking the bank).
import fs from 'node:fs';
import path from 'node:path';

const dataDir = (ROOT + '/studio/data');
export const GOAL_VIEWS_24H = 50000;
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
export const loadModel = () => readJson(path.join(dataDir, 'learning-model.json'), null);

function formatOf(p) {
  const k = String(p.keyword || '').toUpperCase();
  const t = `${p.topic || ''} ${p.hook || ''}`;
  if (p.kind === 'data' || k.endsWith('MAP')) return 'data-map';
  // the formats that actually brought followers (2026-10 findings): a free resource offered in the post, and "top N / buys from India" lists
  if (/\b(free|checklist|check list|pdf|costing|starter|blueprint)\b/i.test(t)) return 'free-resource';
  if (/\b(top\s*\d+|\d+\s+(product|website|categor|export|ways|tools|portal)|ideas|buys from india|sells to|bookmark)/i.test(t)) return 'top-list';
  if (/freight|\bports?\b|congestion|container|shipping line|demurrage/i.test(t)) return 'logistics';
  if (/rule|deadline|exempt|notification|rbi|dgft|fema|rodtep|duty|circular|policy|scheme|rcmc|\bban\b|mep\b|\bopen(ed)?\b/i.test(t) || /^(FEMA|MICRO|RODTEP|WHEAT)$/.test(k)) return 'policy-rule';
  if (/pay|refus|\blc\b|advance|fraud|ghost|scam|default|dispute|claim/i.test(t)) return 'payment-risk';
  if (/buyer|importer|germany|europe|find|cold email|lead/i.test(t)) return 'buyer-finding';
  return 'other';
}

export function slideCount(p) {
  const spec = readJson(path.join(p.dir || '', 'spec.json'), null);
  return spec?.slides?.length || (fs.existsSync(p.dir || '') ? fs.readdirSync(p.dir).filter((f) => /^slide_\d+\.jpg$/.test(f)).length : 0);
}

export function featuresOf(p) {
  const hook = String(p.hook || '');
  const words = hook.split(/\s+/).filter(Boolean).length;
  const f = {
    format: formatOf(p),
    hook_number: /\d/.test(hook) ? 'yes' : 'no',
    hook_money: /₹|â‚¹|\brs\.?\s?\d|lakh|crore|\$|usd/i.test(hook) ? 'yes' : 'no',
    hook_question: /\?/.test(hook) ? 'yes' : 'no',
    hook_story: /refus|zero|ghost|lost|stuck|vanish|sent \d|shipped|blocked|trapped|seiz|cancel|jumped|doubled|cut\b|dropped|hidden/i.test(hook) ? 'yes' : 'no',
    hook_len: words <= 8 ? 'short' : words <= 12 ? 'medium' : 'long',
    slides: (() => { const n = slideCount(p); return n >= 9 ? '9-10' : n >= 7 ? '7-8' : n >= 5 ? '5-6' : n ? '<=4' : 'unknown'; })(),
  };
  const fam = readJson(path.join(p.dir || '', 'spec.json'), null)?.family; if (fam) f.family = fam; // panel / case / guide / table / cine
  if (p.kind !== 'history' && p.kind !== 'reel') f.look = p.look || (p.kind === 'reference' ? 'reference' : p.kind === 'data' ? 'data' : 'ink-gold'); // which design rotation look the post wore
  if (p.kind === 'reference') f.source = 'reference'; // posts built from a screenshot reference: does copying a proven structure beat our own ideas?
  const due = (p.buffer || []).map((e) => e.dueAt).filter(Boolean).sort()[0] || p.dueAt;
  if (due) {
    const t = new Date(new Date(due).getTime() + 5.5 * 3600e3);
    f.slot = t.getUTCHours() < 15 ? 'noon' : 'evening';
    f.day = [0, 6].includes(t.getUTCDay()) ? 'weekend' : 'weekday';
  }
  return f;
}

// An older post pulled from Buffer history (not made by the studio): same features, from its caption and publish time.
// Reels get the topic/hook features only (their slide count, layout and slot rules differ).
export function featuresOfHistory(row) {
  const lines = String(row.text || '').split('\n').map((x) => x.trim()).filter(Boolean);
  const kw = (String(row.text || '').match(/comment\s+["']?([A-Za-z]{3,14})/i) || [])[1] || '';
  const p = { hook: lines[0] || '', topic: lines.slice(0, 2).join(' ').slice(0, 180), keyword: kw.toUpperCase(), kind: row.kind === 'reel' ? 'reel' : 'history', dir: '', buffer: [{ dueAt: row.sentAt }] };
  const f = featuresOf(p);
  if (row.kind === 'reel') return { format: f.format }; // a reel caption is not its hook, so only the topic type is learned from reels
  const n = row.assets || 0; f.slides = n >= 9 ? '9-10' : n >= 7 ? '7-8' : n >= 5 ? '5-6' : n ? '<=4' : 'unknown';
  return f;
}

// views after 24h (fallback: first later snapshot) per account
export function views24(p, acct) { const m = p.metrics?.[acct]; return m?.h24?.views ?? m?.h72?.views ?? m?.d7?.views ?? null; }
export function saveShare24(p, acct) { const m = p.metrics?.[acct]; const s = m?.h24 || m?.h72 || m?.d7; return s ? (s.views ? (s.saves + s.shares) / s.views : 0) : null; }

// performance index: views / that account's own median carousel views (1.0 = normal for that account). Mean over accounts that have data.
// Followers matter as much as views (owner 2026-10-29: the posts that brought followers were not the ones that topped the views table), so the index
// blends views vs baseline (60%) with followers-per-1000-views vs the account's own median rate (40%, capped at 4x). learn.mjs sets the follow baselines.
let FOLLOW_BASE = {};
export function setFollowBaseline(b) { FOLLOW_BASE = b || {}; }
export function followRate(p, acct) { const m = p.metrics?.[acct]; const s = m?.h72 || m?.h24 || m?.d7; return s && s.views >= 300 ? (s.follows || 0) / s.views * 1000 : null; } // latest snapshot: follows trickle in after 24h
export function indexOf(p, baseline) {
  const xs = [];
  for (const acct of ['main', 'test']) {
    const v = views24(p, acct); const b = baseline?.[acct]?.views;
    if (v == null || !b) continue;
    const fr = followRate(p, acct), fb = FOLLOW_BASE[acct];
    xs.push(fr != null && fb ? 0.6 * (v / b) + 0.4 * Math.min(fr / fb, 4) : v / b);
  }
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

// predicted index for a (possibly unpublished) post using shrunk per-feature means from the model
export function predict(p, model = loadModel()) {
  if (!model?.lifts) return { score: 1, basis: [] };
  const f = featuresOf(p); const g = model.global?.mean || 1; const parts = [];
  for (const [k, v] of Object.entries(f)) {
    if (k === 'slot' || k === 'day') continue; // scheduling features are chosen by the feeder, not intrinsic to the post
    const l = model.lifts[`${k}=${v}`];
    if (l) parts.push({ k: `${k}=${v}`, shrunk: l.shrunk, n: l.n });
  }
  const score = parts.length ? parts.reduce((a, x) => a + x.shrunk, 0) / parts.length : g;
  return { score, basis: parts };
}

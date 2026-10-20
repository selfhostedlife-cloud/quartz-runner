const ROOT = process.env.IG_ROOT || 'C:/Users/smfab/ig-automation';
// Owner rules that are checked at write time (2026-10-20):
//  - Mistake vs Fix slide: at most ONE post per week uses it (it was on every post).
//  - Standing instructions sent as plain text on Telegram are saved in data/directives.json and injected into every writing prompt.
import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.join(ROOT, 'studio', 'data');
const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8')); } catch { return d; } };

const MF = /mistake\s*:|!!mistake|\bmistake\s+vs\.?\s+fix|\bfix\s*:/i;
const specText = (dir) => { try { return fs.readFileSync(path.join(dir, 'spec.json'), 'utf8'); } catch { return ''; } };

// true when no post written in the last 7 days (rejected ones too) already used a Mistake/Fix slide
export function mistakeFixAllowed(now = Date.now()) {
  const posts = rd('state.json', { posts: [] }).posts || [];
  const since = now - 7 * 864e5;
  for (const p of posts) {
    if (!p.createdAt || new Date(p.createdAt).getTime() < since) continue;
    const dir = path.join(ROOT, 'out', 'posts', path.basename(String(p.dir || '').replace(/\\/g, '/')));
    if (MF.test(specText(dir))) return false;
  }
  return true;
}

export const MF_RULE_ON = 'This week no post has used a Mistake -> Fix slide yet, so include exactly ONE slide with a clear mistake and its fix (text format: "!!Mistake:!!\\n<one line>\\n\\n++Fix:++\\n<one or two lines>").';
export const MF_RULE_OFF = 'DO NOT write any "Mistake:" / "Fix:" labelled slide, mistake-vs-fix pair or "wrong vs right" comparison: another post already used that format this week (owner rule: one per week at most). Teach the same lesson with a different shape: a worked example with numbers, a checklist, a step order, a before/after of a document, or a short scenario.';

// the owner's standing instructions (newest last), as one prompt block ('' when none)
export function directivesBlock() {
  const d = rd('directives.json', []);
  if (!d.length) return '';
  return 'OWNER STANDING RULES (sent by the owner on Telegram; they override every default below):\n' + d.slice(-20).map((x, i) => `${i + 1}. ${x.text}`).join('\n');
}

export function addDirective(text) {
  const f = path.join(dataDir, 'directives.json');
  const d = rd('directives.json', []);
  d.push({ at: new Date().toISOString(), text: String(text).trim().slice(0, 600) });
  fs.writeFileSync(f, JSON.stringify(d, null, 2));
  return d.length;
}

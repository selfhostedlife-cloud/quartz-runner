// Converts a generated winner-template post (spec.json with `template`) into the V2 look (1080x1350, big literal photos), the design that earned the most views and follows.
// usage: node studio/v2convert.mjs <postDir>   (keeps the old spec as spec.winner.json; caption, PDF and lead magnet stay as they are)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { suggestQueries } from '../renderer/photojudge.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(process.argv[2] || '');
const specFile = path.join(dir, 'spec.json');
const old = JSON.parse(fs.readFileSync(specFile, 'utf8'));
if (old.family) { console.log(JSON.stringify({ skipped: 'already V2' })); process.exit(0); }
fs.copyFileSync(specFile, path.join(dir, 'spec.winner.json'));

const plain = (t) => String(t ?? '').replace(/\*\*|==|\+\+|!!/g, '').replace(/\s+/g, ' ').trim();
const money = /((?:Rs\.?|₹)\s?[0-9][0-9,.]*(?:\s?(?:lakh|crore|L|K))?|[0-9][0-9,.]*\s?(?:lakh|crore|%))/gi;

// cover headline: 2-3 short lines, first yellow, rest white (^), money figures in yellow
function coverTitle(t) {
  const words = plain(t).replace(/[.]+$/, '').toUpperCase().split(' ');
  const total = words.join(' ').length; const target = Math.max(12, Math.ceil(total / (total > 44 ? 3 : 2)));
  const lines = []; let cur = '';
  for (const w of words) { if (cur && (cur + ' ' + w).length > target && lines.length < 2) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; }
  lines.push(cur);
  return lines.map((l, i) => (i === 0 ? '' : '^') + (i === 0 ? l : l.replace(money, (m) => `{y|${m}}`))).join('\n');
}
const bullets = (s) => {
  const out = [];
  for (const line of String(s.text || '').split('\n')) for (const sent of line.split(/(?<=[.!?])\s+(?=[A-Z₹])/)) { const x = sent.trim().replace(/\.$/, ''); if (x) out.push(x); }
  if (s.stat) out.push('**' + plain(s.stat) + '**');
  if (s.teaser) out.push('**' + plain(s.teaser).replace(/\s*>+\s*$/, ' >>>') + '**');
  return out.slice(0, 5);
};
const cut = (x, n) => { if (x.length <= n) return x; const sent = x.slice(0, n).match(/^.*[.!?]/); return sent ? sent[0] : x.slice(0, n).replace(/s+S*$/, '') + '.'; };
const label = (s) => { const t = plain(s.title).replace(/[.:]+$/, '').toUpperCase(); return t.length <= 36 ? t : plain(s.kicker || t).toUpperCase().slice(0, 36); };

// one literal photo query per slide: Gemini suggestions first, then the generator's own queries; never the same query twice
let sug = {}; for (let a = 0; a < 3 && !Object.keys(sug).length; a++) { try { sug = await suggestQueries(old.slides, old.slides[0]?.title || ''); } catch (e) { console.error('[v2convert] query suggestions unavailable (' + (a + 1) + '/3):', e.message); if (a < 2) await new Promise((r) => setTimeout(r, 30000)); } }
const RULES = [ // literal, visual queries by topic words (used when Gemini cannot suggest photos); several per topic so slides never repeat a photo
  [/\b(fabric|dyeing|cotton|yarn)\b/i, ['fabric rolls textile', 'cotton fabric dyeing', 'textile mill']],
  [/\b(stitching|sewing|garments?|trims|apparel)\b/i, ['sewing machine garment factory', 'clothes factory workers', 'garment rack clothes']],
  [/\b(trucks?|haulage|inland|trucking|depot)\b/i, ['truck cargo highway', 'lorry road freight']],
  [/\b(ocean|freight|containers?|shipping|vessel|port|terminal)\b/i, ['container ship port crane', 'cargo ship ocean', 'stacked shipping containers']],
  [/\b(customs|compliance|clearance)\b/i, ['customs inspection cargo', 'documents stamp desk']],
  [/\b(letter of credit|lc|payments?|advance|credit|bank|escrow|terms)\b/i, ['bank money payment', 'signing contract pen', 'handshake business deal']],
  [/\b(tax|records?|registration|registry|verify|vetting|audit)\b/i, ['accounting documents calculator', 'office documents audit']],
  [/\b(importers?|buyers?|directory|find|sourcing|fairs?)\b/i, ['business meeting handshake', 'trade fair exhibition', 'office team meeting']],
  [/\b(email|outreach|messages?|pitch)\b/i, ['laptop email desk', 'typing laptop business']],
  [/\b(price|quote|cost|costs|margin|profit|calculat\w*|money|lakh)\b/i, ['calculator money desk', 'rupee notes money']],
  [/\b(insurance|risk|ecgc|cover)\b/i, ['insurance documents shield', 'business risk documents']],
];
const ruleQ = (s) => { for (const txt of [[s.kicker, s.title].join(' '), [s.kicker, s.title, s.text].join(' ')]) for (const [re, qs] of RULES) if (re.test(txt)) { const q = qs.find((x) => !used.has(x)); if (q) return q; } return null; };
const used = new Set();
const pickQ = (s, i) => { const rq = ruleQ(s); const cands = [...(sug[i] || []), ...(rq ? [rq] : []), ...(s.imageQueries || [])].filter(Boolean); const q = cands.find((c) => !used.has(c.toLowerCase())) || cands[0] || 'shipping containers port'; used.add(q.toLowerCase()); return q; };
const coverQ = old.slides[0]?.imageQueries?.[0] || 'shipping containers port'; used.add(coverQ.toLowerCase());

const slides = old.slides.map((s, i) => {
  if (s.type === 'cover') return { type: 'cover', family: 'panel', title: coverTitle(s.title), sub: cut(plain(s.sub || s.text || ''), 110), q: coverQ };
  if (s.type === 'cta') {
    const kw = (String(s.button || '').match(/[“"]?([A-Z0-9]{3,})[”"]?\s*$/i) || [])[1] || '';
    return { type: 'cta', title: plain(s.title).toUpperCase(), q: 'cargo port containers night', text: String(s.text || '').replace(/\s*Follow so the DM reaches you\.?/i, ''), button: `COMMENT “${kw.toUpperCase()}”`, note: "I'll DM you the free PDF.\nFollow so it reaches you.", pdfPreview: s.pdfPreview || 'pdf_preview.png' };
  }
  if (s.type === 'list') return { type: 'grid', family: 'panel', label: label(s), q: pickQ({ ...s, text: '' }, i), fs: 40, gap: 20, items: (s.items || []).map((x) => plain(x)), note: /illustrative|example/i.test(s.text || '') ? '' : cut(plain(s.text || ''), 110) };
  return { type: 'case', label: label(s), q: pickQ(s, i), bullets: bullets(s) };
});

const spec = { family: 'case', handle: old.handle || '@faizanali.shahji', keyword: old.keyword, slides };
fs.writeFileSync(specFile, JSON.stringify(spec, null, 2));
for (const f of fs.readdirSync(dir)) if (/^img_\d+\.jpg(\.credit\.json)?$/.test(f)) fs.rmSync(path.join(dir, f)); // old square-format photos are re-picked for the V2 queries
const r = spawnSync(process.execPath, [path.join(HERE, '..', 'renderer', 'render.mjs'), specFile, dir], { encoding: 'utf8', timeout: 12 * 60e3 });
if (r.status !== 0) { fs.copyFileSync(path.join(dir, 'spec.winner.json'), specFile); console.error('[v2convert] render failed, restored the old spec:', (r.stderr || '').slice(-400)); process.exit(1); }
console.log(JSON.stringify({ converted: true, slides: slides.length }));

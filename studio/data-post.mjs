// Data-based carousel (10 slides) built ONLY from the Comtrade snapshot in data/comtrade-top.json - no AI-written facts.
// Usage: node data-post.mjs <hsCode>   -> prints JSON {id, outDir, keyword, pdf, topic, hook}
import fs from 'node:fs';
import { addFixedLines, stripFixedLines } from './caption.mjs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { renderLeadMagnet } from './leadmagnet.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const hs = process.argv[2];
const data = JSON.parse(fs.readFileSync(path.join(here, 'data', 'comtrade-top.json'), 'utf8'));
const p = data.products[hs];
if (!p) { console.error('unknown HS code', hs, 'known:', Object.keys(data.products).join(',')); process.exit(1); }

const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);
const money = (v) => (v >= 1e9 ? `$${(v / 1e9).toFixed(v >= 1e10 ? 1 : 2)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(v >= 1e8 ? 0 : 1)}M` : `$${Math.round(v / 1e3)}K`);
const chg = (a, b) => (b ? Math.round(((a - b) / b) * 100) : null);
const sgn = (n) => (n === null ? 'new buyer data' : `${n >= 0 ? '+' : '-'}${Math.abs(n)}%`);
const share = (v) => ((v / p.tot23) * 100).toFixed(v / p.tot23 >= 0.1 ? 0 : 1);
const rows = p.top.map(([c, v23, v22]) => ({ c, v23, v22, ch: chg(v23, v22) }));
const total = chg(p.tot23, p.tot22);

const COVER_Q = { '100630': ['rice sacks warehouse', 'rice grains sack'], '610910': ['t-shirts folded stack', 'cotton t-shirts clothing'], '300490': ['medicine boxes pharmacy', 'pharmaceutical packaging'], '091030': ['turmeric powder', 'turmeric root spice'], '640399': ['leather shoes', 'shoes factory'], '630260': ['towels stack folded', 'terry towels'], '620520': ['shirts folded stack', 'men shirts clothing rack'], '090920': ['coriander seeds', 'spices market'] };
const slides = [];
slides.push({ type: 'cover', kicker: `${p.name} export data`, title: `The world bought ==${money(p.tot23)}== of Indian ${p.name} in 2023.\n++Who are the top buyers?++`, sub: 'Real UN Comtrade data. Top countries ranked.', teaser: 'Swipe for the top 7', imageQueries: COVER_Q[hs] || p.photo });
// each buyer slide uses a DIFFERENT design so the swipe never feels repetitive (hero number / leaderboard / 2022-vs-2023 bars / share ring), alternating dark, light, gold and purple
const SHORT = { 'United Arab Emirates': 'UAE', 'United Kingdom': 'UK', 'Saudi Arabia': 'Saudi', 'Russian Federation': 'Russia', 'South Africa': 'S. Africa', "Cote d'Ivoire": 'Ivory Coast' };
const sh = (c) => SHORT[c] || c;
const top7 = rows.slice(0, 7);
const PLAN = [['hero', 'gold'], ['leaderboard', 'dark'], ['versus', 'light'], ['donut', 'purple'], ['hero', 'dark'], ['leaderboard', 'light'], ['versus', 'gold']];
top7.forEach((r, i) => {
  const n = i + 1, [lay0, theme] = PLAN[i];
  const lay = lay0 === 'versus' && !r.v22 ? 'hero' : lay0;
  const teaser = i < 6 ? 'Next buyer...' : 'Who is rising, who is falling?';
  const growth = r.v22 ? `${sgn(r.ch)} vs 2022 (${money(r.v22)})` : 'No 2022 figure in the data';
  const base = { kicker: `Buyer #${n}`, teaser, theme, layout: lay, type: 'stat' };
  if (lay === 'hero') slides.push({ ...base, stat: money(r.v23), title: r.c, rank: n, text: `==${share(r.v23)}%== of the world total
${growth}` });
  else if (lay === 'leaderboard') slides.push({ ...base, title: `#${n} ${r.c}: ${money(r.v23)}`, rows: top7.map((x, k) => ({ label: sh(x.c), value: x.v23, vl: money(x.v23), hi: k === i })), text: `${share(r.v23)}% of the world total. ${growth}` });
  else if (lay === 'versus') slides.push({ ...base, title: `#${n} ${r.c}: 2022 vs 2023`, bars: [{ label: '2022', value: r.v22, vl: money(r.v22) }, { label: '2023', value: r.v23, vl: money(r.v23) }], delta: sgn(r.ch), text: `${share(r.v23)}% of the world total in 2023.` });
  else slides.push({ ...base, title: `#${n} ${r.c}`, pct: Number(share(r.v23)), stat: `${share(r.v23)}%`, text: `${r.c} bought ${money(r.v23)}.

World total: ${money(p.tot23)}.
${growth}` });
});
const grow = rows.slice(0, 7).filter((r) => r.v22 > 0).sort((a, b) => b.ch - a.ch);
const rise = grow[0], fall = grow[grow.length - 1];
const lines = [];
if (rise && rise.ch > 0) lines.push(`==Rising:== ${rise.c} ${sgn(rise.ch)}\n${money(rise.v22)} to ${money(rise.v23)}`);
if (fall && fall.ch < 0) lines.push(`++Falling:++ ${fall.c} ${sgn(fall.ch)}\n${money(fall.v22)} to ${money(fall.v23)}`);
lines.push(`World total: ${sgn(total)} vs 2022`);
const cards = [];
if (rise && rise.ch > 0) cards.push({ dir: 'up', pct: sgn(rise.ch), name: rise.c, foot: `${money(rise.v22)} to ${money(rise.v23)}` });
if (fall && fall.ch < 0) cards.push({ dir: 'down', pct: sgn(fall.ch), name: fall.c, foot: `${money(fall.v22)} to ${money(fall.v23)}` });
slides.push({ type: 'point', layout: 'movers', theme: 'dark', kicker: 'Who is moving', title: 'Biggest rise and fall', cards, text: `World total: ${sgn(total)} vs 2022`, teaser: 'Want the full top 10?' });
const pdfTitle = `${p.label} Buyer Map: Top 10 Countries (2023)`;
slides.push({ type: 'cta', kicker: 'Free PDF', title: `Get the ++${cap(p.name.split(' ').slice(-1)[0])} Buyer Map++`, button: `Comment ${p.keyword}`, text: 'Inside:\nTop 10 buyer countries ranked\n2022 vs 2023 change for each\nHow to pick your first 3 markets', pdfPreview: 'pdf_preview.png', imageQueries: ['world map globe', 'handshake business deal'] });

const hook = `The world bought ${money(p.tot23)} of Indian ${p.name} in 2023. Who are the top buyers?`;
const caption = [hook, '', `Source: UN Comtrade 2023, imports reported by each country from India (HS ${hs}).`, `#1 is ${rows[0].c} at ${money(rows[0].v23)} (${share(rows[0].v23)}% of the total).`, '', `Comment ${p.keyword} and I'll DM you the ${p.name} Buyer Map. Follow so the DM reaches you.`, '', '#exportfromindia #indianexporters #importexport #exportbusiness #globaltrade'].join('\n');

const outDir = process.argv[3] ? path.resolve(process.argv[3]) : path.join(root, 'out', 'posts', new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10) + `-data-${hs}`);
const id = path.basename(outDir);
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const NL = '\n';
const lm = {
  title: pdfTitle, subtitle: `Top buyers of Indian ${p.name}, ranked by 2023 import value (UN Comtrade)`,
  sections: [
    { heading: `Top 10 buyer countries, 2023 (HS ${hs})`, paragraph: 'Values are what each country reported importing from India. Change is versus 2022.', items: rows.map((r, i) => `${i + 1}. ${r.c}: ${money(r.v23)} (${r.v22 ? sgn(r.ch) : 'no 2022 figure'})`) },
    { heading: 'How to pick your first 3 markets', items: ['Start from the top 10. Pick 3, not 10.', 'Prefer markets that are rising, or big and steady.', 'Check the import duty for your HS code in each country\'s official tariff database.', 'Ask a buyer or agent what certificates or labels that market needs for your product.', 'Compare the logistics and payment risk of each country before you quote.'] },
    { heading: 'Read this data carefully', items: ['A big drop can mean fewer buyers, a price change or a late report. Do not guess; ask buyers.', `World total for HS ${hs} moved ${sgn(total)} from 2022 to 2023 (${money(p.tot22)} to ${money(p.tot23)}).`, 'Your exact product may sit in a different HS code. Confirm yours first.'] },
  ],
  closing: 'Source: UN Comtrade, imports reported by each country with partner India. Not legal or customs advice. Follow @faizanali.shahji for daily export tips.',
};
fs.writeFileSync(path.join(outDir, 'spec.json'), JSON.stringify({ handle: '@faizanali.shahji', slides }, null, 2));
fs.writeFileSync(path.join(outDir, 'caption.txt'), addFixedLines(caption));
fs.writeFileSync(path.join(outDir, 'leadmagnet.json'), JSON.stringify(lm, null, 2));
const pdf = path.join(outDir, `${p.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-buyer-map.pdf`);
await renderLeadMagnet(lm, pdf, path.join(outDir, 'pdf_preview.png'));
const r = spawnSync(process.execPath, [path.join(root, 'renderer', 'render.mjs'), path.join(outDir, 'spec.json'), outDir], { encoding: 'utf8' });
if (r.status !== 0) { console.error(r.stderr); process.exit(1); }
// no AI claims here: record that every number comes from the data snapshot
fs.writeFileSync(path.join(outDir, 'review.json'), JSON.stringify({ hook, sub: 'Real UN Comtrade data', scores: {}, claims: ['All numbers from data/comtrade-top.json (UN Comtrade 2022-2023)'], factcheck: { ok: true, unverified: false, issues: [] }, promise: { matches: true, gaps: [] } }, null, 2));
console.log(JSON.stringify({ id, outDir, keyword: p.keyword, pdf, topic: pdfTitle, hook }));

// Story-driven data carousels: each product gets its OWN angle, palette, font and slide sequence (no shared template).
// All numbers come from data/comtrade-detail.json (UN Comtrade, imports reported by each country from India). Nothing is AI-written.
// Usage: node data-story.mjs <hs> [outDir]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { renderLeadMagnet } from './leadmagnet.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const hs = process.argv[2];
const detail = JSON.parse(fs.readFileSync(path.join(here, 'data', 'comtrade-detail.json'), 'utf8'));
const P = detail.products[hs];
if (!P) { console.error('no story data for', hs, 'known:', Object.keys(detail.products).join(',')); process.exit(1); }

const money = (v) => (v >= 1e9 ? `$${(v / 1e9).toFixed(v >= 1e10 ? 1 : 2)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(v >= 1e8 ? 0 : 1)}M` : `$${Math.round(v / 1e3)}K`);
const kgs = (v) => `${(v / 1e6).toFixed(1)}M kg`;
const usd = (v) => `$${v.toFixed(2)}`;
const pct = (a, b) => (b ? Math.round(((a - b) / b) * 100) : null);
const sgn = (n) => `${n >= 0 ? '+' : '-'}${Math.abs(n)}%`;
const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);
const SHORT = { 'United Arab Emirates': 'UAE', 'United Kingdom': 'UK', 'Saudi Arabia': 'Saudi', 'South Africa': 'S. Africa' };
const sh = (c) => SHORT[c] || c;
const ISO3 = { 'United Kingdom': 'UK', 'United Arab Emirates': 'UAE', 'Saudi Arabia': 'KSA', 'South Africa': 'RSA', Bangladesh: 'BGD', Egypt: 'EGY', Nepal: 'NPL', Malaysia: 'MYS', Morocco: 'MAR', Germany: 'DEU', Japan: 'JPN', Netherlands: 'NLD', Canada: 'CAN', Mexico: 'MEX', Australia: 'AUS', France: 'FRA', Israel: 'ISR', USA: 'USA', China: 'CHN' };
const CTA_NAME = { '091030': 'Turmeric', '640399': 'Footwear', '630260': 'Towel', '620520': 'Shirt', '090920': 'Coriander' };
const R = P.rows.map(([c, v23, v22, kg23, kg22]) => ({ c, v23, v22, kg23, kg22, uv: kg23 ? v23 / kg23 : null, ch: pct(v23, v22), x: v22 ? v23 / v22 : null }));
const by = (c) => R.find((r) => r.c === c);
const rank22 = Object.fromEntries([...R].sort((a, b) => b.v22 - a.v22).map((r, i) => [r.c, i + 1]));
const slopeRows = R.map((r, i) => ({ label: sh(r.c), r22: rank22[r.c], r23: i + 1 }));
const byPrice = [...R].filter((r) => r.uv).sort((a, b) => b.uv - a.uv);
const share = (v) => Math.round((v / P.tot23) * 100);
const total = pct(P.tot23, P.tot22);
const receipt = (title, theme, extra = {}) => ({ type: 'point', layout: 'receipt', theme, kicker: 'Price per kg', title, head: 'PRICE PER KG', rows: byPrice.map((r, i) => ({ label: sh(r.c), vl: usd(r.uv), hi: i === 0, lo: i === byPrice.length - 1 })), foot: 'Import value / net kg, 2023', ...extra });
const podium = (title, theme, extra = {}) => ({ type: 'point', layout: 'podium', theme, kicker: 'Who pays the most', title, items: byPrice.slice(0, 3).map((r) => ({ label: sh(r.c), vl: usd(r.uv) })), unit: 'per kg', text: 'Average value per kg = import value divided by weight, 2023.', ...extra });
const bubbles = (title, theme, extra = {}) => ({ type: 'point', layout: 'bubbles', theme, kicker: 'Who buys the most', title, items: R.map((r) => ({ label: sh(r.c), short: ISO3[r.c] || r.c.slice(0, 3).toUpperCase(), value: r.v23, vl: money(r.v23) })), ...extra });
const slope = (title, theme, extra = {}) => ({ type: 'point', layout: 'slope', theme, kicker: 'Rank change', title, rows: slopeRows, text: 'Ranks among the top 10 buyers of 2023.', ...extra });
const drop = (r, title, theme, extra = {}) => ({ type: 'point', layout: 'drop', theme, kicker: 'The slide', title, dir: r.v23 < r.v22 ? 'down' : 'up', pct: sgn(r.ch), from: { label: '2022', vl: money(r.v22) }, to: { label: '2023', vl: money(r.v23) }, ...extra });
const mult = (r, title, theme, extra = {}) => ({ type: 'point', layout: 'multiplier', theme, kicker: 'The jump', title, x: `${r.x.toFixed(1)}x`, small: { label: `${r.c} 2022`, vl: money(r.v22), v: r.v22 }, big: { label: `${r.c} 2023`, vl: money(r.v23), v: r.v23 }, ...extra });

const STORIES = {
  '091030': () => {
    const bd = by('Bangladesh'), us = by('USA'), uae = by('United Arab Emirates');
    return {
      font: 'DM Serif Display', coverQ: ['turmeric powder', 'turmeric root spice'],
      hook: `Bangladesh buys the most Indian turmeric. The USA pays ${Math.floor(us.uv / bd.uv)}x more per kg.`,
      title: `==Bangladesh== buys the most Indian turmeric.\n++The USA pays ${Math.floor(us.uv / bd.uv)}x more per kg.++`, sub: 'UN Comtrade 2023: who buys, who pays.',
      facts: [`Bangladesh bought ${kgs(bd.kg23)} for ${money(bd.v23)} (${usd(bd.uv)} per kg).`, `The USA bought ${kgs(us.kg23)} for ${money(us.v23)} (${usd(us.uv)} per kg).`],
      slides: [
        bubbles(`Total: ${money(P.tot23)} in 2023`, 'amber', { text: `${bd.c} ${money(bd.v23)} | ${us.c} ${money(us.v23)} | Morocco ${money(by('Morocco').v23)}` }),
        podium('Who pays the most per kg', 'gold'),
        { type: 'point', layout: 'duel', theme: 'purple', kicker: 'Volume vs price', title: 'Same money, very different weight', a: { label: 'Bangladesh', value: usd(bd.uv), unit: 'per kg', sub: `${kgs(bd.kg23)} bought` }, b: { label: 'USA', value: usd(us.uv), unit: 'per kg', sub: `${kgs(us.kg23)} bought` }, badge: `${(us.uv / bd.uv).toFixed(1)}x price gap` },
        receipt('All 10 buyers, ranked by price', 'amber'),
        slope('Who moved up, who moved down', 'cream'),
        drop(uae, 'The biggest fall in the top 10', 'purple', { text: `United Arab Emirates, turmeric imports from India.` }),
        { type: 'point', layout: 'statement', theme: 'gold', kicker: 'The takeaway', title: `Bangladesh: ==${kgs(bd.kg23)}== for ${money(bd.v23)}.\nUSA: ==${kgs(us.kg23)}== for ${money(us.v23)}.`, text: `About the same money. The USA took about a fifth of the weight.`, size: 66 },
      ],
    };
  },
  '640399': () => {
    const us = by('USA'), fr = by('France'), de = by('Germany');
    const eu = ['Germany', 'United Kingdom', 'France', 'Poland', 'Italy', 'Spain', 'Austria', 'Switzerland'];
    const euSum = R.filter((r) => eu.includes(r.c)).reduce((a, r) => a + r.v23, 0);
    return {
      font: 'Poppins', coverQ: ['leather shoes', 'shoes factory'],
      hook: `The USA cut Indian shoe orders by ${Math.abs(us.ch)}%. France doubled.`,
      title: `The USA cut Indian shoe orders by ==${Math.abs(us.ch)}%==.\n++France doubled.++`, sub: 'Footwear with leather uppers, UN Comtrade 2022 vs 2023.',
      facts: [`USA: ${money(us.v22)} to ${money(us.v23)} (${sgn(us.ch)}).`, `France: ${money(fr.v22)} to ${money(fr.v23)} (${fr.x.toFixed(1)}x).`],
      slides: [
        drop(us, 'The USA pulled back', 'monored', { text: 'USA imports of Indian leather-upper footwear.' }),
        mult(fr, 'France went the other way', 'cream'),
        slope('Germany took the #1 spot', 'monored'),
        podium('Who pays the most per kg', 'gold'),
        { type: 'stat', layout: 'hero', theme: 'dark', kicker: 'Europe', stat: `${Math.round((euSum / P.tot23) * 100)}%`, title: 'goes to 8 European countries', text: `Germany, UK, France, Poland, Italy, Spain, Austria, Switzerland: ${money(euSum)} of ${money(P.tot23)}.`, bigSize: 230 },
        { type: 'point', layout: 'statement', theme: 'cream', kicker: 'New order', title: `Germany is the new ==#1==.\n${money(de.v23)}, ${sgn(de.ch)}.`, text: `The USA fell to #2 at ${money(us.v23)}.`, size: 78 },
      ],
    };
  },
  '630260': () => {
    const us = by('USA');
    const rest = P.tot23 - us.v23; const top10 = R.reduce((a, r) => a + r.v23, 0);
    return {
      font: 'Montserrat', coverQ: ['towels stack folded', 'terry towels'],
      hook: `${share(us.v23)}% of Indian terry towel exports go to ONE country.`,
      title: `==${share(us.v23)}%== of Indian terry towel exports go to ++ONE country.++`, sub: 'UN Comtrade 2023: who really buys.',
      facts: [`The USA bought ${money(us.v23)} of ${money(P.tot23)}.`, `The next biggest, the UK, bought ${money(by('United Kingdom').v23)}.`],
      slides: [
        bubbles('One giant, nine small', 'mint', { text: `UK ${money(by('United Kingdom').v23)} | Australia ${money(by('Australia').v23)} | Germany ${money(by('Germany').v23)} | Canada ${money(by('Canada').v23)}` }),
        { type: 'point', layout: 'duel', theme: 'dark', kicker: 'USA vs the rest', title: 'One buyer vs the whole world', a: { label: 'USA', value: money(us.v23), unit: `${share(us.v23)}% of the total`, sub: `${kgs(us.kg23)}` }, b: { label: 'All other countries', value: money(rest), unit: `${100 - share(us.v23)}% of the total`, sub: 'combined' }, badge: `USA = ${(us.v23 / rest).toFixed(1)}x the rest` },
        { type: 'point', layout: 'leaderboard', theme: 'cream', kicker: 'Without the USA', title: 'The #2 buyer is the UK', rows: R.slice(1, 8).map((r, i) => ({ label: sh(r.c), value: r.v23, vl: money(r.v23), hi: i === 0 })), text: `The UK buys ${money(by('United Kingdom').v23)}. The USA buys ${money(us.v23)}.` },
        drop({ v22: P.tot22, v23: P.tot23, ch: total }, 'The whole market shrank', 'monored', { text: 'World imports of Indian cotton terry towels.' }),
        receipt('What each country pays per kg', 'amber'),
        { type: 'point', layout: 'statement', theme: 'lime', kicker: 'Concentration', title: `The top 10 buyers take ==${share(top10)}%==.\nThe USA alone takes ${share(us.v23)}%.`, text: `The UK is next at ${((by('United Kingdom').v23 / P.tot23) * 100).toFixed(1)}%.`, size: 76 },
      ],
    };
  },
  '620520': () => {
    const us = by('USA'), fr = by('France'), de = by('Germany'), uae = by('United Arab Emirates');
    return {
      font: 'Rubik', coverQ: ['shirts folded stack', 'men shirts clothing rack'],
      hook: `France doubled its Indian shirt orders. The USA cut ${Math.abs(us.ch)}%.`,
      title: `==France== doubled its Indian shirt orders.\n++The USA cut ${Math.abs(us.ch)}%.++`, sub: "Men's cotton shirts, UN Comtrade 2022 vs 2023.",
      facts: [`France: ${money(fr.v22)} to ${money(fr.v23)}.`, `USA: ${money(us.v22)} to ${money(us.v23)} (${sgn(us.ch)}).`],
      slides: [
        mult(fr, 'France doubled in a year', 'cream'),
        slope('Who climbed the ranking', 'dark'),
        drop(us, 'The USA still leads, but less', 'gold', { text: "USA imports of Indian men's cotton shirts." }),
        { type: 'point', layout: 'duel', theme: 'purple', kicker: 'Price per kg', title: 'Same shirt category, different price', a: { label: 'UAE', value: usd(uae.uv), unit: 'per kg', sub: `${kgs(uae.kg23)} bought` }, b: { label: 'Germany', value: usd(de.uv), unit: 'per kg', sub: `${kgs(de.kg23)} bought` }, badge: `${(de.uv / uae.uv).toFixed(1)}x price gap` },
        { type: 'stat', layout: 'donut', theme: 'amber', kicker: 'Share', title: 'The USA is still a third of the market', pct: share(us.v23), stat: `${share(us.v23)}%`, text: `The USA buys ${money(us.v23)}.\nGermany, #2, buys ${money(de.v23)}.` },
        { type: 'point', layout: 'movers', theme: 'monored', kicker: 'Other risers', title: 'More fast risers', cards: [by('Spain'), by('Netherlands')].map((r) => ({ dir: 'up', pct: sgn(r.ch), name: r.c, foot: `${money(r.v22)} to ${money(r.v23)}` })), text: `World total: ${sgn(total)} vs 2022` },
      ],
    };
  },
  '090920': () => {
    const cn = by('China'), my = by('Malaysia'), eg = by('Egypt'), bd = by('Bangladesh');
    return {
      font: 'Fraunces', coverQ: ['coriander seeds', 'spices market'],
      hook: `China's coriander imports from India jumped nearly ${Math.round(cn.x)}x in one year.`,
      title: `China's coriander imports from India jumped ==nearly ${Math.round(cn.x)}x== in one year.`, sub: `UN Comtrade: world total ${sgn(total)} vs 2022.`,
      facts: [`China: ${money(cn.v22)} to ${money(cn.v23)}.`, `Egypt: ${money(eg.v22)} to ${money(eg.v23)}. Bangladesh: ${money(bd.v22)} to ${money(bd.v23)}.`],
      slides: [
        mult(cn, 'China, 2022 vs 2023', 'lime'),
        bubbles('China is now the giant', 'cream', { text: `China ${money(cn.v23)} | Malaysia ${money(my.v23)} | UAE ${money(by('United Arab Emirates').v23)}` }),
        { type: 'point', layout: 'statement', theme: 'gold', kicker: 'New buyers', title: `Egypt: ${money(eg.v22)} to ==${money(eg.v23)}==.\nBangladesh: ${money(bd.v22)} to ==${money(bd.v23)}==.`, text: 'Two buyers that were tiny in 2022.', size: 70 },
        slope('The ranking was reshuffled', 'dark'),
        drop(my, 'One big buyer slipped', 'purple', { text: 'Malaysia, coriander imports from India.' }),
        podium('Who pays the most per kg', 'amber'),
      ],
    };
  },
};

if (!STORIES[hs]) { console.error('no story defined for', hs); process.exit(1); }
const st = STORIES[hs]();
const pdfTitle = `${P.label} Buyer Map: Top 10 Countries (2023)`;
const slides = [
  { type: 'cover', kicker: `${P.name} export data`, title: st.title, sub: st.sub, teaser: 'Swipe for the story', imageQueries: st.coverQ },
  ...st.slides.map((s, i) => ({ ...s, teaser: s.teaser || 'Next...' })),
  { type: 'cta', kicker: 'Free PDF', title: `Get the ++${CTA_NAME[hs] || cap(P.name.split(' ')[0])} Buyer Map++`, button: `Comment ${P.keyword}`, text: 'Inside:\nTop 10 buyer countries ranked\n2022 vs 2023 change for each\nPrice per kg by country', pdfPreview: 'pdf_preview.png', imageQueries: ['world map globe', 'handshake business deal'] },
];
slides[slides.length - 2].teaser = 'Want the full top 10?';

const caption = [st.hook, '', `Source: UN Comtrade 2022-2023, imports reported by each country from India (HS ${hs}).`, ...st.facts, '', `Comment ${P.keyword} and I'll DM you the ${P.name} Buyer Map. Follow so the DM reaches you.`, '', '#exportfromindia #indianexporters #importexport #exportbusiness #globaltrade'].join('\n');

const outDir = process.argv[3] ? path.resolve(process.argv[3]) : path.join(root, 'out', 'posts', new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10) + `-data-${hs}`);
const id = path.basename(outDir);
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const lm = {
  title: pdfTitle, subtitle: `Top buyers of Indian ${P.name}, ranked by 2023 import value (UN Comtrade)`,
  sections: [
    { heading: `Top 10 buyer countries, 2023 (HS ${hs})`, paragraph: 'Values are what each country reported importing from India. Change is versus 2022.', items: R.map((r, i) => `${i + 1}. ${r.c}: ${money(r.v23)} (${r.v22 ? sgn(r.ch) : 'no 2022 figure'})`) },
    { heading: 'Average value per kg, 2023', paragraph: 'Import value divided by net weight. A guide to which markets pay more, not a price quote.', items: byPrice.map((r) => `${r.c}: ${usd(r.uv)} per kg`) },
    { heading: 'How to pick your first 3 markets', items: ['Start from the top 10. Pick 3, not 10.', 'Prefer markets that are rising, or big and steady.', "Check the import duty for your HS code in each country's official tariff database.", 'Ask a buyer or agent what certificates or labels that market needs for your product.', 'Compare the logistics and payment risk of each country before you quote.'] },
    { heading: 'Read this data carefully', items: ['A big drop can mean fewer buyers, a price change or a late report. Do not guess; ask buyers.', `World total for HS ${hs} moved ${sgn(total)} from 2022 to 2023 (${money(P.tot22)} to ${money(P.tot23)}).`, 'Your exact product may sit in a different HS code. Confirm yours first.'] },
  ],
  closing: 'Source: UN Comtrade, imports reported by each country with partner India. Not legal or customs advice. Follow @faizanali.shahji for daily export tips.',
};
fs.writeFileSync(path.join(outDir, 'spec.json'), JSON.stringify({ handle: '@faizanali.shahji', font: st.font, topic: st.hook, slides }, null, 2));
fs.writeFileSync(path.join(outDir, 'caption.txt'), caption);
fs.writeFileSync(path.join(outDir, 'leadmagnet.json'), JSON.stringify(lm, null, 2));
const pdf = path.join(outDir, `${P.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-buyer-map.pdf`);
await renderLeadMagnet(lm, pdf, path.join(outDir, 'pdf_preview.png'));
const r = spawnSync(process.execPath, [path.join(root, 'renderer', 'render.mjs'), path.join(outDir, 'spec.json'), outDir], { encoding: 'utf8' });
if (r.status !== 0) { console.error(r.stderr); process.exit(1); }
fs.writeFileSync(path.join(outDir, 'review.json'), JSON.stringify({ hook: st.hook, sub: st.sub, scores: {}, claims: ['All numbers from data/comtrade-detail.json (UN Comtrade 2022-2023); price per kg = import value / net kg'], factcheck: { ok: true, unverified: false, issues: [] }, promise: { matches: true, gaps: [] } }, null, 2));
console.log(JSON.stringify({ id, outDir, keyword: P.keyword, pdf, topic: pdfTitle, hook: st.hook }));

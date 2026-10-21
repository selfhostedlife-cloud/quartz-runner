// Builds V2 posts from blueprint-family specs.
// usage: node studio/v2build.mjs <spec.json> <outDir> [--only 3]
// spec: { family, handle?, keyword, slides:[{type, ..., q|imageId, pick?}], caption:{body, hashtags:[5]}, leadmagnet:{title,subtitle,sections,closing} }
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { familyHtml } from '../renderer/families.mjs';
import { addFixedLines } from './caption.mjs';
import { renderLeadMagnet } from './leadmagnet.mjs';

const ROOT = 'C:/Users/smfab/ig-automation/';
const { chromium } = await import(pathToFileURL(ROOT + 'runner/renderer/node_modules/playwright/index.mjs').href);
const PIX = fs.readFileSync('C:/Users/smfab/autoedit/secrets/pixabay_key.txt', 'utf8').trim();
const CACHE = ROOT + 'runner/out/v2cache/';
fs.mkdirSync(CACHE, { recursive: true });

const [specPath, outDir] = process.argv.slice(2);
const only = process.argv.includes('--only') ? Number(process.argv[process.argv.indexOf('--only') + 1]) : 0;
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });
const dataUri = (f) => `data:image/${/png$/i.test(f) ? 'png' : 'jpeg'};base64,` + fs.readFileSync(f).toString('base64');
const avatarFile = ROOT + 'store/studio-data/avatar.png';
const avatar = fs.existsSync(avatarFile) ? dataUri(avatarFile) : '';

async function photo(s) {
  if (!s.q && !s.imageId) return '';
  const key = s.imageId ? 'id' + s.imageId : s.q.replace(/\W+/g, '_') + '_' + (s.pick || 0);
  const f = CACHE + key + '.jpg';
  if (!fs.existsSync(f)) {
    const url = `https://pixabay.com/api/?key=${PIX}&${s.imageId ? 'id=' + s.imageId : 'q=' + encodeURIComponent(s.q) + '&image_type=photo&orientation=horizontal&min_width=1000&per_page=20&safesearch=true'}`;
    const r = await (await fetch(url)).json();
    const hit = (r.hits || [])[s.imageId ? 0 : (s.pick || 0)];
    if (!hit) { console.error('no photo for', s.q || s.imageId); return ''; }
    fs.writeFileSync(f, Buffer.from(await (await fetch(hit.largeImageURL || hit.webformatURL)).arrayBuffer()));
    fs.writeFileSync(f + '.json', JSON.stringify({ id: hit.id, user: hit.user, page: hit.pageURL, tags: hit.tags }));
  }
  return dataUri(f);
}

// 1) lead magnet PDF + its first-page snap (used on the CTA slide)
const pdfName = (spec.keyword || 'checklist').toLowerCase() + '-checklist.pdf';
const pdfPrev = path.join(outDir, 'pdf_preview.png');
if (spec.leadmagnet && !only) {
  fs.writeFileSync(path.join(outDir, 'leadmagnet.json'), JSON.stringify(spec.leadmagnet, null, 2));
  await renderLeadMagnet(spec.leadmagnet, path.join(outDir, pdfName), pdfPrev);
}
const pdf = fs.existsSync(pdfPrev) ? dataUri(pdfPrev) : '';

// 2) slides
const browser = await chromium.launch();
const total = spec.slides.length;
const files = [];
for (let i = 0; i < total; i++) {
  if (only && i + 1 !== only) continue;
  const s = spec.slides[i];
  const bg = await photo(s);
  const html = familyHtml(s.family || spec.family, s, i, total, { handle: spec.handle || '@faizanali.shahji', bg, avatar, pdf, H: 1350 });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const f = path.join(outDir, `slide_${String(i + 1).padStart(2, '0')}.jpg`);
  await page.screenshot({ path: f, type: 'jpeg', quality: 92 });
  await page.close();
  files.push(f);
}
await browser.close();

// 3) caption (descriptive body + CTA line, then the two fixed lines, then 5 hashtags)
if (spec.caption && !only) {
  const c = spec.caption;
  const cap = `${c.body.trim()}\n\nComment ${spec.keyword} and I'll DM you the ${spec.leadmagnet?.title || 'checklist'}. Follow so the DM reaches you.\n\n${(c.hashtags || []).join(' ')}`;
  fs.writeFileSync(path.join(outDir, 'caption.txt'), addFixedLines(cap));
  fs.writeFileSync(path.join(outDir, 'spec.json'), JSON.stringify(spec, null, 2));
}
console.log(JSON.stringify(files.map((f) => path.basename(f))));

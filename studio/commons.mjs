// Licensed photos of public figures from Wikimedia Commons (Pixabay has none).
// Only files with a licence that allows commercial reuse are returned: Public domain, CC0, GODL-India, CC BY, CC BY-SA.
// Files with a Restrictions flag (e.g. "personality") are skipped. Every hit carries the credit line that must go in the caption.
import fs from 'node:fs';
import path from 'node:path';

const OK = /^(public domain|cc0|godl-india|cc by( |-)?(sa )?[0-9.]*)$/i;
const UA = { 'User-Agent': 'ig-studio/1.0 (owner: Faizan Ali Shahji)' };
const strip = (h) => String(h || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

export async function searchCommons(name, { minWidth = 1000 } = {}) {
  const u = new URL('https://commons.wikimedia.org/w/api.php');
  const q = { action: 'query', generator: 'search', gsrsearch: `${name} filetype:bitmap`, gsrnamespace: '6', gsrlimit: '30', prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiextmetadatafilter: 'LicenseShortName|Artist|Restrictions', format: 'json' };
  for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v);
  let j; // Commons answers 'too many requests' as plain text: pace the calls and retry
  for (let t = 0; t < 4 && !j; t++) { await new Promise((r) => setTimeout(r, 1500 * (t + 1))); try { j = JSON.parse(await (await fetch(u, { headers: UA })).text()); } catch { j = null; } }
  if (!j) throw new Error('Wikimedia Commons is rate-limiting; try again in a minute');
  const hits = [];
  for (const p of Object.values(j.query?.pages || {})) {
    const i = p.imageinfo?.[0]; if (!i) continue;
    const m = i.extmetadata || {}; const lic = strip(m.LicenseShortName?.value);
    if (!OK.test(lic) || strip(m.Restrictions?.value) || i.width < minWidth) continue;
    hits.push({ title: p.title, url: i.url, width: i.width, height: i.height, license: lic, author: strip(m.Artist?.value).slice(0, 80) || 'Government of India', page: 'https://commons.wikimedia.org/wiki/' + encodeURIComponent(p.title.replace(/ /g, '_')) });
  }
  return hits.sort((a, b) => (b.width * b.height) - (a.width * a.height));
}

// downloads hit #pick of the search into cacheDir; returns { file, credit }
export async function fetchCommons(name, pick, cacheDir) {
  const key = name.replace(/\W+/g, '_') + '_' + pick; const f = path.join(cacheDir, 'commons_' + key + '.jpg');
  const meta = f + '.json';
  if (!fs.existsSync(f)) {
    const h = (await searchCommons(name))[pick]; if (!h) throw new Error('no licensed photo for ' + name + ' #' + pick);
    const thumb = h.url.replace('/commons/', '/commons/thumb/') + '/1600px-' + h.title.replace(/^File:/, '').replace(/ /g, '_'); // 1600px is plenty for a 1080 slide
    let r = await fetch(thumb, { headers: UA }); if (!r.ok) r = await fetch(h.url, { headers: UA });
    fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); fs.writeFileSync(meta, JSON.stringify(h));
  }
  const h = JSON.parse(fs.readFileSync(meta, 'utf8'));
  return { file: f, credit: `Photo: ${h.author}, ${h.license}, via Wikimedia Commons` };
}

// exact file by title ("File:Official portrait of ....jpg"): used by v2 specs ({ commonsFile }) so the owner picks the photo from the contact sheet
export async function fetchCommonsFile(title, cacheDir) {
  const t = title.startsWith('File:') ? title : 'File:' + title;
  const f = path.join(cacheDir, 'commonsf_' + t.replace(/\W+/g, '_').slice(0, 90) + '.jpg'); const meta = f + '.json';
  if (!fs.existsSync(f)) {
    const u = new URL('https://commons.wikimedia.org/w/api.php');
    for (const [k, v] of Object.entries({ action: 'query', titles: t, prop: 'imageinfo', iiprop: 'url|extmetadata', iiextmetadatafilter: 'LicenseShortName|Artist|Restrictions', format: 'json' })) u.searchParams.set(k, v);
    let j; for (let a = 0; a < 4 && !j; a++) { await new Promise((r) => setTimeout(r, 1500 * (a + 1))); try { j = JSON.parse(await (await fetch(u, { headers: UA })).text()); } catch { j = null; } }
    const i = Object.values(j?.query?.pages || {})[0]?.imageinfo?.[0]; if (!i) throw new Error('file not found on Commons: ' + t);
    const m = i.extmetadata || {}; const lic = strip(m.LicenseShortName?.value);
    if (!OK.test(lic) || strip(m.Restrictions?.value)) throw new Error('licence not allowed for reuse: ' + t + ' (' + lic + ' ' + strip(m.Restrictions?.value) + ')');
    const r = await fetch('https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(t.replace(/^File:/, '')) + '?width=1600', { headers: UA });
    fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
    fs.writeFileSync(meta, JSON.stringify({ title: t, license: lic, author: strip(m.Artist?.value).slice(0, 80) || 'Government of India' }));
  }
  const h = JSON.parse(fs.readFileSync(meta, 'utf8'));
  return { file: f, credit: `Photo: ${h.author}, ${h.license}, via Wikimedia Commons` };
}

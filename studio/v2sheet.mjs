// usage: node studio/v2sheet.mjs <dir> [out.png] [perRow=4]  -> contact sheet of slide_*.jpg
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [dir, out = path.join(dir, '_sheet.png'), per = '4'] = process.argv.slice(2);
const { chromium } = await import(pathToFileURL('C:/Users/smfab/ig-automation/runner/renderer/node_modules/playwright/index.mjs').href);
const files = fs.readdirSync(dir).filter((f) => /^slide_\d+\.jpg$/.test(f)).sort();
const w = Math.floor(1560 / Number(per)) - 6;
const html = `<body style="margin:0;background:#333;width:1560px"><div style="display:flex;flex-wrap:wrap;gap:6px">${files.map((f) => `<div style="position:relative"><img src="data:image/jpeg;base64,${fs.readFileSync(path.join(dir, f)).toString('base64')}" style="width:${w}px;display:block"><b style="position:absolute;left:4px;top:4px;background:#c00;color:#fff;font:bold 16px Arial;padding:2px 6px">${f.slice(6, 8)}</b></div>`).join('')}</div></body>`;
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1560, height: 600 } });
await p.setContent(html); await p.screenshot({ path: out, fullPage: true }); await b.close();
console.log(out);

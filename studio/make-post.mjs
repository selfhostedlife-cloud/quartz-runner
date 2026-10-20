// Runs the full content chain for one post: plan -> write -> fact-check -> render slides -> lead magnet PDF.
// Usage: node make-post.mjs [--topic "..."]   (no topic = Strategist picks 1)
import fs from 'node:fs';
import { addFixedLines, stripFixedLines } from './caption.mjs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { planDay, writeCarousel, factCheck, writeLeadMagnet, slugify } from './agents.mjs';
import { renderLeadMagnet } from './leadmagnet.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const stateFile = path.join(here, 'data', 'state.json');
const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : { posts: [], playbook: {} };
const save = () => fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));

const topicArg = process.argv.includes('--topic') ? process.argv[process.argv.indexOf('--topic') + 1] : null;
const log = (...a) => console.error('[studio]', ...a);

log('Strategist...');
let plan;
if (topicArg) plan = { topic: topicArg, angle: 'story', hook_idea: '', leadmagnet_keyword: 'GUIDE', leadmagnet_title: topicArg + ' Checklist' };
else plan = (await planDay({ count: 1, playbook: state.playbook, recentTopics: state.posts.map((p) => p.topic) })).plans[0];
log('Topic:', plan.topic);

log('Copywriter...');
let post = await writeCarousel(plan);

log('Fact-checker...');
let fc = await factCheck(post.claims);
if (!fc.ok && !fc.unverified) {
  log('Fact-check flagged issues; asking Copywriter to fix:\n' + fc.issues.join('\n'));
  post = await writeCarousel({ ...plan, fix_these_issues: fc.issues });
  fc = await factCheck(post.claims);
}

const id = new Date().toISOString().slice(0, 10) + '-' + slugify(plan.topic);
const outDir = path.join(root, 'out', 'posts', id);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'spec.json'), JSON.stringify({ handle: '@faizanali.shahji', slides: post.slides }, null, 2));
fs.writeFileSync(path.join(outDir, 'caption.txt'), addFixedLines(post.caption + '\n\n' + (post.hashtags || []).join(' ')));
fs.writeFileSync(path.join(outDir, 'factcheck.txt'), fc.raw || '');

log('Designer (images + slides)...', post.slides.length, 'slides');
const r = spawnSync(process.execPath, [path.join(root, 'renderer', 'render.mjs'), path.join(outDir, 'spec.json'), outDir], { encoding: 'utf8' });
if (r.status !== 0) { console.error(r.stderr); process.exit(1); }

log('Lead magnet PDF...');
const lm = await writeLeadMagnet(plan, post);
const pdf = path.join(outDir, `${slugify(plan.leadmagnet_title)}.pdf`);
await renderLeadMagnet(lm, pdf);

state.posts.push({ id, topic: plan.topic, angle: plan.angle, keyword: plan.leadmagnet_keyword, leadmagnet: path.basename(pdf), slides: post.slides.length, status: 'awaiting_approval', factcheck_ok: fc.ok, created: new Date().toISOString() });
save();
console.log(JSON.stringify({ id, outDir, slides: JSON.parse(r.stdout), caption: post.caption, keyword: plan.leadmagnet_keyword, leadmagnet: pdf, factcheck_ok: fc.ok, factcheck_unverified: !!fc.unverified }, null, 2));

const ROOT = process.env.IG_ROOT || 'C:/Users/smfab/ig-automation';
// Feeder: moves approved posts from the bank into Buffer whenever slots are free (free plan = 10 scheduled posts PER CHANNEL, verified 2026-10-07).
// For each approved post: publish slide JPEGs to the public ig-media repo (Buffer fetches URLs, does not re-host),
// createPost on BOTH Instagram channels at each account's next free peak slot (data-driven, see slots.mjs), attach trending music, record it in state.
// Also removes a post's images from the repo once Buffer has published it on every channel.
// Exports: feed(state, save, {dryRun, notify}), cleanupMedia(state).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { predict } from './features.mjs';
import { stripFixedLines } from './caption.mjs';

// Learning loop: a post is only put into Buffer when its slot is at most LOOKAHEAD_H hours away, so the choice (which approved post goes next)
// always uses the newest results; the bank is ranked by the learned model, not first-in-first-out.
const LOOKAHEAD_H = 48;

const KEY = fs.readFileSync((ROOT + '/.env'), 'utf8').match(/^BUFFER_API_KEY=(.*)$/m)[1].trim();
const ORG = '5ab46e7a0b3b3a6f31ae27a4';
const LIMIT = 10;
const CH = { test: { id: '6ac275fa6a5c39ccb6114033', account: 'test @exportimportwithfaizan' }, main: { id: '6ac3579d6a5c39ccb61c8bad', account: 'main @faizanali.shahji' } };
const REPO = 'selfhostedlife-cloud/ig-media';
const WORK = (process.env.IG_MEDIA_WORK || 'C:/Users/smfab/ig-media-work/ig-media');
const RAW = `https://raw.githubusercontent.com/${REPO}/main`;
const dataDir = (ROOT + '/studio/data');
const COOL = (ROOT + '/studio/data/buffer-cooldown.json'); // after a RATE_LIMIT error, stay away from Buffer's API for 3 hours
const gql = async (query, variables) => {
  try { const until = JSON.parse(fs.readFileSync(COOL, 'utf8')).until; if (until > Date.now()) return { errors: [{ message: 'buffer cooldown active (rate limit) until ' + new Date(until).toISOString() }] }; } catch { /* no cooldown */ }
  const j = await (await fetch('https://api.buffer.com', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` }, body: JSON.stringify({ query, variables }) })).json();
  if (JSON.stringify(j.errors || '').includes('RATE_LIMIT')) fs.writeFileSync(COOL, JSON.stringify({ until: Date.now() + 3 * 3600e3, at: new Date().toISOString() }));
  return j;
};
const log = (...a) => console.error('[feeder]', ...a);
const git = (...args) => { const r = spawnSync('git', args, { cwd: WORK, encoding: 'utf8' }); if (r.status !== 0) throw new Error('git ' + args.join(' ') + ': ' + (r.stderr || r.stdout).slice(0, 300)); return r.stdout; };
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8')); } catch { return d; } };

function ensureClone() {
  if (!fs.existsSync(path.join(WORK, '.git'))) {
    fs.mkdirSync(path.dirname(WORK), { recursive: true });
    const r = process.env.IG_MEDIA_REMOTE ? spawnSync('git', ['clone', '--depth', '1', process.env.IG_MEDIA_REMOTE, WORK], { encoding: 'utf8' }) : spawnSync('gh', ['repo', 'clone', REPO, WORK], { encoding: 'utf8' }); // cloud: ssh deploy key remote
    if (r.status !== 0) throw new Error('clone failed: ' + r.stderr.slice(0, 300));
  }
  git('pull', '--rebase', '--quiet');
}

async function queue() {
  const r = await gql(`query($i: PostsInput!){ posts(first: 50, input:$i){ edges { node { id status dueAt channelId } } } }`,
    { i: { organizationId: ORG, filter: { status: ['scheduled', 'draft', 'needs_approval'] } } });
  if (r.errors) throw new Error('Buffer: ' + JSON.stringify(r.errors).slice(0, 200));
  return r.data.posts.edges.map((e) => e.node);
}

// Weekly pacing (owner rule): max 10 feed posts per account per IST week (Mon-Sun), spread evenly.
// Slot times come from the timing agent (slots.mjs -> data/slot-model.json): each ACCOUNT gets its own best hour per weekday from its own results
// (one slot every day, a second slot on up to 3 days where the backup hour is still above normal). Fallback = the old fixed slots.
const WEEKLY_CAP = 10;
const FALLBACK_SLOTS = { 1: ['12:30', '19:00'], 2: ['19:00'], 3: ['12:30', '19:00'], 4: ['19:00'], 5: ['12:30', '19:00'], 6: ['19:00'], 0: ['19:00'] }; // 0 = Sunday
function daySlotsFor(name) { const m = readJson('slot-model.json', null)?.accounts?.[name]?.slots; return m && Object.keys(m).length === 7 ? m : FALLBACK_SLOTS; }
const istParts = (d) => { const t = new Date(d.getTime() + 5.5 * 3600e3); return { day: t.toISOString().slice(0, 10), dow: t.getUTCDay() }; };
function weekKey(d) { const t = new Date(d.getTime() + 5.5 * 3600e3); const back = (t.getUTCDay() + 6) % 7; return new Date(t.getTime() - back * 864e5).toISOString().slice(0, 10); } // Monday of that IST week
// posts already counted for a channel in a week: Buffer queue + studio state (sent ones and manually scheduled ones), de-duplicated by time
function weekCount(state, q, channelId, d) {
  const wk = weekKey(d); const seen = new Set();
  for (const x of q) if (x.channelId === channelId && x.dueAt && weekKey(new Date(x.dueAt)) === wk) seen.add(new Date(x.dueAt).toISOString());
  for (const p of state?.posts || []) {
    for (const e of p.buffer || []) if (e.channelId === channelId && e.dueAt && weekKey(new Date(e.dueAt)) === wk) seen.add(new Date(e.dueAt).toISOString());
    if (p.manualBuffer && p.dueAt && weekKey(new Date(p.dueAt)) === wk) seen.add(new Date(p.dueAt).toISOString());
  }
  return seen.size;
}
// next allowed slot strictly after `after` (and >= 45 min from now) that is free and keeps the week under the cap
function nextSlotAfter(after, taken, countInWeek, DAY_SLOTS = FALLBACK_SLOTS) {
  const min = Math.max(after.getTime(), Date.now() + 45 * 60e3);
  const planned = {};
  for (let d = 0; d < 90; d++) {
    const { day, dow } = istParts(new Date(Date.now() + d * 864e5));
    for (const slot of DAY_SLOTS[dow]) {
      const t = new Date(`${day}T${slot}:00+05:30`);
      if (t.getTime() <= min || taken.has(t.toISOString())) continue;
      const wk = weekKey(t);
      if (countInWeek(t) + (planned[wk] || 0) >= WEEKLY_CAP) continue;
      return t;
    }
  }
}

async function pickMusic(channelId, usedIds) {
  const r = await gql(`query($i: TrendingInstagramAudioInput!){ trendingInstagramAudio(input:$i){ __typename ... on SearchInstagramAudioSuccess { audio { id title displayArtist } } ... on ChannelRefreshRequired { message } } }`, { i: { audioType: 'music', channelId } });
  const p = r.data?.trendingInstagramAudio;
  if (p?.__typename !== 'SearchInstagramAudioSuccess' || !p.audio?.length) return null;
  return p.audio.find((a) => !usedIds.includes(a.id)) || p.audio[0];
}

async function waitRaw(url, tries = 20) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url, { method: 'HEAD' }); if (r.ok) return true; } catch { /* retry */ }
    await new Promise((res) => setTimeout(res, 3000));
  }
  return false;
}

function publishImages(post) {
  ensureClone();
  const token = post.mediaToken || crypto.randomBytes(9).toString('hex');
  const dest = path.join(WORK, token);
  fs.mkdirSync(dest, { recursive: true });
  const slides = fs.readdirSync(post.dir).filter((f) => /^slide_\d+\.jpg$/.test(f)).sort();
  if (!slides.length || slides.length > 10) throw new Error(`post #${post.no} has ${slides.length} slides (need 1-10)`);
  for (const f of slides) fs.copyFileSync(path.join(post.dir, f), path.join(dest, f));
  git('add', token);
  git('-c', 'user.name=bot', '-c', 'user.email=bot@users.noreply.github.com', 'commit', '-m', `media ${token}`, '--quiet');
  git('push', '--quiet');
  post.mediaToken = token;
  return slides.map((f) => `${RAW}/${token}/${f}`);
}

export const FB_CHANNEL = '6ac3f1266a5c39ccb62363a4'; // Buffer channel: Facebook page "Faizan Ali Shahji"
// Facebook lane: the approved post goes to the Facebook page as a multi-photo post with its OWN caption (caption_fb.txt), 60 minutes after the main Instagram slot.
// Never blocks Instagram: any failure is recorded on the post (fbError) and reported to the Facebook bot.
async function feedFacebook(post, urls, mainDue, notifyFb) {
  if (post.fb?.bufferId) return;
  let text = '';
  try { text = fs.readFileSync(path.join(post.dir, 'caption_fb.txt'), 'utf8').trim(); } catch { /* fall back below */ }
  if (!text) text = stripFixedLines(fs.readFileSync(path.join(post.dir, 'caption.txt'), 'utf8')).replace(/(\s*#\w+)+\s*$/, '').trim(); // the BIO/Impexq lines are Instagram-only
  const due = new Date(Math.max(new Date(mainDue).getTime() + 60 * 60e3, Date.now() + 15 * 60e3));
  const mut = `mutation($i: CreatePostInput!){ createPost(input:$i){ __typename ... on PostActionSuccess { post { id dueAt } } ... on InvalidInputError { message } ... on UnexpectedError { message } ... on LimitReachedError { message } } }`;
  const res = (await gql(mut, { i: { channelId: FB_CHANNEL, text, assets: urls.map((u) => ({ image: { url: u } })), mode: 'customScheduled', dueAt: due.toISOString(), schedulingType: 'automatic', saveToDraft: false, needsApproval: false, source: 'n8n-studio', metadata: { facebook: { type: 'post' } } } })).data?.createPost;
  if (res?.__typename !== 'PostActionSuccess') { post.fbError = res?.message || res?.__typename || 'no answer'; log('facebook createPost failed:', post.fbError); await notifyFb('Facebook post for #' + post.no + ' was NOT queued: ' + post.fbError); return; }
  post.fb = { channelId: FB_CHANNEL, bufferId: res.post.id, dueAt: res.post.dueAt }; delete post.fbError;
  const ist = new Date(res.post.dueAt).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  await notifyFb('Queued on Facebook: #' + post.no + ' "' + post.topic + '"\nGoes live ' + ist + ' IST on the page Faizan Ali Shahji (' + urls.length + ' photos).\n\nCAPTION:\n' + text.slice(0, 1500));
}

export async function feed(state, save, { dryRun = false, notify = async () => {}, notifyFb = async () => {} } = {}) {
  const done = [];
  const ready = state.posts.filter((p) => p.status === 'approved' && !(p.buffer || []).length)
    .map((p) => { const pr = predict(p); p.predicted = +pr.score.toFixed(2); p.predictBasis = pr.basis.map((b) => `${b.k}(${b.shrunk}x,n${b.n})`); return p; })
    .sort((a, b) => (b.boost ? 1 : 0) - (a.boost ? 1 : 0) || b.predicted - a.predicted || a.no - b.no); // reference posts (boost) go first
  if (!ready.length) return { fed: done, note: 'bank empty', ready: 0 };
  let q = await queue();
  const music = readJson('music-used.json', []);
  for (const post of ready) {
    if (Object.values(CH).some((c) => q.filter((x) => x.channelId === c.id).length >= LIMIT)) { log('a channel queue is full (limit ' + LIMIT + ' per channel)'); break; }
    const caption = fs.readFileSync(path.join(post.dir, 'caption.txt'), 'utf8').trim();
    const plan = {};
    for (const [name, ch] of Object.entries(CH)) {
      const dues = q.filter((x) => x.channelId === ch.id).map((x) => new Date(x.dueAt));
      const taken = new Set(q.filter((x) => x.channelId === ch.id).map((x) => new Date(x.dueAt).toISOString()));
      const latest = dues.length ? new Date(Math.max(...dues)) : new Date(0);
      plan[name] = nextSlotAfter(latest, taken, (t) => weekCount(state, q, ch.id, t), daySlotsFor(name));
    }
    const farthest = Math.max(...Object.values(plan).map((d) => (d ? d.getTime() : Infinity)));
    if (farthest > Date.now() + LOOKAHEAD_H * 3600e3) {
      log(`next slot is more than ${LOOKAHEAD_H}h away - holding the bank so the newest learnings choose the next post`);
      return { fed: done, ready: ready.length, queued: q.length, note: `holding: next slot beyond ${LOOKAHEAD_H}h lookahead`, ranking: ready.map((p) => ({ no: p.no, predicted: p.predicted, basis: p.predictBasis })) };
    }
    if (dryRun) { done.push({ no: post.no, predicted: post.predicted, basis: post.predictBasis, would: Object.fromEntries(Object.entries(plan).map(([k, v]) => [k, v.toISOString()])) }); q = [...q, { channelId: CH.test.id, dueAt: plan.test }, { channelId: CH.main.id, dueAt: plan.main }]; continue; }
    const urls = publishImages(post); save();
    if (!(await waitRaw(urls[urls.length - 1]))) throw new Error('image URL not reachable: ' + urls[urls.length - 1]);
    post.buffer = []; post.musicUsed = {};
    for (const [name, ch] of Object.entries(CH)) {
      const track = await pickMusic(ch.id, music);
      const mk = (withMusic) => ({ channelId: ch.id, text: caption, assets: urls.map((u) => ({ image: { url: u } })), mode: 'customScheduled', dueAt: plan[name].toISOString(), schedulingType: 'automatic', saveToDraft: false, needsApproval: false, source: 'n8n-studio',
        metadata: { instagram: { type: 'post', shouldShareToFeed: true, ...(withMusic && track ? { stickerFields: { music: track.id } } : {}) } } });
      const mut = `mutation($i: CreatePostInput!){ createPost(input:$i){ __typename ... on PostActionSuccess { post { id dueAt } } ... on InvalidInputError { message } ... on UnexpectedError { message } ... on LimitReachedError { message } } }`;
      let res = (await gql(mut, { i: mk(true) })).data?.createPost;
      let withMusic = !!track;
      if (res?.__typename !== 'PostActionSuccess' && track) { log('music rejected, retrying without:', res?.message); res = (await gql(mut, { i: mk(false) })).data?.createPost; withMusic = false; }
      if (res?.__typename !== 'PostActionSuccess') { log(`createPost failed on ${name}:`, res?.__typename, res?.message); post.feedError = `${name}: ${res?.message || res?.__typename}`; save(); break; }
      post.buffer.push({ channelId: ch.id, account: ch.account, bufferId: res.post.id, dueAt: res.post.dueAt });
      if (withMusic) { post.musicUsed[name] = `${track.title} - ${track.displayArtist || '?'}`; music.push(track.id); }
      q.push({ channelId: ch.id, dueAt: res.post.dueAt, id: res.post.id });
    }
    if (post.buffer.length) {
      const dues = post.buffer.map((e) => e.dueAt).sort();
      post.status = 'scheduled'; post.dueAt = dues[0]; delete post.feedError;
      fs.writeFileSync(path.join(dataDir, 'music-used.json'), JSON.stringify(music.slice(-60)));
      save();
      const ist = (d) => new Date(d).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
      for (const [name, ch] of Object.entries(CH)) {
        const e = post.buffer.find((x) => x.channelId === ch.id); if (!e) continue;
        await notify(`Queued #${post.no} "${post.topic}"
Goes live ${ist(e.dueAt)} IST on ${ch.account}.
Chosen from ${ready.length} approved (model predicts ${post.predicted}x your normal: ${(post.predictBasis || []).slice(0, 3).join(', ') || 'no data yet'}).
Music to add after it is live: ${post.musicUsed?.[name] || 'pick a trending instrumental'}
Buffer slots used: ${q.filter((x) => x.channelId === ch.id).length}/${LIMIT}`, name);
      }
      try { await feedFacebook(post, urls, post.dueAt, notifyFb); save(); } catch (e) { post.fbError = e.message; log('facebook lane error:', e.message); }
      done.push({ no: post.no, buffer: post.buffer, fb: post.fb?.dueAt || null });
    }
  }
  return { fed: done, ready: ready.length, queued: q.length };
}

// delete images of posts Buffer has published on every channel (keeps the public repo small and clean)
export async function cleanupMedia(state, save) {
  const r = await gql(`query($i: PostsInput!){ posts(first: 50, input:$i){ edges { node { id status } } } }`, { i: { organizationId: ORG, filter: { status: ['sent'] } } });
  if (r.errors) return { removed: 0, error: JSON.stringify(r.errors).slice(0, 120) };
  const sent = new Set(r.data.posts.edges.map((e) => e.node.id));
  const todo = state.posts.filter((p) => p.mediaToken && !p.mediaRemoved && (p.buffer || []).length && p.buffer.every((e) => sent.has(e.bufferId)));
  if (!todo.length) return { removed: 0 };
  ensureClone();
  for (const p of todo) { git('rm', '-r', '-q', '--ignore-unmatch', p.mediaToken); p.mediaRemoved = true; }
  git('-c', 'user.name=bot', '-c', 'user.email=bot@users.noreply.github.com', 'commit', '-m', 'remove published media', '--quiet');
  git('push', '--quiet');
  save();
  return { removed: todo.length };
}
export { nextSlotAfter, weekCount, weekKey };

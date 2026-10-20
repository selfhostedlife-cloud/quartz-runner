// Minimal Telegram Bot API helper (tokens from ig-automation/.env, never logged).
// makeBot(token) gives an independent bot API; the default exports are the MAIN bot (TELEGRAM_BOT_TOKEN) so older modules keep working.
// A second bot (TELEGRAM_BOT_TOKEN_TEST) serves the test account; see server.mjs for routing.
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
if (fs.existsSync(path.join(root, '.env'))) {
  for (const line of fs.readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}

// Retries transient network failures (this PC's route to api.telegram.org drops now and then).
async function tfetch(url, opts = {}, tries = 5) {
  let last;
  for (let a = 1; a <= tries; a++) {
    try { return await fetch(url, { ...opts, signal: AbortSignal.timeout(opts.longPoll ? 45000 : 30000) }); }
    catch (e) { last = e; await new Promise((r) => setTimeout(r, 1500 * a)); }
  }
  throw last;
}

export function makeBot(TOKEN) {
  const base = () => `https://api.telegram.org/bot${TOKEN}`;
  async function call(method, body) {
    const r = await tfetch(`${base()}/${method}`, { longPoll: method === 'getUpdates', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!j.ok) throw new Error(`Telegram ${method}: ${j.description || r.status}`);
    return j.result;
  }
  const upload = async (method, fd) => {
    const r = await tfetch(`${base()}/${method}`, { method: 'POST', body: fd });
    const j = await r.json();
    if (!j.ok) throw new Error(`Telegram ${method}: ${j.description || r.status}`);
    return j.result;
  };
  const mime = (f) => (/\.png$/i.test(f) ? 'image/png' : 'image/jpeg');
  return {
    hasToken: () => !!TOKEN,
    setCommands: (commands) => call('setMyCommands', { commands }),
    sendMessage: (chat_id, text, extra = {}) => call('sendMessage', { chat_id, text: String(text).slice(0, 4000), disable_web_page_preview: true, ...extra }),
    answerCallback: (id, text = '') => call('answerCallbackQuery', { callback_query_id: id, text: text.slice(0, 190) }),
    editMarkup: (chat_id, message_id, reply_markup) => call('editMessageReplyMarkup', { chat_id, message_id, reply_markup }).catch(() => null),
    getUpdates: (offset, timeout = 25) => call('getUpdates', { offset, timeout, allowed_updates: ['message', 'callback_query'] }),
    // Sends 2-10 local images as one album; caption goes on the first image.
    sendAlbum(chat_id, files, caption = '') {
      const fd = new FormData();
      fd.append('chat_id', String(chat_id));
      fd.append('media', JSON.stringify(files.map((f, i) => ({ type: 'photo', media: `attach://p${i}`, ...(i === 0 && caption ? { caption: caption.slice(0, 1000) } : {}) }))));
      files.forEach((f, i) => fd.append(`p${i}`, new Blob([fs.readFileSync(f)], { type: mime(f) }), path.basename(f)));
      return upload('sendMediaGroup', fd);
    },
    sendPhoto(chat_id, file, caption = '', reply_markup) {
      const fd = new FormData();
      fd.append('chat_id', String(chat_id));
      if (caption) fd.append('caption', caption.slice(0, 1000));
      if (reply_markup) fd.append('reply_markup', JSON.stringify(reply_markup));
      fd.append('photo', new Blob([fs.readFileSync(file)], { type: mime(file) }), path.basename(file));
      return upload('sendPhoto', fd);
    },
    sendDocument(chat_id, file, caption = '') {
      const fd = new FormData();
      fd.append('chat_id', String(chat_id));
      if (caption) fd.append('caption', caption.slice(0, 1000));
      fd.append('document', new Blob([fs.readFileSync(file)]), path.basename(file));
      return upload('sendDocument', fd);
    },
    // Download a file a user sent (photo/document) by file_id -> local path.
    async downloadFile(file_id, dest) {
      const info = await call('getFile', { file_id });
      const r = await tfetch(`https://api.telegram.org/file/bot${TOKEN}/${info.file_path}`);
      if (!r.ok) throw new Error('Telegram file download failed: ' + r.status);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
      return dest;
    },
  };
}

export const mainBot = makeBot(process.env.TELEGRAM_BOT_TOKEN);
export const testBot = makeBot(process.env.TELEGRAM_BOT_TOKEN_TEST);
export const fbBot = makeBot(process.env.TELEGRAM_BOT_TOKEN_FB); // Facebook page "Faizan Ali Shahji": its captions, queue and go-live alerts
export const { hasToken, sendMessage, answerCallback, editMarkup, getUpdates, sendAlbum, sendPhoto, sendDocument, downloadFile } = mainBot;

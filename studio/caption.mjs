// Fixed closing lines of every Instagram caption (owner, 2026-10-21): descriptive body -> CTA line -> these two lines -> hashtags.
// addFixedLines() is idempotent; stripFixedLines() removes them again so a writer (restyle) never sees or rewrites them.
export const FIXED_LINES = [
  '>>>If you have any doubts or want my personal guidance on any topic in the export business, then you can book a 1-1 consultancy session with me. The link is in my BIO Section',
  '>>>For buyer data, check out Impexq.com',
];

const isTag = (l) => /^\s*#\w/.test(l);

export function stripFixedLines(text) {
  return String(text || '').split('\n').filter((l) => !FIXED_LINES.includes(l.trim())).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function addFixedLines(text) {
  const clean = stripFixedLines(text);
  const lines = clean.split('\n');
  let i = lines.length; while (i > 0 && (isTag(lines[i - 1]) || lines[i - 1].trim() === '')) i--; // trailing hashtag block (and blank lines before it)
  const body = lines.slice(0, i).join('\n').trim();
  const tags = lines.slice(i).filter((l) => l.trim()).join('\n').trim();
  return [body, FIXED_LINES.join('\n\n'), tags].filter(Boolean).join('\n\n') + '\n';
}

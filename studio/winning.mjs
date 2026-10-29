import fs from 'node:fs';
// The owner's WINNING FORMULA (2026-10-20), reverse-engineered from his own posts:
//   WINNERS  Copper scrap guide (80 lakh+ views, 300+ followers), "Rs 1 lakh export order" (15K+ twice, 50-100 followers),
//            onion loss post (14K views, 365 comments), "How to import copper scrap" caption (641 likes, 255 comments)
//   LOSERS   govt-schemes list, "5 export documents" list, "why target Japan" text wall, generic "how to find buyers" (2-3K views, 0 followers)
// WINNING_FORMULA goes into every writing prompt; chooseTemplate() picks the slide template (renderer/winner.mjs).
import { directivesBlock } from './rules.mjs';

export const TEMPLATES = {
  guide: 'END-TO-END COMMODITY GUIDE ("How to import/export X in India"): framed real photo of the literal product on pure black, big white QUESTION headings, 2-3 specific points each, save+share footer on every slide',
  math: 'MONEY MATH ("Rs 1 lakh order, how much do you actually make"): cinematic photo fading to black, giant uppercase headline with gold numbers, ONE cost per slide with a running balance, big reveal, final cost table',
  verdict: 'LOSS / VERDICT ("Loss of Rs X per container: is the Y trade dead?"): giant stacked headline with the loss number, boxed landed-cost vs sale-price numbers, a verdict stamp; content slides use the math layout',
};

export function chooseTemplate(concept = {}) {
  const t = [concept.title, concept.format, concept.pain_point, (concept.slide_outline || []).join(' ')].join(' ').toLowerCase();
  if (/\b(loss|losing|unprofitable|dead\?|verdict|per container)\b/.test(t) && /(rs|₹|aed|usd|\$|lakh|crore)/.test(t)) return 'verdict';
  if (/\b(profit|margin|cost breakdown|how much (do )?you|make|price|pricing|calculat|landed cost|earn)\b/.test(t)) return 'math';
  return 'guide';
}

export const WINNING_FORMULA = `WINNING FORMULA (mandatory; derived from the owner's own best posts - one with 80 lakh+ views and 300+ followers, two 15K+ posts that gained 50-100 followers each - versus his weak posts at 2-3K views and 0 followers):
WHY THE WINNERS WON
1. A specific, high-money, searchable subject. Winners name ONE commodity or ONE number: "How to Import Copper Scrap in India" (container worth Rs 1.25-1.6 crore), "Rs 1 lakh export order: how much do you actually make", "Loss of Rs 2,64,800 per onion container". Losers were generic: "Government schemes every exporter should know", "5 export documents", "Why target the Japanese market".
2. A complete answer people SAVE. The copper post answered the whole journey in order: how to > where to source (named countries) > whom to sell to (named buyer companies and segments) > what a container costs (Rs figure) > which documents are mandatory (numbered list). Reader thinks "I need this later" so saves and shares go up, and follows come because the rest lives on the profile.
3. Money math with suspense. The Rs 1 lakh post removed one cost per slide with a running balance (Rs 1,00,000 - 60,000 = 40,000 left; then packaging/transport/documents = 9,500; then commission/freight...), kept saying "and we are still NOT done", ended on the shock (only Rs 18,000 profit) and a "where did your Rs 1 lakh go" table. The hook is a myth-bust: revenue is not profit. Always label the numbers "illustrative example".
4. Loss or verdict framing. The onion post put a negative Rs figure in the headline, a "VERDICT: UNPROFITABLE" stamp and two boxed numbers (landed cost AED 2.35/kg vs sale AED 1.9/kg). People argue in comments (365) which boosts reach.
5. Real numbers in rupees, named things (countries, buyer companies, certificates such as CPCB/SPCB authorisation, IEC, BoE), never vague advice.
HOW THE WINNING SLIDES LOOK (the renderer does this for you; write copy that fits it)
- Pure black background. ONE hero image of the LITERAL subject (the actual copper wire, the actual onions, a real warehouse/port/exporter), bright and saturated so it pops on black. No abstract stock, no collage, no pastel or beige.
- Huge bold sans-serif headline (70-100 px), white with one or two keywords in a single accent colour (yellow/gold or peach). Maximum two colours. Strong contrast everywhere.
- Short lines, big text: a slide carries 20-35 words at most. One idea per slide.
- Footer on every slide: save+share cue and the follow handle ("Save this post and share it", "Follow>> @faizanali.shahji" / "slide left >>>").
STRUCTURE RULES
- Cover: promise + subject, plain words. Examples: "How to Import Copper Scrap in India / step by step guidelines", "Rs 1 lakh export order? Here is how much you actually make", "Loss of Rs 2,64,800 per onion container: is the trade dead?".
- Guide posts: 6-8 slides; every content slide title is a QUESTION a buyer would type ("Where to source from?", "Whom to sell to in India?", "How much does a container cost?", "Which documents are mandatory?", "What can go wrong?"); body = 2-3 points, each starts with a bold label then a specific fact (named country/company/Rs amount/document).
- Math posts: 6-8 slides; one cost per slide; every slide has a running balance as its big number (stat); second last = the full table; last content slide = the shock number; add the line "Illustrative example - actual numbers depend on product, quantity, destination and Incoterm".
- Verdict posts: cover with the loss number + verdict, then the calculation split into Part 1, Part 2, with the final per-kg comparison.
- Last slide = the offer: comment the keyword for the free PDF, follow, save, share.
WHAT TO AVOID (these are exactly what flopped): lists of acronyms with no money, definitions ("what is X"), text walls, soft low-contrast colours, collage images, motivational lines, no number in the headline, no payoff.`;

export const FB_RULES = `FACEBOOK VERSION (separate caption for the Facebook page "Faizan Ali Shahji"): the audience is older, small traders and business owners, reading on a phone feed. Write 90-170 words of plain, warm, direct English: line 1 = the hook with the Rs number; then 3-5 short lines that tell the same story in words (the exact numbers/answers from the slides, not "see slides"); a line asking a question that is easy to answer in comments ("Have you ever shipped without checking this?"); then "Comment ${'${KEYWORD}'} and I will message you the free guide. Follow the page so it reaches you." No hashtags except at most 3 at the end. No emojis except at most 2. Never claim guaranteed profit. Do not mention duty rates, GST rates, notifications, licences or any government rule that changes often.`;

// block injected into writer prompts
export const GOV_RULE = 'NO-GOVERNMENT-RULE CLAIMS (owner rule, applies to captions AND slides): never state anything that depends on government rules that change often or must be checked before use: customs duty / BCD percentages, GST or IGST rates, HS-code-specific duties, DGFT / RBI / customs notifications or circulars, licence or registration requirements, import policy status (free / restricted / prohibited), scheme benefit rates, deadlines. Write only commercial facts (costs, margins, buyers, logistics, generic document names, risks); where a rule matters say "check the current rules with your CHA or DGFT before shipping".';
export const OWNER_LESSONS = 'OWNER REJECTION LESSONS (standing): (1) the FIRST image must show the product so clearly that it is identifiable at a glance, and slide 1 must carry a number: profit, loss, scarcity or a Rs amount. (2) Fonts must be large and headlines larger, in high-contrast colours that make a viewer stop and read. (3) Mistake/Fix, when allowed at all, must read as a mini story: what the mistake was and what the fixes are, each explained in 1-2 full lines, never a bare label. (4) Reject boring topics: avoid rule-change or notification topics; pick money, loss, buyer and cost stories.';
const recentReasons = () => { try { const fb = JSON.parse(fs.readFileSync(new URL('./data/feedback.json', import.meta.url), 'utf8')); return fb.slice(-5).map((x) => '- ' + x.topic + ': ' + x.reason).join('\n'); } catch { return ''; } };
export const FOLLOWER_MAGNET = 'FOLLOWER MAGNET FORMAT (owner data 2026-10: the posts that earned the most followers on @faizanali.shahji were the Africa top-10 list (47 follows), the free export starter PDF (26) and the 100 product ideas / 18 websites lists, all short 3-4 slide resource posts; the turmeric data map (24) was the outlier among data posts). When the concept fits, use it: a 3-4 slide post = cover with a number or the word FREE + one or two list/checklist slides of 5 short items each (name + two-word tag) + a final slide offering ONE free PDF with the comment keyword. List ideas: top 10 products a country or region buys from India, free tools or portals, free checklists/sheets for a single job. Never claim demand or rules as fact: call lists research starting points.';
export const winningBlock = () => [directivesBlock(), WINNING_FORMULA, FOLLOWER_MAGNET, GOV_RULE, OWNER_LESSONS, recentReasons() && 'RECENT OWNER REJECTION REASONS (do not repeat these mistakes):\n' + recentReasons()].filter(Boolean).join('\n\n');

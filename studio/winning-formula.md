# Winning formula (owner's proven posts, analysed 2026-10-20)

Sources: Copper scrap (80L+ views, 300+ followers), "1 lakh order" (15K+ twice, 50-100 followers), onion loss post (14K, 365 comments). Losers (2-3K, 0 followers): scheme/acronym lists, "5 export documents", text walls, soft beige stock art, no Rs number, no payoff.

## Content
1. ONE named, high-money, searchable commodity ("How to Import Copper Scrap in India").
2. A complete, save-worthy answer in order: how-to > sources > named buyers > container cost > mandatory documents > what can go wrong.
3. Rs money maths with suspense: one cost per slide, running balance, "still NOT done", a shock profit figure, final table, "revenue is not profit".
4. Loss / verdict framing: "Loss of Rs 2,64,800 per container. VERDICT: UNPROFITABLE", two boxed numbers (landed cost vs sale price).
5. Pain: real money at risk, rejections, hidden costs. Never definitions or scheme lists.

## Visuals
Pure black background, one saturated literal hero photo of the actual product (white frame on guide), huge bold sans headline, one or two accent colours (yellow / peach / gold), Save/Follow footer on every slide, question titles, numbered peach-label items.

## Templates (renderer/winner.mjs, spec.template)
- guide: cover "How To ..." + question slides + documents list + CTA
- math: Rs cost-by-cost slides with running balance + final table
- verdict: loss headline + red verdict stamp + boxed numbers

## Pipeline wiring
winning.mjs (formula text, chooseTemplate, FB rules) feeds concepts.mjs, hooks.mjs, make-from-concept.mjs. Daily posts use look `winner-<template>` (no random rotation). Reference posts (`--style`) keep their own look.

## Facebook lane
Buffer channel 6ac3f1266a5c39ccb62363a4 (page "Faizan Ali Shahji"). feeder.mjs `feedFacebook` queues the approved post 60 min after the main IG slot with `caption_fb.txt`. Bot: @FaizanFacebook_bot (TELEGRAM_BOT_TOKEN_FB): /status /caption N /fbedit N text. Owner must press Start once.

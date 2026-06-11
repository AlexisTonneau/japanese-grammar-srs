#!/usr/bin/env node
// Audit generated example sentences for overlap with neighboring grammar
// points in the same chapter. The earlier verifier checks one sentence in
// isolation against its assigned grammar point — it can't see the rest of
// the chapter, so it lets through sentences that are technically valid for
// the assigned point but really belong under a sibling.
//
// This script gives Claude the full chapter grammar list as context and
// asks: "is this sentence the best demonstration of point X, or does it
// actually belong under one of these other points?"
//
// Usage:
//   node scripts/audit-sentences.mjs                          # all chapters
//   node scripts/audit-sentences.mjs --chapters 27,32,39,47   # subset
//   node scripts/audit-sentences.mjs --chapters 27 --json     # raw JSON output
//
// Manual sentences (manual: true) are NEVER audited — those are textbook
// seeds and considered authoritative. Only generated sentences are checked.

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);

function flag(name) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : null;
}
const chaptersArg = flag("chapters") ?? "all";
const model = flag("model") ?? "us.anthropic.claude-sonnet-4-6";
const reportPath = flag("out") ?? join(root, "data", "audit-report.json");
const jsonOnly = args.includes("--json");
const concurrency = Number(flag("concurrency") ?? 4);
// Rate-limit guard: gateway allows ~50 req/min. Default to 45 to leave headroom.
const rpm = Number(flag("rpm") ?? 45);
const minIntervalMs = Math.ceil(60000 / rpm);
let nextSlot = 0;
async function reserveSlot() {
  const now = Date.now();
  const slot = Math.max(now, nextSlot);
  nextSlot = slot + minIntervalMs;
  const wait = slot - now;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

const baseUrl = process.env.ANTHROPIC_BEDROCK_BASE_URL;
const authToken = process.env.ANTHROPIC_AUTH_TOKEN;
if (!baseUrl || !authToken) {
  console.error("Missing ANTHROPIC_BEDROCK_BASE_URL or ANTHROPIC_AUTH_TOKEN env vars.");
  process.exit(1);
}

const dataPath = join(root, "src", "data", "grammarData.ts");
const dataSrc = readFileSync(dataPath, "utf8");
const items = parseGrammarItems(dataSrc);

const targetChapters = chaptersArg === "all" ? "all" : new Set(chaptersArg.split(",").map(Number));
const itemsByChapter = new Map();
for (const item of items) {
  if (targetChapters !== "all" && !targetChapters.has(item.chapter)) continue;
  if (!itemsByChapter.has(item.chapter)) itemsByChapter.set(item.chapter, []);
  itemsByChapter.get(item.chapter).push(item);
}

if (!jsonOnly) {
  const totalItems = [...itemsByChapter.values()].reduce((sum, arr) => sum + arr.length, 0);
  const totalGenerated = [...itemsByChapter.values()]
    .flat()
    .reduce((sum, it) => sum + it.sentences.filter((s) => !s.manual).length, 0);
  console.log(
    `auditing ${totalGenerated} generated sentences across ${totalItems} items in ` +
      `${itemsByChapter.size} chapter${itemsByChapter.size === 1 ? "" : "s"} ` +
      `(model=${model}, concurrency=${concurrency})\n`
  );
}

// One audit job = (item, sentence) where sentence is generated (not manual).
const jobs = [];
for (const [chapter, chapterItems] of itemsByChapter) {
  const chapterGrammarList = chapterItems.map((it) => ({
    id: it.id,
    grammarPoint: it.grammarPoint,
    note: it.note,
  }));
  for (const item of chapterItems) {
    for (let idx = 0; idx < item.sentences.length; idx++) {
      const sentence = item.sentences[idx];
      if (sentence.manual) continue;
      jobs.push({ chapter, item, sentenceIdx: idx, sentence, chapterGrammarList });
    }
  }
}

const findings = [];
let done = 0;
let lastChapter = null;

async function processJob(job) {
  const verdict = await auditSentence(job);
  done++;
  if (verdict.belongs_with !== job.item.id) {
    findings.push({
      chapter: job.chapter,
      sourceItemId: job.item.id,
      sourceGrammarPoint: job.item.grammarPoint,
      sentenceIdx: job.sentenceIdx,
      jp: job.sentence.jp,
      en: job.sentence.en,
      suggestedItemId: verdict.belongs_with,
      suggestedGrammarPoint: verdict.belongs_with_label,
      reason: verdict.reason,
      severity: verdict.severity,
    });
  }
  if (!jsonOnly) {
    if (job.chapter !== lastChapter) {
      lastChapter = job.chapter;
      process.stdout.write(`\nCh.${job.chapter} `);
    }
    process.stdout.write(verdict.belongs_with === job.item.id ? "." : "!");
    if (done % 50 === 0) process.stdout.write(` (${done}/${jobs.length})`);
  }
}

// Concurrency-limited execution.
async function run() {
  let idx = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (idx < jobs.length) {
      const my = jobs[idx++];
      try {
        await processJob(my);
      } catch (err) {
        if (!jsonOnly) console.warn(`\n  audit error on ${my.item.id}: ${err.message}`);
        done++;
      }
    }
  });
  await Promise.all(workers);
}

await run();

const report = {
  model,
  totalAudited: jobs.length,
  totalFlagged: findings.length,
  findings: findings.sort(
    (a, b) =>
      a.chapter - b.chapter ||
      a.sourceItemId.localeCompare(b.sourceItemId) ||
      a.sentenceIdx - b.sentenceIdx
  ),
};

writeFileSync(reportPath, JSON.stringify(report, null, 2));

if (jsonOnly) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(
    `\n\n--- audit complete ---\n` +
      `audited: ${report.totalAudited} generated sentences\n` +
      `flagged: ${report.totalFlagged} potential overlaps\n` +
      `report:  ${reportPath}\n`
  );
  if (report.totalFlagged > 0) {
    console.log("--- findings ---");
    for (const f of report.findings) {
      console.log(
        `\n[${f.chapter}] ${f.sourceItemId} (${f.sourceGrammarPoint})\n` +
          `  → suggests: ${f.suggestedItemId} (${f.suggestedGrammarPoint ?? "?"}) [${f.severity}]\n` +
          `  JP: ${f.jp}\n` +
          `  EN: ${f.en}\n` +
          `  reason: ${f.reason}`
      );
    }
  }
}

// ---------- audit ----------

async function auditSentence({ item, sentence, chapterGrammarList }) {
  const otherPoints = chapterGrammarList.filter((p) => p.id !== item.id);
  const prompt = [
    `You are reviewing example sentences for a Japanese grammar SRS app.`,
    `Each chapter teaches several grammar points. A sentence has been assigned to one of them.`,
    `Your job is to flag sentences that demonstrate a FUNDAMENTALLY DIFFERENT grammar point — not minor variants.`,
    ``,
    `Sentence under review:`,
    `  JP: ${sentence.jp}`,
    `  EN: ${sentence.en}`,
    ``,
    `Currently filed under:`,
    `  id: ${item.id}`,
    `  grammar point: ${item.grammarPoint}`,
    `  note: ${item.note}`,
    ``,
    `Other grammar points in the same chapter (sibling candidates):`,
    ...otherPoints.map(
      (p, i) => `  ${i + 1}. id=${p.id}  ${p.grammarPoint}\n     note: ${p.note}`
    ),
    ``,
    `Decision rules — be VERY CONSERVATIVE. Only flag REAL grammar mismatches:`,
    ``,
    `DO flag (these are real overlaps that confuse learners):`,
    `- 可能形 (potential, e.g. 見られる/読める) confused with stative perception verbs (見える/聞こえる/できる).`,
    `  e.g. "海が見えます" filed under 可能形 — wrong, it's spontaneous visibility.`,
    `- ～そうです visual judgment (stem+そう, e.g. 雨が降りそう) confused with hearsay (plain+そう, e.g. 雨が降るそう). Critical contrast.`,
    `- のに (despite, with disappointment) vs のに (purpose/use). Same shape, different grammar.`,
    `- てしまう (regret) sentences filed under てしまう (completion), or vice versa, when the context makes one clearly the right fit.`,
    `- てあります (intentional state, transitive) vs ています (resultant state, intransitive).`,
    `- ように (purpose, non-volitional) vs ために (purpose, volitional).`,
    `- A sentence that simply does not use the assigned grammar point at all.`,
    ``,
    `DO NOT flag (these are intentional editorial variants, not overlaps):`,
    `- Affirmative vs negative forms of the same grammar point (e.g. ch.X-1 affirmative potential vs ch.X-2 negative potential).`,
    `  → A 〜ません/〜ない sentence under an affirmative item is FINE — same grammar, different polarity.`,
    `- Question vs statement forms of the same grammar point.`,
    `- Past vs non-past forms of the same grammar point.`,
    `- Sentences that use the assigned grammar point AND incidentally use other chapter grammar — keep them.`,
    `- Counter-form variants of the same construction (e.g. しか+counter under base しか).`,
    ``,
    `Severity:`,
    `- "high"   : the sentence does NOT use the assigned grammar point at all`,
    `- "medium" : the assigned point is at most incidental; a sibling is the obvious primary feature`,
    `- "none"   : the assigned point is the focus, even if other grammar appears`,
    ``,
    `When in doubt, return "none". The cost of a false flag is higher than the cost of missing a marginal case.`,
    ``,
    `Output ONLY a JSON object — no prose, no markdown:`,
    `{"belongs_with": "<id>", "belongs_with_label": "<grammar point text or null>", "severity": "none|medium|high", "reason": "<one sentence>"}`,
    ``,
    `If the assigned point is correct (the typical case), respond with: {"belongs_with": "${item.id}", "belongs_with_label": null, "severity": "none", "reason": "best fit"}`,
  ].join("\n");

  const raw = await callClaude(prompt);
  const trimmed = raw.trim().replace(/^```(?:json)?\n?|```$/g, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      return {
        belongs_with: item.id,
        belongs_with_label: null,
        severity: "none",
        reason: "auditor returned non-JSON",
      };
    }
    parsed = JSON.parse(match[0]);
  }
  return parsed;
}

async function callClaude(prompt) {
  await reserveSlot();
  const url = `${baseUrl}/model/${model}/invoke`;
  const body = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": authToken,
        "anthropic-version": "bedrock-2023-05-31",
      },
      body: JSON.stringify(body),
    });
    if (res.status === 429) {
      // Back off and respect the rate limit window.
      const wait = 5000 * (attempt + 1);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    const block = (data.content ?? []).find((b) => b.type === "text");
    if (!block) throw new Error("no text block in response");
    return block.text;
  }
  throw new Error("exhausted retries on 429");
}

// ---------- TS source manipulation (mirrored from generate-sentences.mjs) ----------

function parseGrammarItems(src) {
  const start = src.indexOf("export const grammarData");
  const eqIdx = src.indexOf("=", start);
  const arrStart = src.indexOf("[", eqIdx);
  const arrEnd = findMatchingBracket(src, arrStart);
  if (arrStart < 0 || arrEnd < 0)
    throw new Error("could not locate grammarData array");

  const items = [];
  let i = arrStart + 1;
  while (i < arrEnd) {
    while (i < arrEnd && /[\s,]/.test(src[i])) i++;
    if (i >= arrEnd || src[i] !== "{") break;
    const objStart = i;
    const objEnd = findMatchingBracket(src, objStart);
    const objSrc = src.slice(objStart, objEnd + 1);
    items.push(parseItemObject(objSrc, objStart, objEnd));
    i = objEnd + 1;
  }
  return items;
}

function parseItemObject(objSrc, start, end) {
  const idMatch = objSrc.match(/id:\s*"([^"]+)"/);
  const chapterMatch = objSrc.match(/chapter:\s*(\d+)/);
  const grammarMatch = objSrc.match(/grammarPoint:\s*"((?:[^"\\]|\\.)+)"/);
  const noteMatch = objSrc.match(/note:\s*"((?:[^"\\]|\\.)+)"/);

  const sentencesIdx = objSrc.indexOf("sentences:");
  const arrStart = objSrc.indexOf("[", sentencesIdx);
  const arrEnd = findMatchingBracket(objSrc, arrStart);
  const arrSrc = objSrc.slice(arrStart + 1, arrEnd);

  const sentences = [];
  for (const m of arrSrc.matchAll(
    /\{\s*jp:\s*"((?:[^"\\]|\\.)+)"\s*,\s*en:\s*"((?:[^"\\]|\\.)+)"(?:\s*,\s*manual:\s*(true|false))?\s*\}/g
  )) {
    sentences.push({
      jp: unescapeJsString(m[1]),
      en: unescapeJsString(m[2]),
      manual: m[3] === "true",
    });
  }

  return {
    id: idMatch[1],
    chapter: Number(chapterMatch[1]),
    grammarPoint: unescapeJsString(grammarMatch[1]),
    note: noteMatch ? unescapeJsString(noteMatch[1]) : "",
    sentences,
    objStart: start,
    objEnd: end,
  };
}

function findMatchingBracket(src, openIdx) {
  const open = src[openIdx];
  const close = open === "{" ? "}" : open === "[" ? "]" : null;
  if (!close) throw new Error("not a bracket");
  let depth = 0;
  let inStr = false;
  let strCh = null;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (c === "\\") {
        i++;
        continue;
      }
      if (c === strCh) inStr = false;
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = true;
      strCh = c;
      continue;
    }
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function unescapeJsString(s) {
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

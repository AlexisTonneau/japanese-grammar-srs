#!/usr/bin/env node
// Generate alternate Japanese example sentences for grammar items, constrained
// to known vocabulary from the user's Anki deck.
//
// Usage:
//   node scripts/generate-sentences.mjs --chapters 27           # one chapter
//   node scripts/generate-sentences.mjs --chapters 27,28,29     # several
//   node scripts/generate-sentences.mjs --chapters all          # all of them
//   node scripts/generate-sentences.mjs --chapters 27 --variants 5 --dry-run
//
// Reads:   data/anki-vocab.json (run extract-anki-vocab.mjs first)
//          src/data/grammarData.ts
// Writes:  src/data/grammarData.ts (only when --dry-run is omitted)
//
// Sentences flagged with `manual: true` are never overwritten. Existing
// non-manual sentences for an item are replaced wholesale.

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);

function flag(name) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : null;
}
const dryRun = args.includes("--dry-run");
const chaptersArg = flag("chapters") ?? "27";
const variants = Number(flag("variants") ?? 5);
const model = flag("model") ?? "us.anthropic.claude-sonnet-4-6";

const baseUrl = process.env.ANTHROPIC_BEDROCK_BASE_URL;
const authToken = process.env.ANTHROPIC_AUTH_TOKEN;
if (!baseUrl || !authToken) {
  console.error("Missing ANTHROPIC_BEDROCK_BASE_URL or ANTHROPIC_AUTH_TOKEN env vars.");
  process.exit(1);
}

const vocabPath = join(root, "data", "anki-vocab.json");
const vocab = JSON.parse(readFileSync(vocabPath, "utf8"));
const knownKanji = new Set(vocab.kanji);

const dataPath = join(root, "src", "data", "grammarData.ts");
const dataSrc = readFileSync(dataPath, "utf8");

const items = parseGrammarItems(dataSrc);
const targetChapters = parseChapters(chaptersArg);
const targets = items.filter((it) =>
  targetChapters === "all" ? true : targetChapters.has(it.chapter)
);

console.log(
  `loaded ${vocab.words.length} known words / ${vocab.kanji.length} known kanji`
);
console.log(
  `processing ${targets.length} item${targets.length === 1 ? "" : "s"} ` +
    `(chapters: ${chaptersArg}); ${variants} variants each; model=${model}`
);

let totalKept = 0;
let totalRetried = 0;
let totalFailed = 0;

for (const item of targets) {
  process.stdout.write(`\n${item.id}  [${item.grammarPoint}] ... `);

  const seedSentence = item.sentences[0];
  const generated = await generateForItem(item, seedSentence);

  totalKept += generated.kept.length;
  totalRetried += generated.retries;
  totalFailed += generated.failed;

  console.log(
    `${generated.kept.length}/${variants} kept · retries=${generated.retries}` +
      (generated.failed > 0 ? ` · FAILED=${generated.failed}` : "")
  );
  for (const s of generated.kept) {
    console.log(`    JP: ${s.jp}`);
    console.log(`    EN: ${s.en}`);
  }

  // Splice the new sentences into the source. Manual sentences (sentences[0])
  // are preserved; everything else for this item is replaced.
  if (!dryRun && generated.kept.length > 0) {
    item.sentences = [
      ...item.sentences.filter((s) => s.manual),
      ...generated.kept.map((s) => ({ jp: s.jp, en: s.en })),
    ];
  }
}

console.log(
  `\n--- summary ---\nkept ${totalKept} sentences across ${targets.length} items` +
    ` · ${totalRetried} retries · ${totalFailed} failures`
);

if (dryRun) {
  console.log("(dry run — grammarData.ts not modified)");
} else if (totalKept > 0) {
  const updated = rewriteGrammarFile(dataSrc, items);
  writeFileSync(dataPath, updated);
  console.log(`wrote: ${dataPath}`);
}

// ---------- generation ----------

async function generateForItem(item, seedSentence) {
  const allowedExtras = collectAllowedExtras(seedSentence?.jp ?? "");

  const result = { kept: [], retries: 0, failed: 0, rejectedByVerifier: 0 };
  const candidatesPool = [];
  let attempts = 0;
  const maxAttempts = 3;

  // Phase 1: generate candidates. The verifier is strict, so we oversample
  // by ~2x to leave plenty of room for rejection.
  const targetPool = variants * 2 + 2;
  while (candidatesPool.length < targetPool && attempts < maxAttempts) {
    attempts++;
    const wanted = targetPool - candidatesPool.length;

    const prompt = buildPrompt({
      item,
      seedSentence,
      allowedExtras,
      n: wanted + 2,
    });

    let raw;
    try {
      raw = await callClaude(prompt);
    } catch (err) {
      console.warn(`\n    api error: ${err.message}`);
      result.retries++;
      continue;
    }

    const candidates = parseSentencesJson(raw);
    if (!candidates) {
      result.retries++;
      continue;
    }

    for (const cand of candidates) {
      if (validate(cand, allowedExtras)) {
        result.retries++;
        continue;
      }
      if (
        candidatesPool.some((s) => s.jp === cand.jp) ||
        item.sentences.some((s) => s.jp === cand.jp)
      ) {
        continue;
      }
      candidatesPool.push(cand);
    }
  }

  // Phase 2: verify each candidate with a separate call.
  for (const cand of candidatesPool) {
    if (result.kept.length >= variants) break;
    let verdict;
    try {
      verdict = await verifySentence(item, cand);
    } catch (err) {
      console.warn(`\n    verifier error: ${err.message}`);
      result.retries++;
      continue;
    }
    if (verdict.ok) {
      result.kept.push(cand);
    } else {
      result.rejectedByVerifier++;
      console.log(
        `\n    rejected: ${cand.jp}\n      reason: ${verdict.reason ?? "(no reason)"}`
      );
    }
  }

  if (result.kept.length === 0) result.failed = 1;
  return result;
}

async function verifySentence(item, candidate) {
  const prompt = [
    `You are checking a Japanese example sentence written for a learner studying the grammar point "${item.grammarPoint}".`,
    ``,
    `Grammar nuance: ${item.note}`,
    ``,
    `Sentence to check:`,
    `  JP: ${candidate.jp}`,
    `  EN: ${candidate.en}`,
    ``,
    `Reject ONLY for hard errors. Be lenient on stylistic choices.`,
    ``,
    `HARD errors (reject):`,
    `- Wrong verb conjugation (especially 可能形 / 受身 / 使役 / 命令 — e.g., conjugating する verbs as if Group 2, mixing up 受身 and 可能 forms).`,
    `- Wrong or missing particle that changes the meaning.`,
    `- The sentence does NOT demonstrate the grammar point.`,
    `- The English translation is materially wrong (not just slightly different phrasing).`,
    `- The sentence is ungrammatical or genuinely confusing.`,
    ``,
    `NOT errors (do not reject):`,
    `- Stylistic alternatives (e.g., a different but valid particle choice).`,
    `- Translations that paraphrase rather than gloss word-for-word.`,
    `- Using stative verbs (見える, 聞こえる, できる, わかる) where they make sense — these are valid Japanese, even when a "pure" 可能形 of another verb might also work.`,
    `- The sentence demonstrating a related grammar point alongside the target one.`,
    ``,
    `Respond with ONLY a JSON object — no prose, no markdown:`,
    `{"ok": true}  if the sentence has no hard errors`,
    `{"ok": false, "reason": "<concise explanation>"}  if it has a hard error`,
  ].join("\n");

  const raw = await callClaude(prompt);
  const trimmed = raw.trim().replace(/^```(?:json)?\n?|```$/g, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return { ok: false, reason: "verifier returned non-JSON" };
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return { ok: false, reason: "verifier returned non-JSON" };
    }
  }
  return parsed;
}

function buildPrompt({ item, seedSentence, allowedExtras, n }) {
  const allowedKanjiList = [...knownKanji].sort().join("");
  const extrasList = [...allowedExtras]
    .filter((c) => /[一-鿿]/.test(c))
    .sort()
    .join("");

  return [
    `You are creating example sentences for a Japanese learner studying Minna no Nihongo Book 2.`,
    ``,
    `Grammar point: ${item.grammarPoint}`,
    `Chapter: ${item.chapter}`,
    `Nuance / structural note: ${item.note}`,
    seedSentence
      ? `\nTextbook example sentence (for reference, do NOT copy):\n  JP: ${seedSentence.jp}\n  EN: ${seedSentence.en}`
      : "",
    ``,
    `Your task: write ${n} NEW example sentences that drill this grammar point.`,
    ``,
    `KANJI WHITELIST — these are the only kanji you may use:`,
    allowedKanjiList,
    extrasList ? `\nADDITIONAL kanji from the textbook example (also allowed):\n${extrasList}` : ``,
    ``,
    `RULES:`,
    `1. Each sentence MUST clearly use the grammar point "${item.grammarPoint}".`,
    `2. Use ONLY kanji from the whitelist (and the additional kanji listed). For any word whose kanji is NOT in the whitelist, write the word in hiragana or katakana.`,
    `3. Vocabulary should match a Japanese learner at JLPT N4-N3 level.`,
    `4. Vary the topics, subjects, and sentence structures across the ${n} sentences. Do NOT all use the same subject (e.g., not all about ミラーさん or 私).`,
    `5. Each sentence must end with proper punctuation (。 or ？).`,
    `6. Provide a natural English translation that captures the nuance, not a word-for-word gloss.`,
    ``,
    `Output ONLY a valid JSON array. No prose, no markdown fences, no commentary. Schema:`,
    `[{"jp": "...", "en": "..."}, ...]`,
  ].join("\n");
}

async function callClaude(prompt) {
  const url = `${baseUrl}/model/${model}/invoke`;
  const body = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": authToken,
      "anthropic-version": "bedrock-2023-05-31",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  const block = (data.content ?? []).find((b) => b.type === "text");
  if (!block) throw new Error("no text block in response");
  return block.text;
}

function parseSentencesJson(raw) {
  // Strip markdown fences if any sneak in.
  const trimmed = raw.trim().replace(/^```(?:json)?\n?|```$/g, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    // Try to find a JSON array inside the text.
    const match = trimmed.match(/\[[\s\S]*\]/);
    if (!match) return null;
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(parsed)) return null;
  return parsed.filter(
    (s) => s && typeof s.jp === "string" && typeof s.en === "string"
  );
}

// ---------- validation ----------

function validate(sentence, allowedExtras) {
  if (!sentence.jp || !sentence.en) return "missing fields";
  if (sentence.jp.length < 4 || sentence.jp.length > 80)
    return "jp length out of range";
  if (sentence.en.length < 4 || sentence.en.length > 200)
    return "en length out of range";
  // No latin letters in jp (other than punctuation).
  if (/[A-Za-z]/.test(sentence.jp)) return "latin letters in jp";
  // Must end in 。 or ？ or ！
  if (!/[。？！]$/.test(sentence.jp)) return "missing terminal punctuation";

  // Every kanji must be in the whitelist or the per-item extras.
  for (const ch of sentence.jp) {
    if (/[一-鿿]/.test(ch) && !knownKanji.has(ch) && !allowedExtras.has(ch)) {
      return `unknown kanji: ${ch}`;
    }
  }
  return null;
}

function collectAllowedExtras(seedJp) {
  const set = new Set();
  for (const ch of seedJp) {
    if (/[一-鿿]/.test(ch)) set.add(ch);
  }
  return set;
}

// ---------- TS source manipulation ----------

function parseGrammarItems(src) {
  // Locate the grammarData array body. The declaration looks like:
  //   export const grammarData: GrammarItem[] = [
  // Find the `=` then the next `[`, which is the actual array literal.
  const start = src.indexOf("export const grammarData");
  const eqIdx = src.indexOf("=", start);
  const arrStart = src.indexOf("[", eqIdx);
  const arrEnd = findMatchingBracket(src, arrStart);
  if (arrStart < 0 || arrEnd < 0)
    throw new Error("could not locate grammarData array");

  const items = [];
  let i = arrStart + 1;
  while (i < arrEnd) {
    // Skip whitespace and commas
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

  if (!idMatch || !chapterMatch || !grammarMatch) {
    throw new Error(`malformed item: ${objSrc.slice(0, 80)}`);
  }

  // sentences: [...]
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

function escapeJsString(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function rewriteGrammarFile(originalSrc, items) {
  // Replace each item's sentences array in place. Walk in reverse so indices
  // earlier in the file remain stable as we splice.
  let out = originalSrc;
  const sorted = [...items].sort((a, b) => b.objStart - a.objStart);

  for (const item of sorted) {
    const objSrc = out.slice(item.objStart, item.objEnd + 1);
    const sentencesIdx = objSrc.indexOf("sentences:");
    const arrStart = objSrc.indexOf("[", sentencesIdx);
    const arrEnd = findMatchingBracket(objSrc, arrStart);

    const newArr = renderSentencesArray(item.sentences);
    const newObj =
      objSrc.slice(0, arrStart) + newArr + objSrc.slice(arrEnd + 1);
    out = out.slice(0, item.objStart) + newObj + out.slice(item.objEnd + 1);
  }
  return out;
}

function renderSentencesArray(sentences) {
  if (sentences.length === 0) return "[]";
  const lines = sentences.map((s) => {
    const manual = s.manual ? ", manual: true" : "";
    return `      { jp: "${escapeJsString(s.jp)}", en: "${escapeJsString(s.en)}"${manual} }`;
  });
  return `[\n${lines.join(",\n")},\n    ]`;
}

function parseChapters(arg) {
  if (arg === "all") return "all";
  return new Set(arg.split(",").map((s) => Number(s.trim())));
}

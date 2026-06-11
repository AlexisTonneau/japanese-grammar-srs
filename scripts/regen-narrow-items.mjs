#!/usr/bin/env node
// One-shot regeneration for items whose generated sentences were all moved
// elsewhere by the audit. The standard generator's prompt is too general
// for these — we want surgical, point-specific examples that won't drift
// to a sibling on a future audit.
//
// Targets:
//   ch45-5 — のに vs が / ても (must demonstrate the CONTRAST, not just のに).
//   ch48-1 — 使役形 conjugation (must show distinct conjugation groups, not
//            just the transitive-に pattern that ch48-3 covers).

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = join(root, "src", "data", "grammarData.ts");

const baseUrl = process.env.ANTHROPIC_BEDROCK_BASE_URL;
const authToken = process.env.ANTHROPIC_AUTH_TOKEN;
if (!baseUrl || !authToken) {
  console.error("Missing ANTHROPIC_BEDROCK_BASE_URL or ANTHROPIC_AUTH_TOKEN env vars.");
  process.exit(1);
}
const model = "us.anthropic.claude-sonnet-4-6";

const TARGETS = [
  // ch45-5 was hand-curated after the first regen run produced good content
  // mixed with parenthetical commentary in the EN field. Don't re-run it.
  {
    id: "ch48-1",
    n: 4,
    prompt: `Write 4 Japanese example sentences for an SRS card that drills the FORMATION of the causative form (使役形).

The card teaches the conjugation rules:
  - Group 1 (五段): う-row → わ-row + せる. e.g. 書く → 書かせる, 飲む → 飲ませる, 行く → 行かせる.
  - Group 2 (一段): drop る + させる. e.g. 食べる → 食べさせる, 起きる → 起きさせる.
  - Group 3 (irregular): する → させる, 来る → 来させる.

Each of the 4 sentences MUST clearly demonstrate ONE conjugation case from a DIFFERENT verb group. Pick verbs that show the rule:

  - Sentence 1: Group 1 verb (e.g. 書く, 待つ, 読む, 行く, 走る) — show the わ-row + せる shift.
  - Sentence 2: Group 1 verb of a different ending (different from sentence 1).
  - Sentence 3: Group 2 verb (e.g. 食べる, 起きる, 寝る, 見る, 教える).
  - Sentence 4: Group 3 — する compound (e.g. 勉強する, 練習する) → 勉強させる. NOT 来る (来させる).

DO NOT write sentences that focus on the に-marking pattern (that's a different card). Keep the focus on the verb's conjugation. Use a SHORT context. Examples of the right shape:

  - "毎日子供に本を読ませています。" (Group 1: 読む → 読ませる)
  - "母は私に部屋を片付けさせました。" (Group 2: 片付ける → 片付けさせる)
  - "コーチは選手に毎日練習させます。" (Group 3 する: 練習する → 練習させる)

Vocabulary: common N4-N3 words. Vary the topics.

Output ONLY a JSON array, no markdown, no prose:
[{"jp": "...", "en": "..."}, ...]`,
  },
];

const dataSrc = readFileSync(dataPath, "utf8");
const items = parseGrammarItems(dataSrc);
const itemById = new Map(items.map((i) => [i.id, i]));

for (const target of TARGETS) {
  const item = itemById.get(target.id);
  if (!item) {
    console.warn(`item ${target.id} not found, skipping`);
    continue;
  }
  console.log(`\n${target.id} — generating ${target.n} sentences`);
  const raw = await callClaude(target.prompt);
  const parsed = parseSentencesJson(raw);
  if (!parsed || parsed.length === 0) {
    console.warn(`  failed to parse output, skipping`);
    console.warn(`  raw output (first 500 chars): ${raw.slice(0, 500)}`);
    continue;
  }
  const fresh = parsed.slice(0, target.n);
  for (const s of fresh) {
    if (item.sentences.some((existing) => existing.jp === s.jp)) continue;
    item.sentences.push({ jp: s.jp, en: s.en });
    console.log(`  + ${s.jp}`);
    console.log(`    ${s.en}`);
  }
}

const updated = rewriteGrammarFile(dataSrc, items);
writeFileSync(dataPath, updated);
console.log(`\nwrote: ${dataPath}`);

// ---------- LLM call ----------

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
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const block = (data.content ?? []).find((b) => b.type === "text");
  return block.text;
}

function parseSentencesJson(raw) {
  const trimmed = raw.trim().replace(/^```(?:json)?\n?|```$/g, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\[[\s\S]*\]/);
    if (!match) return null;
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
  return Array.isArray(parsed) ? parsed.filter((s) => s && s.jp && s.en) : null;
}

// ---------- TS source manipulation ----------

function parseGrammarItems(src) {
  const start = src.indexOf("export const grammarData");
  const eqIdx = src.indexOf("=", start);
  const arrStart = src.indexOf("[", eqIdx);
  const arrEnd = findMatchingBracket(src, arrStart);
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
  return { id: idMatch[1], sentences, objStart: start, objEnd: end };
}

function findMatchingBracket(src, openIdx) {
  const open = src[openIdx];
  const close = open === "{" ? "}" : open === "[" ? "]" : null;
  let depth = 0, inStr = false, strCh = null;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (c === "\\") { i++; continue; }
      if (c === strCh) inStr = false;
      continue;
    }
    if (c === '"' || c === "'") { inStr = true; strCh = c; continue; }
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) return i; }
  }
  return -1;
}

function unescapeJsString(s) {
  return s.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

function escapeJsString(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function rewriteGrammarFile(originalSrc, items) {
  let out = originalSrc;
  const sorted = [...items].sort((a, b) => b.objStart - a.objStart);
  for (const item of sorted) {
    const objSrc = out.slice(item.objStart, item.objEnd + 1);
    const sentencesIdx = objSrc.indexOf("sentences:");
    const arrStart = objSrc.indexOf("[", sentencesIdx);
    const arrEnd = findMatchingBracket(objSrc, arrStart);
    const newArr = renderSentencesArray(item.sentences);
    const newObj = objSrc.slice(0, arrStart) + newArr + objSrc.slice(arrEnd + 1);
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

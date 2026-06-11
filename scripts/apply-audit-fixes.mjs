#!/usr/bin/env node
// Apply hand-curated audit fixes to grammarData.ts.
//
// Each fix moves one generated sentence from a source item to a target item.
// The fix list is defined inline, derived from a manual review of the audit
// report at data/audit-report.json. We don't trust the audit report blindly
// because it has both true positives (real overlaps) and false positives
// (editorial-variant noise). This script encodes only the moves a human
// confirmed.

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = join(root, "src", "data", "grammarData.ts");

// Each move: identify the sentence by its Japanese text (unique within an item),
// where to move it to, and a one-line note for git history.
const MOVES = [
  // Ch.27 — 見える (spontaneous) was misfiled under 可能形.
  { from: "ch27-1", to: "ch27-4", jp: "この部屋からは海が見えます。" },

  // Ch.29 — てしまう completion vs regret swap.
  { from: "ch29-4", to: "ch29-6", jp: "大切な手紙をなくしてしまいました。" },
  { from: "ch29-5", to: "ch29-4", jp: "妻が作った料理を全部食べてしまいました。" },

  // Ch.34 — past-form とおりに belongs under the た-form item, not the combined dict/た item.
  { from: "ch34-2", to: "ch34-3", jp: "先生が教えたとおりに、もう一度やってみてください。" },
  { from: "ch34-2", to: "ch34-3", jp: "母が言ったとおりに、野菜を切りました。" },

  // Ch.34 — manner ないで, not "instead of".
  { from: "ch34-7", to: "ch34-6", jp: "朝ご飯を食べないで、コーヒーだけ飲んで出かけた。" },
  { from: "ch34-7", to: "ch34-6", jp: "エアコンをつけないで、窓を開けて寝ます。" },

  // Ch.37 — adversity passive, not basic passive.
  { from: "ch37-1", to: "ch37-2", jp: "弟は友達にケーキを食べられました。" },

  // Ch.41 — ～てくださいます (action benefactive), not bare くださいます (object give).
  { from: "ch41-3", to: "ch41-6", jp: "先生は私に漢字の書き方を教えてくださいました。" },
  { from: "ch41-3", to: "ch41-6", jp: "部長は私に大切な仕事をまかせてくださいました。" },
  { from: "ch41-3", to: "ch41-6", jp: "お医者さんは私にわかりやすく説明してくださいました。" },

  // Ch.43 — adjective+そう (looks), not verb-stem+そう (about to).
  { from: "ch43-1", to: "ch43-2", jp: "彼は嬉しそうな顔をしていますね。何かいいことがありましたか。" },

  // Ch.44 — やすい/にくい tendency.
  { from: "ch44-7", to: "ch44-2", jp: "先生は分かりやすく説明してくれました。" },

  // Ch.45 — pure のに sentences belong under ch45-4 (despite). ch45-5 is the
  // contrastive comparison item, which only fits sentences that explicitly
  // contrast のに with が or ても.
  { from: "ch45-5", to: "ch45-4", jp: "早く起きたのに、バスに乗れませんでした。" },
  { from: "ch45-5", to: "ch45-4", jp: "妻が料理を作ったのに、夫は何も食べませんでした。" },
  { from: "ch45-5", to: "ch45-4", jp: "チケットを買ったのに、コンサートに行けなくなりました。" },
  { from: "ch45-5", to: "ch45-4", jp: "何度も電話したのに、どうして出なかったんですか。" },
  { from: "ch45-5", to: "ch45-4", jp: "薬を飲んだのに、熱が全然下がりません。" },

  // Ch.48 — ch48-1 was the conjugation-table item with no real examples in
  // the textbook. All transitive-with-に sentences belong under ch48-3.
  { from: "ch48-1", to: "ch48-3", jp: "母は私に野菜を食べさせました。" },
  { from: "ch48-1", to: "ch48-3", jp: "先生は学生たちに日本語で話させます。" },
  { from: "ch48-1", to: "ch48-3", jp: "父は兄に車を洗わせました。" },
  { from: "ch48-1", to: "ch48-3", jp: "社長は社員に残業させることが多いです。" },
  { from: "ch48-1", to: "ch48-3", jp: "先生は子供たちに漢字を百回書かせました。" },

  // Ch.49 — special-honorific verbs and passive-form honorifics misfiled
  // under the お/ご prefix item.
  { from: "ch49-5", to: "ch49-3", jp: "お名前をもう一度おっしゃっていただけますか。" },
  { from: "ch49-5", to: "ch49-1", jp: "お仕事はどんなことをされていますか。" },

  // Ch.50 — ご-prefix Sino-Japanese verb under the お-prefix item.
  { from: "ch50-1", to: "ch50-3", jp: "こちらの商品についてご説明します。" },
];

const dataSrc = readFileSync(dataPath, "utf8");
const items = parseGrammarItems(dataSrc);
const itemById = new Map(items.map((i) => [i.id, i]));

let applied = 0;
let skipped = 0;
const errors = [];

for (const move of MOVES) {
  const fromItem = itemById.get(move.from);
  const toItem = itemById.get(move.to);
  if (!fromItem) {
    errors.push(`source item ${move.from} not found`);
    continue;
  }
  if (!toItem) {
    errors.push(`target item ${move.to} not found`);
    continue;
  }
  const idx = fromItem.sentences.findIndex((s) => s.jp === move.jp);
  if (idx < 0) {
    errors.push(`sentence not found in ${move.from}: ${move.jp}`);
    skipped++;
    continue;
  }
  const sentence = fromItem.sentences[idx];
  if (sentence.manual) {
    errors.push(`refusing to move manual sentence in ${move.from}: ${move.jp}`);
    skipped++;
    continue;
  }
  // Skip if the target already has this exact sentence (idempotent reruns).
  if (toItem.sentences.some((s) => s.jp === move.jp)) {
    skipped++;
    continue;
  }
  fromItem.sentences.splice(idx, 1);
  toItem.sentences.push({ jp: sentence.jp, en: sentence.en });
  applied++;
}

if (errors.length > 0) {
  console.error("errors:");
  for (const e of errors) console.error(`  ${e}`);
}

if (applied === 0) {
  console.log(`no changes applied (${skipped} skipped)`);
  process.exit(errors.length > 0 ? 1 : 0);
}

const updated = rewriteGrammarFile(dataSrc, items);
writeFileSync(dataPath, updated);
console.log(`applied ${applied} moves (${skipped} skipped)`);
console.log(`wrote: ${dataPath}`);

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

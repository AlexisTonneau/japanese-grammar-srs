#!/usr/bin/env node
// One-time migration: convert grammarData.ts from
//   { japaneseSentence: "...", englishTranslation: "..." }
// to
//   { sentences: [{ jp: "...", en: "...", manual: true }] }
//
// Idempotent — bails out if it detects the new shape already.

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const filePath = join(root, "src", "data", "grammarData.ts");
const src = readFileSync(filePath, "utf8");

if (src.includes("sentences:")) {
  console.error("File already migrated. Aborting.");
  process.exit(1);
}

// New interface block
const newInterface = `export interface SentencePair {
  jp: string;
  en: string;
  manual?: boolean;
}

export interface GrammarItem {
  id: string;
  chapter: number;
  grammarPoint: string;
  sentences: SentencePair[];
  note: string;
}`;

const oldInterfaceRe = /export interface GrammarItem \{[\s\S]*?\}/;
let migrated = src.replace(oldInterfaceRe, newInterface);

// Walk every item, swap japaneseSentence + englishTranslation into a sentences[] array.
const itemRe =
  /(\s*\{\s*id:\s*"[^"]+",\s*chapter:\s*\d+,\s*grammarPoint:\s*"[^"]+",\s*)japaneseSentence:\s*("(?:[^"\\]|\\.)*"),\s*englishTranslation:\s*("(?:[^"\\]|\\.)*"),(\s*note:)/g;

let count = 0;
migrated = migrated.replace(itemRe, (_, before, jp, en, afterNote) => {
  count++;
  return `${before}sentences: [\n      { jp: ${jp}, en: ${en}, manual: true },\n    ],${afterNote}`;
});

if (count === 0) {
  console.error("No items matched the old shape. Aborting.");
  process.exit(1);
}

writeFileSync(filePath, migrated);
console.log(`Migrated ${count} items.`);

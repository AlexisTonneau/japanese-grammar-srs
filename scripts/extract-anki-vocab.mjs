#!/usr/bin/env node
// Extract known vocabulary from an Anki .apkg file.
// Filters by card interval (default ≥ 21 days = "mature/known").
//
// Usage:
//   node scripts/extract-anki-vocab.mjs <path-to.apkg> [--min-interval 21] [--out <path>]

import { execSync, spawnSync } from "node:child_process"; // execSync used for unzip/zstd
import { mkdtempSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const args = process.argv.slice(2);
const apkgPath = args[0];
if (!apkgPath || !existsSync(apkgPath)) {
  console.error(
    "Usage: node scripts/extract-anki-vocab.mjs <path-to.apkg> [--min-interval 21] [--out <path>]"
  );
  process.exit(1);
}

const minIntervalIdx = args.indexOf("--min-interval");
const minInterval = minIntervalIdx >= 0 ? Number(args[minIntervalIdx + 1]) : 21;
const outIdx = args.indexOf("--out");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = outIdx >= 0 ? args[outIdx + 1] : join(root, "data", "anki-vocab.json");

const tmp = mkdtempSync(join(tmpdir(), "anki-extract-"));
console.log(`extracting to ${tmp}`);

execSync(`unzip -o "${apkgPath}" collection.anki21b collection.anki2 -d "${tmp}"`, {
  stdio: "ignore",
});

let dbPath;
if (existsSync(join(tmp, "collection.anki21b"))) {
  dbPath = join(tmp, "collection.db");
  execSync(`zstd -d -f "${join(tmp, "collection.anki21b")}" -o "${dbPath}"`, {
    stdio: "ignore",
  });
} else {
  dbPath = join(tmp, "collection.anki2");
}

const FIELD_SEP = "\x1f";

function decodeQuoted(s) {
  // Parse a sqlite3 .mode quote string literal: 'foo''bar' or unistr('...').
  if (s === "NULL") return null;
  let body = s;
  if (body.startsWith("unistr(") && body.endsWith(")")) body = body.slice(7, -1);
  if (body.startsWith("'") && body.endsWith("'")) body = body.slice(1, -1);
  return body
    .replace(/''/g, "'")
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/\\U([0-9a-fA-F]{8})/g, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\\\/g, "\\");
}

function splitQuotedRow(line) {
  // Split a comma-separated row of sqlite3 quote-mode output into raw column strings,
  // respecting nested parentheses (for unistr(...)) and quoted single quotes ('').
  const cols = [];
  let cur = "";
  let inQ = false;
  let depth = 0;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "'" && !inQ) {
      inQ = true;
      cur += ch;
    } else if (ch === "'" && inQ) {
      if (line[i + 1] === "'") {
        cur += "''";
        i++;
      } else {
        inQ = false;
        cur += ch;
      }
    } else if (!inQ && ch === "(") {
      depth++;
      cur += ch;
    } else if (!inQ && ch === ")") {
      depth--;
      cur += ch;
    } else if (!inQ && depth === 0 && ch === ",") {
      cols.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.length) cols.push(cur);
  return cols.map((c) => decodeQuoted(c.trim()));
}

function sql(query) {
  const result = spawnSync(
    "sqlite3",
    ["-bail", "-cmd", ".mode quote", dbPath, query],
    { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 }
  );
  if (result.status !== 0) {
    throw new Error(`sqlite3 failed: ${result.stderr}`);
  }
  return result.stdout
    .split("\n")
    .filter((r) => r.length > 0)
    .map(splitQuotedRow);
}

function stripHtml(s) {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/\[sound:[^\]]+\]/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findField(fields, candidates) {
  for (const c of candidates) {
    const idx = fields.findIndex(
      (f) => f && f.toLowerCase().includes(c.toLowerCase())
    );
    if (idx >= 0) return idx;
  }
  return -1;
}

const notetypes = sql("SELECT id, name FROM notetypes;").map(([id, name]) => ({
  id,
  name,
}));
console.log("notetypes found:");
for (const nt of notetypes) console.log(`  ${nt.id} — ${nt.name}`);

const allFields = sql("SELECT ntid, ord, name FROM fields;");
const fieldsByNotetype = new Map();
for (const [ntid, ord, name] of allFields) {
  if (!fieldsByNotetype.has(ntid)) fieldsByNotetype.set(ntid, []);
  fieldsByNotetype.get(ntid)[Number(ord)] = name;
}

const vocab = new Map();
const intervals = { mature: 0, young: 0, new: 0, total: 0 };

for (const nt of notetypes) {
  const fields = fieldsByNotetype.get(nt.id) ?? [];
  const kanjiIdx = findField(fields, [
    "Vocabulary-Kanji",
    "Expression",
    "Kanji",
    "Front",
  ]);
  const kanaIdx = findField(fields, ["Vocabulary-Kana", "Reading", "Kana"]);
  const meaningIdx = findField(fields, [
    "Vocabulary-English",
    "Meaning",
    "English",
    "Back",
  ]);

  if (kanjiIdx < 0) {
    console.log(`  skipping notetype "${nt.name}" — no kanji-like field`);
    continue;
  }

  const rows = sql(
    `SELECT MAX(c.ivl), n.flds
     FROM notes n
     JOIN cards c ON c.nid = n.id
     WHERE n.mid = ${nt.id}
     GROUP BY n.id;`
  );

  console.log(`  ${nt.name}: ${rows.length} notes`);

  for (const cols of rows) {
    const ivl = Number(cols[0]) || 0;
    const flds = (cols[1] ?? "").split(FIELD_SEP);

    intervals.total++;
    if (ivl >= 21) intervals.mature++;
    else if (ivl >= 1) intervals.young++;
    else intervals.new++;

    if (ivl < minInterval) continue;

    const kanji = stripHtml(flds[kanjiIdx] ?? "");
    if (!kanji) continue;
    const kana = kanaIdx >= 0 ? stripHtml(flds[kanaIdx] ?? "") : "";
    const meaning = meaningIdx >= 0 ? stripHtml(flds[meaningIdx] ?? "") : "";

    if (!vocab.has(kanji) || vocab.get(kanji).interval < ivl) {
      vocab.set(kanji, { kanji, kana, meaning, interval: ivl });
    }
  }
}

const list = [...vocab.values()].sort((a, b) => b.interval - a.interval);

const kanjiSet = new Set();
for (const w of list) {
  for (const ch of w.kanji) {
    if (/[一-鿿]/.test(ch)) kanjiSet.add(ch);
  }
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(
  outPath,
  JSON.stringify(
    {
      source: apkgPath,
      minInterval,
      stats: {
        mature: intervals.mature,
        young: intervals.young,
        new: intervals.new,
        total: intervals.total,
        knownWords: list.length,
        knownKanji: kanjiSet.size,
      },
      kanji: [...kanjiSet].sort(),
      words: list,
    },
    null,
    2
  )
);

console.log("\n--- summary ---");
console.log(`total notes:    ${intervals.total}`);
console.log(`mature (≥21d):  ${intervals.mature}`);
console.log(`young (1-20d):  ${intervals.young}`);
console.log(`new/unstudied:  ${intervals.new}`);
console.log(`extracted (≥${minInterval}d): ${list.length} unique words, ${kanjiSet.size} unique kanji`);
console.log(`wrote: ${outPath}`);

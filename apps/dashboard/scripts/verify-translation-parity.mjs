#!/usr/bin/env node
/**
 * SaaS-06 — Verify Arabic/English translation parity.
 *
 * For every `ar.<name>.ts` file under `lib/translations/`, the matching
 * `en.<name>.ts` must export the same set of top-level string keys.
 *
 * Exits non-zero when any key is missing so CI / the pre-PR checklist
 * can gate on it.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = "lib/translations";
const arFiles = readdirSync(dir).filter(
  (f) => f.startsWith("ar.") && f.endsWith(".ts") && f !== "ar.ts",
);

let missing = 0;
let extra = 0;

for (const ar of arFiles) {
  const en = ar.replace(/^ar\./, "en.");
  const arPath = join(dir, ar);
  const enPath = join(dir, en);
  let enSrc;
  try {
    enSrc = readFileSync(enPath, "utf8");
  } catch {
    console.error(`[parity] missing file: ${enPath}`);
    missing += 1;
    continue;
  }
  const arKeys = extractKeys(readFileSync(arPath, "utf8"));
  const enKeys = extractKeys(enSrc);
  const absentInEn = arKeys.filter((k) => !enKeys.includes(k));
  const absentInAr = enKeys.filter((k) => !arKeys.includes(k));
  if (absentInEn.length) {
    console.error(
      `[parity] ${en}: missing ${absentInEn.length} key(s) present in ${ar}:`,
    );
    for (const k of absentInEn) console.error(`  - ${k}`);
    missing += absentInEn.length;
  }
  if (absentInAr.length) {
    console.error(
      `[parity] ${ar}: missing ${absentInAr.length} key(s) present in ${en}:`,
    );
    for (const k of absentInAr) console.error(`  - ${k}`);
    extra += absentInAr.length;
  }
}

if (missing === 0 && extra === 0) {
  console.log("[parity] OK — ar/en files have matching key sets");
  process.exit(0);
}
console.error(
  `[parity] FAIL — ${missing} missing in en.*, ${extra} missing in ar.*`,
);
process.exit(1);

/**
 * Extract top-level property keys from a translation file. Handles lines like:
 *   "some.key": "value",
 *   someKey: "value",
 * Ignores nested objects (current translation files are flat string maps).
 */
function extractKeys(src) {
  const keys = [];
  // match either quoted or bare identifier keys at the start of a line
  const re = /^\s*(?:"([^"]+)"|([a-zA-Z0-9_.$-]+))\s*:\s*["`']/gm;
  let m;
  while ((m = re.exec(src)) !== null) {
    keys.push(m[1] ?? m[2]);
  }
  return keys;
}

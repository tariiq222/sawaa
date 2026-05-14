#!/usr/bin/env node
// Design-system lint: enforces Glass/DS discipline in app/ and components/.
//
// Ratchet mode (default): reads scripts/design-lint-baseline.json of known
// violations and fails only on NEW ones introduced by the current change.
// Run `npm run lint:design -- --update-baseline` after intentional migration.

import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const BASELINE_PATH = join(__dirname, 'design-lint-baseline.json');

const SCAN_DIRS = ['app', 'components'];
const SKIP_DIRS = new Set(['node_modules', '__tests__', '.expo']);
const HEX_IGNORE = new Set(['#FFFFFF', '#FFF', '#fff', '#ffffff', '#000', '#000000']);

const args = new Set(process.argv.slice(2));
const UPDATE_BASELINE = args.has('--update-baseline');

const violations = [];

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else if (/\.(tsx|ts)$/.test(entry)) yield full;
  }
}

function push(file, line, rule, detail, level) {
  violations.push({
    file: relative(ROOT, file).split(sep).join('/'),
    line,
    rule,
    detail,
    level,
  });
}

function lintFile(file) {
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');

  lines.forEach((raw, idx) => {
    const line = raw.replace(/\/\/.*$/, '');
    const lineNum = idx + 1;

    const hexMatches = line.match(/#[0-9a-fA-F]{3,8}\b/g);
    if (hexMatches) {
      for (const hex of hexMatches) {
        if (HEX_IGNORE.has(hex)) continue;
        push(file, lineNum, 'no-hex-color', hex, 'error');
      }
    }

    if (/['"]row-reverse['"]/.test(line)) {
      push(file, lineNum, 'no-literal-row-reverse', 'row-reverse', 'error');
    }

    if (/from ['"]@\/theme\/components\/Themed/.test(line)) {
      push(file, lineNum, 'legacy-themed-import', 'Themed*', 'warning');
    }
  });
}

for (const dir of SCAN_DIRS) {
  const base = join(ROOT, dir);
  if (!existsSync(base)) continue;
  for (const file of walk(base)) lintFile(file);
}

function key(v) {
  return `${v.file}:${v.line}:${v.rule}:${v.detail}`;
}

if (UPDATE_BASELINE) {
  const sorted = [...violations].sort((a, b) => key(a).localeCompare(key(b)));
  writeFileSync(
    BASELINE_PATH,
    JSON.stringify({ generated: new Date().toISOString().slice(0, 10), violations: sorted }, null, 2) + '\n',
  );
  console.log(`design-lint: baseline updated — ${sorted.length} entries written to ${relative(ROOT, BASELINE_PATH)}`);
  process.exit(0);
}

let baseline = { violations: [] };
if (existsSync(BASELINE_PATH)) {
  try {
    baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  } catch (err) {
    console.error(`design-lint: baseline corrupt (${err.message}) — treating as empty`);
  }
}
const baselineKeys = new Set(baseline.violations.map(key));

const newErrors = [];
const newWarnings = [];
for (const v of violations) {
  if (baselineKeys.has(key(v))) continue;
  if (v.level === 'error') newErrors.push(v);
  else newWarnings.push(v);
}

function printGroup(label, items, color) {
  if (!items.length) return;
  console.log(`\n${color}${label} (${items.length})\x1b[0m`);
  for (const v of items) {
    const hint =
      v.rule === 'no-hex-color'
        ? `hex color "${v.detail}" — use tokens from @/theme/glass (C.*)`
        : v.rule === 'no-literal-row-reverse'
          ? `literal "${v.detail}" — use dir.row / dir.rowReverse from useDir()`
          : v.rule === 'legacy-themed-import'
            ? `legacy Themed* import — migrate to Glass primitives`
            : v.rule;
    console.log(`  ${v.file}:${v.line}  ${hint}`);
  }
}

printGroup('New warnings', newWarnings, '\x1b[33m');
printGroup('New errors', newErrors, '\x1b[31m');

const baselineSize = baseline.violations.length;
const total = violations.length;
console.log(
  `\ndesign-lint: ${newErrors.length} new error(s), ${newWarnings.length} new warning(s) ` +
    `(baseline: ${baselineSize}, total in code: ${total})`,
);
if (newErrors.length === 0 && newWarnings.length === 0 && total < baselineSize) {
  console.log(
    `  note: code has fewer violations than baseline — run \`npm run lint:design -- --update-baseline\` to shrink it.`,
  );
}

if (newErrors.length > 0) process.exit(1);

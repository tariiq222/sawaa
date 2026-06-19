import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import zlib from "node:zlib"
import { describe, expect, it } from "vitest"

type DebtRuleId =
  | "vacuousTrueFallback"
  | "bodyVisibleFallback"
  | "optionalRequiredClick"
  | "unjustifiedWaitForTimeout"

type DebtFinding = {
  ruleId: DebtRuleId
  file: string
  line: number
  snippet: string
  fingerprint: string
  guidance: string
}

type DebtBudget = Record<DebtRuleId, number>

const dashboardRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)
const e2eRoot = path.join(dashboardRoot, "e2e")

const RULE_GUIDANCE: Record<DebtRuleId, string> = {
  bodyVisibleFallback:
    "استبدل تحقق body visible بتوقع على عنوان/نص/دور/حالة مميزة للصفحة المطلوبة.",
  optionalRequiredClick:
    "لا تجعل النقر المطلوب اختيارياً؛ استخدم expect(locator).toBeVisible() ثم click، أو أضف تعليق E2E-CONTRACT: allow-optional-click مع سبب واضح للحالة الاختيارية.",
  unjustifiedWaitForTimeout:
    "استبدل waitForTimeout بانتظار مبني على locator أو URL أو response. إن كان ضرورياً جداً أضف تعليق E2E-CONTRACT: allow-wait-for-timeout مع السبب.",
  vacuousTrueFallback:
    "أزل || true من التوقعات لأنه يحول الاختبار إلى false positive حتى عند فشل الشرط الحقيقي.",
}

const BASELINE_FINGERPRINTS_B64 = [
  "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",
]

function decodeBaselineFingerprints() {
  return new Set(
    JSON.parse(
      zlib
        .gunzipSync(Buffer.from(BASELINE_FINGERPRINTS_B64.join(""), "base64"))
        .toString("utf8")
    ) as string[]
  )
}

const BASELINE_FINGERPRINTS = decodeBaselineFingerprints()

function listTypeScriptFiles(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const absolutePath = path.join(dir, entry.name)
      if (entry.isDirectory()) return listTypeScriptFiles(absolutePath)
      return entry.isFile() && entry.name.endsWith(".ts") ? [absolutePath] : []
    })
    .sort()
}

function lineStarts(source: string) {
  const starts = [0]
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\n") starts.push(index + 1)
  }
  return starts
}

function lineAt(starts: number[], index: number) {
  let low = 0
  let high = starts.length - 1
  while (low <= high) {
    const mid = (low + high) >> 1
    if (starts[mid] <= index) low = mid + 1
    else high = mid - 1
  }
  return high + 1
}

function blankPreservingNewlines(text: string) {
  return text.replace(/[^\n\r]/g, " ")
}

function stripCommentsForScan(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, blankPreservingNewlines)
    .replace(/\/\/[^\n\r]*/g, blankPreservingNewlines)
}

function normalizeSnippet(snippet: string) {
  return snippet.replace(/\s+/g, " ").trim().slice(0, 300)
}

function hashSnippet(snippet: string) {
  return crypto.createHash("sha256").update(snippet).digest("hex").slice(0, 16)
}

function fingerprintContext(
  scannedSource: string,
  index: number,
  length: number
) {
  return normalizeSnippet(
    scannedSource.slice(
      Math.max(0, index - 80),
      Math.min(scannedSource.length, index + length + 80)
    )
  )
}

function hasAllowMarker(source: string, index: number, marker: string) {
  const before = source.slice(Math.max(0, index - 300), index)
  const lineEnd = source.indexOf("\n", index)
  const currentLine = source.slice(
    index,
    lineEnd === -1 ? index + 300 : lineEnd
  )
  return new RegExp(`E2E-CONTRACT:\\s*${marker}\\b`).test(
    `${before}\n${currentLine}`
  )
}

function addFinding(
  findings: DebtFinding[],
  ruleId: DebtRuleId,
  file: string,
  scannedSource: string,
  starts: number[],
  index: number,
  matchText: string
) {
  const line = lineAt(starts, index)
  const snippet = normalizeSnippet(matchText)
  const context = fingerprintContext(scannedSource, index, matchText.length)
  findings.push({
    ruleId,
    file,
    line,
    snippet,
    fingerprint: `${ruleId}:${file}:${hashSnippet(context)}`,
    guidance: RULE_GUIDANCE[ruleId],
  })
}

function scanRule(
  findings: DebtFinding[],
  ruleId: DebtRuleId,
  file: string,
  originalSource: string,
  scannedSource: string,
  starts: number[],
  regex: RegExp,
  allowMarker?: "allow-optional-click" | "allow-wait-for-timeout"
) {
  let match: RegExpExecArray | null
  while ((match = regex.exec(scannedSource))) {
    if (
      allowMarker &&
      hasAllowMarker(originalSource, match.index, allowMarker)
    ) {
      continue
    }
    addFinding(
      findings,
      ruleId,
      file,
      scannedSource,
      starts,
      match.index,
      match[0]
    )
  }
}

function scanE2eFile(absolutePath: string): DebtFinding[] {
  const file = path
    .relative(dashboardRoot, absolutePath)
    .replaceAll(path.sep, "/")
  const source = fs.readFileSync(absolutePath, "utf8")
  const scannedSource = stripCommentsForScan(source)
  const starts = lineStarts(source)
  const findings: DebtFinding[] = []

  scanRule(
    findings,
    "vacuousTrueFallback",
    file,
    source,
    scannedSource,
    starts,
    /\|\|\s*true\b/g
  )
  scanRule(
    findings,
    "bodyVisibleFallback",
    file,
    source,
    scannedSource,
    starts,
    /locator\(\s*['"]body['"]\s*\)[\s\S]{0,180}\.(?:isVisible|toBeVisible)\s*\(/g
  )
  scanRule(
    findings,
    "bodyVisibleFallback",
    file,
    source,
    scannedSource,
    starts,
    /expect\(\s*bodyVisible\b/g
  )
  scanRule(
    findings,
    "optionalRequiredClick",
    file,
    source,
    scannedSource,
    starts,
    /\.click\s*\([\s\S]{0,240}?\)\s*\.catch\s*\(/g,
    "allow-optional-click"
  )
  scanRule(
    findings,
    "optionalRequiredClick",
    file,
    source,
    scannedSource,
    starts,
    /\bif\s*\([\s\S]{0,320}?(?:\.isVisible\s*\(|\.isEnabled\s*\(|\.count\s*\()[\s\S]{0,320}?\)\s*\{[\s\S]{0,700}?\.click\s*\(/g,
    "allow-optional-click"
  )
  scanRule(
    findings,
    "unjustifiedWaitForTimeout",
    file,
    source,
    scannedSource,
    starts,
    /\bwaitForTimeout\s*\(/g,
    "allow-wait-for-timeout"
  )

  return findings
}

function summarize(fingerprints: Iterable<string>): DebtBudget {
  const summary: DebtBudget = {
    bodyVisibleFallback: 0,
    optionalRequiredClick: 0,
    unjustifiedWaitForTimeout: 0,
    vacuousTrueFallback: 0,
  }
  for (const fingerprint of fingerprints) {
    summary[fingerprint.split(":", 1)[0] as DebtRuleId] += 1
  }
  return summary
}

function formatNewDebtMessage(newFindings: DebtFinding[]) {
  const details = newFindings
    .slice(0, 80)
    .map(
      (finding) =>
        `${finding.file}:${finding.line} [${finding.ruleId}] ${finding.guidance}\n  ${finding.snippet}\n  fingerprint: ${finding.fingerprint}`
    )
    .join("\n")

  return [
    "ظهرت بصمات جديدة لأنماط Playwright ضعيفة في apps/dashboard/e2e.",
    "لا يمكن إخفاء دين جديد بإزالة دين قديم؛ يجب إصلاح النمط الجديد أو إضافة allow marker مبرر ومحدود.",
    "Markers المسموحة: E2E-CONTRACT: allow-wait-for-timeout و E2E-CONTRACT: allow-optional-click.",
    "",
    "المواقع الجديدة:",
    details,
  ].join("\n")
}

describe("dashboard e2e contract", () => {
  it("documents the current weak-pattern fingerprint baseline", () => {
    expect({
      fingerprintCount: BASELINE_FINGERPRINTS.size,
      budget: summarize(BASELINE_FINGERPRINTS),
    }).toMatchInlineSnapshot(`
      {
        "budget": {
          "bodyVisibleFallback": 31,
          "optionalRequiredClick": 38,
          "unjustifiedWaitForTimeout": 23,
          "vacuousTrueFallback": 8,
        },
        "fingerprintCount": 100,
      }
    `)
  })

  it("fails when a new weak-pattern fingerprint appears", () => {
    const findings = listTypeScriptFiles(e2eRoot).flatMap(scanE2eFile)
    const currentFingerprints = new Set(
      findings.map((finding) => finding.fingerprint)
    )
    const newFindings = findings.filter(
      (finding) => !BASELINE_FINGERPRINTS.has(finding.fingerprint)
    )

    expect(currentFingerprints.size).toBeLessThanOrEqual(
      BASELINE_FINGERPRINTS.size
    )
    expect(newFindings, formatNewDebtMessage(newFindings)).toEqual([])
  })
})

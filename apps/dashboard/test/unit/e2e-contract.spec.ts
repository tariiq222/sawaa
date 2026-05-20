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
  "H4sIAAAAAAAAE7Wd23ImuW3H38XXWZskAB58myo/QMqVXKRyAeJgKzs72szBid8+oMZ7mvXXTbV6pSrpm5rSr9kkCPxBgt3/+bv5",
  "rH//96ePT/Od/YnfvZss3/7Riv3B3z3/78c/zOfnb5/e/+XHD98Ivxd79836399//N7k958+/lFRPbXS0WCOqfq7f3k19YPxJ/sl",
  "FcwbjkFsJSXyfg+VKncaOosOVmzj1dSPgf2sP/LaNCbMPCypVGpv5XGeM246u7TkMOjNvIICo9FMilISvpU3K/HsjR3SzFXtrTxp",
  "s3er2KSmkni+laeUKUNxTmV0wivj8e7p46dfGk2yqZAHQkWvAPdAcWL1WoTi7o3rlTv/NZSozoSlpo6apOR7oG+fM9/z37+z95++",
  "eXr/t+cnsY8/dW2dwjVB60w1jyu98JgtFbERILUhZdY72QV99JwKYC/Us9zKHjTRZy3eZQC/3p8esSVz8szsMwv1cicbR+o+WlGl",
  "FiZzxfgesgm05CHgRJ4N/E72amux6BQlBE5XpvdDNlPKpUWIKMWbtCv+9zHbqEnXTKV6AoU72RGEZCaYEYOg5HrFTj5+4k+fP37z",
  "v88fvv2lN4Uy1Cn5NMrYr4SQR+gwPUlQ52TnwZ1vRFPCmSHnmhJXt9fLkcfoFpG0jtk5J+utXpnvj9A94yThlHILH5uuTJuHaKwK",
  "UmMuQipcr8z2R+jhITJygaJuJfTQjeiY6iERklMh60jpRnTo1JE4epkFOuOddh3NnX0iEqXJNM+NT0L4/uX5w5P9/OMvlRLUNHz5",
  "0+FVdrz1BrNGrIUhvYfJGaZzr7HBHMmRso2RM3LlW5hunEfFygkT7nhlefcUbvLH32/tySOaWgofVkK/9VTa3LjfI5qZJ4pJlDpX",
  "5HKurw5pr+43te/5w6fvXog/+/xLaiQnEDeNWrSNUs699ha1JYQsrEvoiG1kAlvUuVLREiGmQmoVz0dni/rqfrXv+OndN5/su+/f",
  "hYn/6t8/kwimNGrj0NiofC4RdsETZ2vh/qEp95J3wN+/e/672c8+/bIPVpafYSIJpXD851HwlPjqeXlKxJzJNEvTEvpoI706Jb5+",
  "5D98eP7wj18v8eLnCc8IU2/QwCLtb3RunIewmS2FkioZxXSn9w5gBSKSa0NASDk+nsJ+EKQ/fvhqIFJD7DEG3QW0nRvLCW9y2HEW",
  "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",
  "A34w9jHqiAAA",
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
          "bodyVisibleFallback": 78,
          "optionalRequiredClick": 145,
          "unjustifiedWaitForTimeout": 159,
          "vacuousTrueFallback": 23,
        },
        "fingerprintCount": 405,
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

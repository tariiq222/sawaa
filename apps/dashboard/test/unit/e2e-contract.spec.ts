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
  "H4sIAAAAAAAAE62Yy45bNwyG3yXrJqEuFKVsC/QBiqKbogtSpBJjPOPp2E6Rty89uTUTwDr2sRfnCDDwQbzo56/z1yvZ6ac/N/uNbO033m6F",
  "+907i/Z2bHf/7t/Kbne3eXj/bfG6Pxkf7PXp3zf7R+tvDvt3yQbl1pAtAuCor365BRULV2wqURtrpnYxde/Yo37jkRhjDtwMtBektbxaQEvh",
  "QmCYmOJaHgcRT2IYnWCkhmt5UpClEo8EEoraWl5PQphVY01lxKCreSS1WsnUC0RguYK33ewPPzYNmGgKLaeSR0npmiL/DL24E/t2Yw+Hb+8f",
  "404F2kgDsY3SuYZ1NDXokGJWqBBJ5l14lmY2AC0KVC6Z47wmZ2nDOLSSC0OG3ClPaXb/uN19Mvvf6kfiSV9CkowdIeqY9+CUeHE1psQcApqG",
  "Thpb6/EGxIvzuHn4uNt0+754sUOgnKtvro6elOZZnPCESTl0a9ZSKmnegxPexfE+8qf75zb8unih1NUqg4xaQgygq3mNQoTILtVK6Kqwlndx",
  "vE98eNasL+8X1U3VpSDUjj6a6lraCKgwstVCQbXPZ/t52qWR7u3wGfd18UIPGrYCQ10MUrU+1vK0gtYAJJhq8Ryu5wmYR1wka4Czzmh/v7v7",
  "8vwuTiQDknAaAJ35lK7d42Gze+Dt7/bPcfNk+ut2c4Vhg0Sjofj0rZKercGl3JfmqpaKhLFGGxU13IDY3F71MCJCFkVcT5Qx1HWqijcKu9G6",
  "ivizO+g5ZlKChhVLTUs2enZqgu+tJ29rMg+clxTnvN/QYWLkFj2IdljNq8aMGLRTkYoY1/J4VP8FaUBYrPAC3nRiXpHDKTNAKMESu66e2lJu",
  "w6zSRxmi0v1W0m/BzD6DRw+1aiW1mG7BpBFLUimt1R5Svsk+pXUXN6VGFH3E0C2YHV3Sos+r1lw74xLBnHiRKzppQnQ9C9Q5avC7T2pLcjkj",
  "5jKA2mDpvRbTBcSJI7ki6gnxiqhnxJtH3YQBSQP6tbmVRafxrNu5IotneX6frYE0t2GnyJec7LO8K2pyltdqKObxIkdUobKAN/FPYBjyaM0G",
  "I1FYMlsnxBItD9aEMTBLWFKTGbFUU3SHwgRDnr8OrCQ250HimJKU6Jq7niiZ3Ci7GR2darcl1mfmbIGJ62iMjEJjidIe9/b0+fn6nh/4vZ2O",
  "4PcRk/309aA5UmbC8zbgg20fTzA+Hj48ZyxzteQljblDeZ4lH7kfd8f9H0/Hi79buB0Z7AeMVA0K9XU0N9ij+LbAWgREndLmU46kqbbeDTlk",
  "nEc7mR+tkWnsQyQEGwuyN9HRQN4TWWNzty21xSnvrKr0Gv36UyyH5naz5CltpimueiFBrn78NRCs5Y3mSpKxqXuk7tfaV3//B7vq6xBVFwAA",
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
          "optionalRequiredClick": 35,
          "unjustifiedWaitForTimeout": 0,
          "vacuousTrueFallback": 8,
        },
        "fingerprintCount": 74,
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

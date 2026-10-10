/**
 * Focused real-ESM receipt renderer diagnostic (Node 22.15+). No database, Redis, or network.
 * Run: node apps/backend/test/receipt-renderer-real.mjs
 * Optional RECEIPT_DEPENDENCY_ROOT points to another installed checkout.
 * RECEIPT_REUSE_FONTS=1 replays the original cache behavior (expected RED).
 * RECEIPT_COMPARE_FRESH=1 compares extracted text and all page pixels against
 * the original renderer in a fresh process (requires pdftotext/pdftoppm).
 * Uses the production template and fonts; bypasses Jest's fake renderer mapper.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire, registerHooks } from "node:module";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const dependencyRoot = process.env.RECEIPT_DEPENDENCY_ROOT || root;
const requireDependency = createRequire(
  path.join(dependencyRoot, "package.json"),
);
const moduleUrl = (name) => pathToFileURL(requireDependency.resolve(name)).href;
const rendererUrl = moduleUrl("@react-pdf/renderer");
const reactUrl = moduleUrl("react");
if (process.env.RECEIPT_TRACE_GLYPHS === "1") {
  registerHooks({
    load(url, context, nextLoad) {
      const result = nextLoad(url, context);
      if (url.endsWith("/@react-pdf/textkit/lib/textkit.js")) {
        const source = String(result.source).replace(
          "if (addedGlyphs.has(glyph.id))",
          `if (!glyph) console.error(JSON.stringify({ diagnostic: 'missing-glyph', string: line.string, index, runs: line.runs.map(r => ({start:r.start,end:r.end,stringIndices:r.stringIndices,glyphIndices:r.glyphIndices,glyphs:r.glyphs.map(g=>({id:g.id,codePoints:g.codePoints}))})) }));
            if (addedGlyphs.has(glyph.id))`,
        );
        return { ...result, source };
      }
      return result;
    },
  });
}
const { transform } = await import(moduleUrl("esbuild"));
const React = (await import(reactUrl)).default;
const { pdf, Font } = await import(rendererUrl);
const templateFile = path.resolve(
  here,
  "../src/modules/finance/issue-invoice-receipt/invoice-pdf.template.tsx",
);
const template = (await readFile(templateFile, "utf8"))
  .replaceAll("'@react-pdf/renderer'", JSON.stringify(rendererUrl))
  .replaceAll("'react'", JSON.stringify(reactUrl));
const { code } = await transform(template, {
  loader: "tsx",
  format: "esm",
  jsx: "transform",
  sourcefile: templateFile,
});
const { InvoicePdf } = await import(
  "data:text/javascript;base64," + Buffer.from(code).toString("base64")
);
const fonts = path.resolve(here, "../assets/fonts");
const helperFile = path.resolve(
  here,
  "../src/modules/finance/issue-invoice-receipt/with-fresh-invoice-fonts.ts",
);
const helperCode = (
  await transform(await readFile(helperFile, "utf8"), {
    loader: "ts",
    format: "esm",
  })
).code;
const { withFreshInvoiceFonts } = await import(
  "data:text/javascript;base64," + Buffer.from(helperCode).toString("base64")
);
const reuseFonts = process.env.RECEIPT_REUSE_FONTS === "1";
if (reuseFonts)
  Font.register({
    family: "IBMPlexArabic",
    fonts: [
      { src: path.join(fonts, "IBMPlexSansArabic-Regular.ttf") },
      {
        src: path.join(fonts, "IBMPlexSansArabic-Bold.ttf"),
        fontWeight: "bold",
      },
    ],
  });
const renderPdf = (data) => {
  const render = async () => {
    const instance = pdf(React.createElement(InvoicePdf, { data }));
    const buffer = Buffer.from(await (await instance.toBlob()).arrayBuffer());
    assert.equal(buffer.subarray(0, 4).toString("ascii"), "%PDF");
    assert.ok(buffer.length > 1000);
    return buffer;
  };
  return reuseFonts ? render() : withFreshInvoiceFonts(Font, fonts, render);
};
const base = {
  invoiceNumber: 42,
  invoiceId: "synthetic-receipt-0001",
  issuedAt: new Date("2026-10-08T09:00:00Z"),
  paidAt: new Date("2026-10-08T09:05:00Z"),
  sellerNameAr: "مركز سواء",
  sellerVatNumber: null,
  sellerAddress: "الرياض",
  logoUrl: null,
  brandColor: null,
  clientName: "عميل تجريبي",
  serviceName: "استشارة أسرية",
  subtotal: 10000,
  discountAmt: 0,
  vatAmt: 0,
  total: 10000,
  currency: "SAR",
  paymentMethod: "CASH",
  qrDataUrl: null,
};
const cases = [
  ["arabic-base", {}],
  ...[
    ["lam-alef", "لا"],
    ["lam-hamza-above", "لأ"],
    ["lam-hamza-below", "لإ"],
    ["lam-madda", "لآ"],
    ["allah", "الله"],
    ["latin", "عميل ABC"],
    ["digits", "عميل 123"],
    ["emoji", "عميل 😀"],
    ["dash", "عميل —"],
    ["parentheses", "عميل (ABC)"],
  ].map(([name, clientName]) => ["minimal-client-" + name, { clientName }]),
  [
    "lam-alef-ligatures",
    {
      clientName: "لا لأ لإ لآ الله",
      serviceName: "جلسة للاختبار لا علاقة لها ببيانات حقيقية",
    },
  ],
  [
    "combining-marks",
    {
      clientName: "عَمِيلٌ تَجْرِيبِيٌّ",
      serviceName: "إِرْشَادٌ أُسَرِيٌّ وَتَوَاصُلٌ",
    },
  ],
  [
    "mixed-arabic-latin",
    {
      clientName: "عميل Demo 123 (ABC)",
      serviceName: "جلسة Test 2026 — 50% / استشارة",
    },
  ],
  [
    "wrapped-long-text",
    {
      clientName: "عميل تجريبي للاختبار ".repeat(12),
      serviceName: "استشارة أسرية تجريبية مع ABC 123 ".repeat(24),
    },
  ],
  [
    "supplementary-unicode",
    { clientName: "عميل 😀 تجريبي", serviceName: "جلسة 👨‍👩‍👧‍👦 تجريبية 𝟙 𐐀" },
  ],
  [
    "direction-controls",
    {
      clientName: "عميل \u2066ABC 123\u2069 تجريبي",
      serviceName: "جلسة \u200fاختبار\u200e Test",
    },
  ],
];
let failures = 0;
const selectedCases = process.env.RECEIPT_CASE
  ? cases.filter(([name]) => name === process.env.RECEIPT_CASE)
  : cases;
const started = performance.now();
async function checkCase([name, overrides], phase) {
  try {
    const buffer = await renderPdf({ ...base, ...overrides });
    const evidence = {};
    if (
      process.env.RECEIPT_COMPARE_FRESH === "1" ||
      process.env.RECEIPT_CONTENT_HASH === "1"
    ) {
      const text = spawnSync("pdftotext", ["-enc", "UTF-8", "-", "-"], {
        input: buffer,
      });
      const pixels = spawnSync("pdftoppm", ["-r", "72", "-"], {
        input: buffer,
        maxBuffer: 20 * 1024 * 1024,
      });
      assert.equal(text.status, 0, text.stderr.toString());
      assert.equal(pixels.status, 0, pixels.stderr.toString());
      assert.ok(text.stdout.length > 100);
      assert.ok(pixels.stdout.length > 1000);
      evidence.textHash = createHash("sha256")
        .update(text.stdout)
        .digest("hex");
      evidence.visualHash = createHash("sha256")
        .update(pixels.stdout)
        .digest("hex");
      if (process.env.RECEIPT_COMPARE_FRESH === "1") {
        const fresh = spawnSync(
          process.execPath,
          [fileURLToPath(import.meta.url)],
          {
            env: {
              ...process.env,
              RECEIPT_CASE: name,
              RECEIPT_REUSE_FONTS: "1",
              RECEIPT_COMPARE_FRESH: "",
              RECEIPT_CONTENT_HASH: "1",
            },
            encoding: "utf8",
            timeout: 30_000,
          },
        );
        assert.equal(fresh.status, 0, fresh.stdout + fresh.stderr);
        const baseline = fresh.stdout
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line))
          .find((row) => row.case === name);
        assert.equal(
          evidence.textHash,
          baseline.textHash,
          "extracted text changed versus original fresh-process renderer",
        );
        assert.equal(
          evidence.visualHash,
          baseline.visualHash,
          "rendered pixels changed versus original fresh-process renderer",
        );
        evidence.matchesOriginalFreshProcess = true;
      }
    }
    console.log(
      JSON.stringify({
        case: name,
        phase,
        result: "PASS",
        bytes: buffer.length,
        ...evidence,
      }),
    );
  } catch (error) {
    failures += 1;
    console.log(
      JSON.stringify({
        case: name,
        phase,
        result: "FAIL",
        error: error.message,
        stack: error.stack?.split("\n").slice(0, 7),
      }),
    );
  }
}
for (const fixture of selectedCases) await checkCase(fixture, "sequential");
const sequentialMs = performance.now() - started;
let concurrentMs;
if (!reuseFonts) {
  const concurrentStart = performance.now();
  await Promise.all(
    selectedCases.map((fixture) => checkCase(fixture, "concurrent")),
  );
  concurrentMs = performance.now() - concurrentStart;
  const rejected = withFreshInvoiceFonts(Font, fonts, async () => {
    throw new Error("synthetic-render-failure");
  });
  const afterFailure = renderPdf({ ...base, clientName: "لا" });
  await assert.rejects(rejected, /synthetic-render-failure/);
  await afterFailure;
  console.log(
    JSON.stringify({ case: "gate-released-after-failure", result: "PASS" }),
  );
}
console.log(
  JSON.stringify({
    total: selectedCases.length,
    sequentialMs: Math.round(sequentialMs),
    concurrentMs: concurrentMs && Math.round(concurrentMs),
    failures,
    reuseFonts,
    renderer: rendererUrl,
  }),
);
process.exitCode = failures ? 1 : 0;

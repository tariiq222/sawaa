import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

// CSP `connect-src` test for apps/dashboard/next.config.mjs.
//
// Why this test exists: the Sentry SDK POSTs events to the Sentry ingest host
// declared in the `withSentryConfig` `url` option (and via the DSN). When the
// dashboard ships a Content-Security-Policy that omits that host, the browser
// blocks the POST and the dashboard silently loses its error reports — the
// classic "Sentry is configured but no events arrive" failure mode.
//
// The test reads the next.config.mjs source as text so it works without
// importing @sentry/nextjs webpack hooks into the vitest jsdom env. The CSP is
// emitted as a string literal, so substring matching on the configured
// directive is the right shape for this assertion.

describe("next.config.mjs Content-Security-Policy", () => {
  const configPath = resolve(__dirname, "../../../../next.config.mjs")
  const source = readFileSync(configPath, "utf8")

  // Extract the Content-Security-Policy value (between `value: [` and `]`).
  // We rely on a stable literal shape — CSP is constructed inline above.
  const cspValueMatch = source.match(
    /key:\s*"Content-Security-Policy"[\s\S]*?value:\s*\[([\s\S]*?)\]/,
  )
  const cspValue = cspValueMatch?.[1] ?? ""

  it("declares a Content-Security-Policy header", () => {
    expect(cspValue).not.toBe("")
  })

  it("includes a connect-src directive", () => {
    expect(cspValue).toMatch(/connect-src\s+/)
  })

  // The configured Sentry ingest host. Mirrors `withSentryConfig({ url: ... })`
  // and `SENTRY_URL` in .env. Tests fail if the host disappears from CSP.
  it("permits the configured Sentry ingest host in connect-src", () => {
    const connectSrcLine = cspValue
      .split(/[\n;,]/)
      .map((line) => line.trim().replace(/^"|"$/g, ""))
      .find((line) => line.startsWith("connect-src"))
    expect(connectSrcLine, "connect-src directive present").toBeDefined()
    expect(connectSrcLine).toContain("https://errors.webvue.pro")
  })

  it("does not loosen connect-src with a bare wildcard host", () => {
    const connectSrcLine = cspValue
      .split(/[\n;,]/)
      .map((line) => line.trim().replace(/^"|"$/g, ""))
      .find((line) => line.startsWith("connect-src"))
    expect(connectSrcLine).toBeDefined()
    // Tokenise and reject any token that is a bare "*" or "https://*"
    // (scheme-wildcards). Scoped subdomains like `https://*.sawaa.sa` are
    // intentional and remain — this test only catches a wholesale loosening
    // to "anything goes" via a wildcard.
    const tokens = connectSrcLine!.split(/\s+/).slice(1)
    expect(tokens).not.toContain("*")
    expect(tokens).not.toContain("https://*")
  })
})
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Sentry init PII-disabling test for apps/dashboard.
//
// Why this test exists: @sentry/nextjs has historically defaulted `sendDefaultPii`
// to `true`, which causes the SDK to attach client IP, user email/id, and other
// PII to every event by default. The dashboard is single-tenant for مركز سواء and
// handles sensitive family-counseling data, so the default must be EXPLICITLY
// disabled in every entry point the SDK is initialised from.
//
// Each spec below vi.mocks `@sentry/nextjs`, captures the `init` call options,
// and asserts `sendDefaultPii === false`. The init files run Sentry.init() at
// module-load, so the import must come AFTER the mock.

type InitOptions = Record<string, unknown>

const initCalls: InitOptions[] = []

vi.mock("@sentry/nextjs", () => ({
  init: (options: InitOptions) => {
    initCalls.push(options)
  },
  captureRouterTransitionStart: () => undefined,
}))

afterEach(() => {
  initCalls.length = 0
  vi.resetModules()
})

describe("dashboard Sentry init options", () => {
  beforeEach(() => {
    // Clear captured calls and re-prime env so DSN resolution is deterministic.
    initCalls.length = 0
    delete process.env.NEXT_PUBLIC_SENTRY_DSN
    delete process.env.SENTRY_DSN
  })

  it("sentry.server.config.ts disables default PII collection", async () => {
    await import("@/sentry.server.config")
    expect(initCalls).toHaveLength(1)
    expect(initCalls[0]).toMatchObject({ sendDefaultPii: false })
  })

  it("sentry.edge.config.ts disables default PII collection", async () => {
    await import("@/sentry.edge.config")
    expect(initCalls).toHaveLength(1)
    expect(initCalls[0]).toMatchObject({ sendDefaultPii: false })
  })

  it("instrumentation-client.ts disables default PII collection", async () => {
    await import("@/instrumentation-client")
    expect(initCalls).toHaveLength(1)
    expect(initCalls[0]).toMatchObject({ sendDefaultPii: false })
  })
})
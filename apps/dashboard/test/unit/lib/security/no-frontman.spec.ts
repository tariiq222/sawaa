import { readFileSync } from "node:fs"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"

// Frontman (a dev-time browser AI agent) shipped in production builds and
// exposed unauthenticated file read/write tools at /frontman/tools. It was
// removed entirely; these guards keep it from coming back.

vi.mock("@sentry/nextjs", () => ({
  withSentryConfig: (config: unknown) => config,
}))

const dashboardDir = path.resolve(__dirname, "../../../..")
const read = (file: string) => readFileSync(path.join(dashboardDir, file), "utf8")

afterEach(() => vi.unstubAllEnvs())

describe("Frontman removal", () => {
  it("is not a dashboard dependency", () => {
    const pkg = JSON.parse(read("package.json"))
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    expect(Object.keys(deps).filter((name) => name.includes("frontman"))).toEqual([])
  })

  it.each(["middleware.ts", "instrumentation.ts", "next.config.mjs"])(
    "%s does not wire Frontman",
    (file) => {
      expect(read(file).toLowerCase()).not.toContain("frontman")
    },
  )

  it.each(["development", "production"] as const)(
    "next.config emits no /frontman header routes in %s",
    async (environment) => {
      vi.resetModules()
      vi.stubEnv("NODE_ENV", environment)
      const config = (await import("../../../../next.config.mjs")).default
      const headers = await config.headers!()
      expect(headers.map((entry) => entry.source).filter((source) => source.includes("frontman"))).toEqual([])
    },
  )
})

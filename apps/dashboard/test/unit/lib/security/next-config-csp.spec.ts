import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@sentry/nextjs", () => ({
  withSentryConfig: (config: unknown) => config,
}))

async function loadConfig(environment: "development" | "production") {
  vi.resetModules()
  vi.stubEnv("NODE_ENV", environment)
  const imported = await import("../../../../next.config.mjs")
  return imported.default
}

async function getCspHeaders(environment: "development" | "production") {
  const config = await loadConfig(environment)
  if (typeof config.headers !== "function") throw new Error("next.config.mjs did not expose headers()")
  const headers = await config.headers()
  const normal = headers.find((entry) => entry.source === "/(.*)")
  return normal?.headers.find((header) => header.key === "Content-Security-Policy")?.value ?? ""
}

function imageSource(policy: string) {
  return policy.split(";").map((directive) => directive.trim()).find((directive) => directive.startsWith("img-src ")) ?? ""
}

function connectSource(policy: string) {
  return policy.split(";").map((directive) => directive.trim()).find((directive) => directive.startsWith("connect-src ")) ?? ""
}

afterEach(() => vi.unstubAllEnvs())

describe("next.config.mjs Content-Security-Policy", () => {
  it("allows only the dashboard loopback origins for development images", async () => {
    const policy = await getCspHeaders("development")
    {
      const imgSrc = imageSource(policy)
      expect(imgSrc).toBe("img-src 'self' data: blob: https: http://localhost:* http://127.0.0.1:*")
      const connectSrc = connectSource(policy)
      expect(connectSrc).toContain("https://errors.webvue.pro")
      const connectTokens = connectSrc.split(/\s+/).slice(1)
      expect(connectTokens).not.toContain("*")
      expect(connectTokens).not.toContain("https://*")
    }
  })

  it("keeps production image sources byte-equivalent to the existing strict policy", async () => {
    const policy = await getCspHeaders("production")
    expect(imageSource(policy)).toBe("img-src 'self' data: blob: https:")
  })
})

import { describe, expect, it } from "vitest"
import {
  dashboardApiProxyRewrite,
  normalizeBackendBaseUrl,
} from "../../../next.config.mjs"

describe("normalizeBackendBaseUrl", () => {
  it("strips a trailing /api/v1 suffix", () => {
    expect(normalizeBackendBaseUrl("http://localhost:5200/api/v1")).toBe(
      "http://localhost:5200"
    )
  })

  it("strips /api/vN regardless of version number", () => {
    expect(normalizeBackendBaseUrl("https://api.sawaa.sa/api/v2")).toBe(
      "https://api.sawaa.sa"
    )
  })

  it("accepts an origin with no version suffix", () => {
    expect(normalizeBackendBaseUrl("http://localhost:5200")).toBe(
      "http://localhost:5200"
    )
  })

  it("trims trailing slashes before stripping the version suffix", () => {
    expect(normalizeBackendBaseUrl("http://localhost:5200/api/v1/")).toBe(
      "http://localhost:5200"
    )
  })

  it("falls back to local backend for empty or non-string values", () => {
    expect(normalizeBackendBaseUrl("")).toBe("http://localhost:5200")
    expect(normalizeBackendBaseUrl("   ")).toBe("http://localhost:5200")
    expect(normalizeBackendBaseUrl(undefined as unknown as string)).toBe(
      "http://localhost:5200"
    )
  })
})

describe("dashboardApiProxyRewrite", () => {
  it("forwards /api/proxy/:path* to backend /api/v1/:path*", () => {
    expect(dashboardApiProxyRewrite("http://localhost:5200/api/v1")).toEqual({
      source: "/api/proxy/:path*",
      destination: "http://localhost:5200/api/v1/:path*",
    })
  })

  it("does not double-prefix /api/v1 when the env already includes it", () => {
    const { destination } = dashboardApiProxyRewrite(
      "https://api.example.test/api/v1/"
    )
    expect(destination).toBe("https://api.example.test/api/v1/:path*")
    expect(destination).not.toContain("/api/v1/api/v1")
  })

  it("still produces /api/v1 when NEXT_PUBLIC_API_URL is origin-only", () => {
    expect(dashboardApiProxyRewrite("http://127.0.0.1:5200").destination).toBe(
      "http://127.0.0.1:5200/api/v1/:path*"
    )
  })
})

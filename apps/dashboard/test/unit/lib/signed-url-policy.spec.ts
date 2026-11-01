import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import {
  MEDIA_SIGNED_URL_TTL_MS,
  MEDIA_URL_REFRESH_MARGIN_MS,
  signedImageQueryOptions,
} from "@/lib/signed-url-policy"

const dashboardDir = path.resolve(__dirname, "../../..")

/**
 * The backend's presigned URL expiry constant. This test intentionally reads
 * the source text instead of importing the backend helper: the dashboard build
 * must not depend on backend internals, while still failing loudly when the
 * mirrored TTL and the backend constant drift apart. The match is anchored to
 * the full declaration line so unrelated edits cannot satisfy it.
 */
function readBackendTtlMs(): number {
  const helper = readFileSync(
    path.join(
      dashboardDir,
      "../../apps/backend/src/modules/media/media-image-url.helper.ts",
    ),
    "utf8",
  )
  const match = helper.match(
    /export const MEDIA_IMAGE_URL_EXPIRY_SECONDS = (\d+)/,
  )
  if (!match) {
    throw new Error(
      "MEDIA_IMAGE_URL_EXPIRY_SECONDS declaration not found in media-image-url.helper.ts — the backend constant moved; update the mirror in lib/signed-url-policy.ts",
    )
  }
  return Number(match[1]) * 1000
}

describe("signed-image URL refresh policy", () => {
  it("mirrors the backend presigned URL expiry constant", () => {
    expect(MEDIA_SIGNED_URL_TTL_MS).toBe(readBackendTtlMs())
  })

  it("keeps the refresh margin below the TTL", () => {
    expect(MEDIA_URL_REFRESH_MARGIN_MS).toBeGreaterThan(0)
    expect(MEDIA_URL_REFRESH_MARGIN_MS).toBeLessThan(MEDIA_SIGNED_URL_TTL_MS)
  })

  it("computes staleTime and refetchInterval as TTL minus margin", () => {
    const expected = MEDIA_SIGNED_URL_TTL_MS - MEDIA_URL_REFRESH_MARGIN_MS
    expect(signedImageQueryOptions.staleTime).toBe(expected)
    expect(signedImageQueryOptions.refetchInterval).toBe(expected)
    expect(signedImageQueryOptions.staleTime).toBe(240_000)
    expect(signedImageQueryOptions.refetchInterval).toBe(240_000)
  })

  it("sets every trigger option so none can be silently dropped", () => {
    expect(signedImageQueryOptions.refetchOnMount).toBe("always")
    expect(signedImageQueryOptions.refetchOnWindowFocus).toBe(true)
    expect(signedImageQueryOptions.refetchIntervalInBackground).toBe(false)
    expect(Object.keys(signedImageQueryOptions).sort()).toEqual(
      [
        "refetchInterval",
        "refetchIntervalInBackground",
        "refetchOnMount",
        "refetchOnWindowFocus",
        "staleTime",
      ].sort(),
    )
  })
})

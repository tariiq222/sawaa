import { afterEach, describe, expect, it, vi } from "vitest"
import { createIdempotencyKey } from "@/lib/idempotency"

const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, "crypto")

afterEach(() => {
  if (originalCrypto) Object.defineProperty(globalThis, "crypto", originalCrypto)
  else Reflect.deleteProperty(globalThis, "crypto")
  vi.restoreAllMocks()
})

describe("createIdempotencyKey", () => {
  it("prefers the native cryptographic UUID", () => {
    const randomUUID = vi.fn(() => "a6a7228a-d975-447a-a739-8983c3ca210d")
    Object.defineProperty(globalThis, "crypto", { configurable: true, value: { randomUUID } })
    expect(createIdempotencyKey()).toBe(randomUUID.mock.results[0]?.value)
    expect(randomUUID).toHaveBeenCalledOnce()
  })

  it("uses secure random bytes when randomUUID is unavailable", () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => bytes.fill(0))
    Object.defineProperty(globalThis, "crypto", { configurable: true, value: { getRandomValues } })
    expect(createIdempotencyKey()).toBe("00000000-0000-4000-8000-000000000000")
    expect(getRandomValues).toHaveBeenCalledOnce()
  })

  it("fails closed when secure random generation is unavailable", () => {
    Object.defineProperty(globalThis, "crypto", { configurable: true, value: undefined })
    expect(() => createIdempotencyKey()).toThrow("Secure random generation")
  })
})

import { describe, expect, it } from "vitest"
import { classifyLoginError, loginErrorMessage } from "@/lib/api/auth-errors"

describe("classifyLoginError", () => {
  it("classifies 401 + 'Invalid credentials' as invalid_credentials", () => {
    expect(
      classifyLoginError({ status: 401, message: "Invalid credentials" }),
    ).toBe("invalid_credentials")
  })

  it("classifies 401 + 'Account is inactive' as account_inactive", () => {
    expect(
      classifyLoginError({ status: 401, message: "Account is inactive" }),
    ).toBe("account_inactive")
  })

  it("classifies 401 + 'Account locked. Try again later.' as account_locked", () => {
    expect(
      classifyLoginError({
        status: 401,
        message: "Account locked. Try again later.",
      }),
    ).toBe("account_locked")
  })

  it("classifies TypeError (fetch failure) as network", () => {
    expect(classifyLoginError(new TypeError("Failed to fetch"))).toBe("network")
  })

  it("classifies HTTP 500 as network", () => {
    expect(classifyLoginError({ status: 500, message: "oops" })).toBe("network")
  })

  it("falls back to invalid_credentials for unknown 401 messages", () => {
    expect(
      classifyLoginError({ status: 401, message: "something weird" }),
    ).toBe("invalid_credentials")
  })

  it("falls back to invalid_credentials for null/undefined error", () => {
    expect(classifyLoginError(null)).toBe("invalid_credentials")
    expect(classifyLoginError(undefined)).toBe("invalid_credentials")
  })
})

describe("loginErrorMessage", () => {
  it("returns Error message when error is an Error instance", () => {
    expect(loginErrorMessage(new Error("Wrong password"))).toBe("Wrong password")
  })

  it("returns message property when error is an object with message", () => {
    expect(loginErrorMessage({ message: "Token expired" })).toBe("Token expired")
  })

  it("returns 'LOGIN_FAILED' when error has no message", () => {
    expect(loginErrorMessage({})).toBe("LOGIN_FAILED")
  })

  it("returns 'LOGIN_FAILED' for null input", () => {
    expect(loginErrorMessage(null)).toBe("LOGIN_FAILED")
  })

  it("returns 'LOGIN_FAILED' for undefined input", () => {
    expect(loginErrorMessage(undefined)).toBe("LOGIN_FAILED")
  })
})

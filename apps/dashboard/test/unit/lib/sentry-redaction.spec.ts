import { describe, expect, it } from "vitest"
import type { ErrorEvent } from "@sentry/nextjs"
import { redactSentryEvent } from "@/lib/security/sentry-redaction"

const REDACTED = "[REDACTED]"

describe("redactSentryEvent", () => {
  it("redacts sensitive data across supported Sentry event sections", () => {
    const event = {
      message: "failed with token=abc123&safe=ok Authorization: Bearer secret-token",
      exception: {
        values: [
          {
            type: "Error",
            value: "OTP failed code=123456",
            stacktrace: {
              frames: [{ vars: { password: "pass", normal: "kept" } }],
            },
          },
        ],
      },
      extra: {
        nested: { apiKey: "api-key", profile: { name: "Sara" } },
      },
      contexts: {
        auth: { refreshToken: "refresh-token", attempt: 1 },
      },
      tags: {
        access: "full",
        feature: "bookings",
      },
      user: {
        id: "user-1",
        email: "sara@example.com",
        token: "user-token",
      },
      request: {
        url: "/api/v1/bookings?accessToken=url-token&status=ok",
        headers: {
          authorization: "Bearer request-token",
          "set-cookie": "ck_refresh=refresh-token",
          accept: "application/json",
        },
      },
      breadcrumbs: [
        {
          message: "submitting password=abc123",
          data: { otp: "654321", label: "login" },
        },
      ],
    } as unknown as ErrorEvent

    const redacted = redactSentryEvent(event)

    expect(redacted.message).toContain(`token=${REDACTED}`)
    expect(redacted.message).toContain(`Authorization: ${REDACTED}`)
    expect(redacted.message).not.toContain("secret-token")
    expect(redacted.message).toContain("safe=ok")
    expect(redacted.exception?.values?.[0]?.value).toBe(`OTP failed code=${REDACTED}`)
    expect(redacted.exception?.values?.[0]?.stacktrace?.frames?.[0]?.vars).toEqual({
      password: REDACTED,
      normal: "kept",
    })
    expect(redacted.extra).toMatchObject({
      nested: { apiKey: REDACTED, profile: { name: "Sara" } },
    })
    expect(redacted.contexts).toMatchObject({
      auth: { refreshToken: REDACTED, attempt: 1 },
    })
    expect(redacted.tags).toMatchObject({ access: REDACTED, feature: "bookings" })
    expect(redacted.user).toMatchObject({
      id: "user-1",
      email: "sara@example.com",
      token: REDACTED,
    })
    expect(redacted.request?.url).toBe(
      `/api/v1/bookings?accessToken=${REDACTED}&status=ok`,
    )
    expect(redacted.request?.headers).toMatchObject({
      authorization: REDACTED,
      "set-cookie": REDACTED,
      accept: "application/json",
    })
    expect(redacted.breadcrumbs?.[0]?.message).toBe(`submitting password=${REDACTED}`)
    expect(redacted.breadcrumbs?.[0]?.data).toMatchObject({
      otp: REDACTED,
      label: "login",
    })
  })

  it("handles circular objects safely", () => {
    const circular: Record<string, unknown> = { token: "secret" }
    circular.self = circular
    const event = { extra: { circular } } as unknown as ErrorEvent

    const redacted = redactSentryEvent(event)

    expect(redacted.extra).toMatchObject({
      circular: { token: REDACTED, self: REDACTED },
    })
  })
})

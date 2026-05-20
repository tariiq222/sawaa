import { describe, expect, it } from "vitest"

import { redactSentryEvent } from "@/lib/security/sentry-redaction"

const REDACTED = "[REDACTED]"

describe("sentry redaction", () => {
  it("redacts sensitive data from message, exception values, extra, contexts, tags, and user", () => {
    const redacted = redactSentryEvent({
      message:
        "Login failed at /dashboard?access_token=message-token&safe=value",
      exception: {
        values: [
          {
            type: "Error",
            value:
              "Request failed for /api/me?password=exception-secret&safe=value",
          },
        ],
      },
      extra: {
        nested: {
          token: "extra-token",
          password: "extra-password",
          url: "/api/search?authorization=extra-auth&safe=value",
        },
      },
      contexts: {
        auth: {
          accessToken: "context-token",
          cookie: "session=context-cookie",
        },
      },
      tags: {
        authToken: "tag-token",
        feature: "bookings",
      },
      user: {
        id: "user-1",
        email: "client@example.test",
        ip_address: "127.0.0.1",
        token: "user-token",
      },
    } as never)

    expect(redacted.message).toContain(`access_token=${REDACTED}`)
    expect(redacted.exception?.values?.[0]?.value).toContain(
      `password=${REDACTED}`,
    )
    expect(redacted.extra).toMatchObject({
      nested: {
        token: REDACTED,
        password: REDACTED,
        url: expect.stringContaining(`authorization=${REDACTED}`),
      },
    })
    expect(redacted.contexts).toEqual({
      auth: {
        accessToken: REDACTED,
        cookie: REDACTED,
      },
    })
    expect(redacted.tags).toEqual({
      authToken: REDACTED,
      feature: "bookings",
    })
    expect(redacted.user).toEqual({
      id: "user-1",
      email: "client@example.test",
      ip_address: "127.0.0.1",
      token: REDACTED,
    })
    expect(JSON.stringify(redacted)).not.toContain("message-token")
    expect(JSON.stringify(redacted)).not.toContain("exception-secret")
    expect(JSON.stringify(redacted)).not.toContain("extra-token")
    expect(JSON.stringify(redacted)).not.toContain("extra-password")
    expect(JSON.stringify(redacted)).not.toContain("extra-auth")
    expect(JSON.stringify(redacted)).not.toContain("context-token")
    expect(JSON.stringify(redacted)).not.toContain("context-cookie")
    expect(JSON.stringify(redacted)).not.toContain("tag-token")
    expect(JSON.stringify(redacted)).not.toContain("user-token")
  })

  it("redacts request headers, request url query params, and breadcrumbs", () => {
    const redacted = redactSentryEvent({
      request: {
        url: "https://dashboard.test/path?token=request-token&safe=value",
        headers: {
          Authorization: "Bearer request-token",
          cookie: "sawaa_refresh=request-cookie",
          "x-safe-header": "safe",
        },
      },
      breadcrumbs: [
        {
          type: "http",
          category: "fetch",
          message: "GET /api/clients?access_token=crumb-token&safe=value",
          data: {
            url: "/api/clients?password=crumb-password&safe=value",
            requestHeaders: {
              Authorization: "Bearer crumb-token",
            },
          },
        },
      ],
    } as never)

    expect(redacted.request?.url).toContain(`token=${REDACTED}`)
    expect(redacted.request?.headers).toEqual({
      Authorization: REDACTED,
      cookie: REDACTED,
      "x-safe-header": "safe",
    })
    expect(redacted.breadcrumbs?.[0]).toMatchObject({
      type: "http",
      category: "fetch",
      message: expect.stringContaining(`access_token=${REDACTED}`),
      data: {
        url: expect.stringContaining(`password=${REDACTED}`),
        requestHeaders: {
          Authorization: REDACTED,
        },
      },
    })

    expect(JSON.stringify(redacted)).not.toContain("request-token")
    expect(JSON.stringify(redacted)).not.toContain("request-cookie")
    expect(JSON.stringify(redacted)).not.toContain("crumb-token")
    expect(JSON.stringify(redacted)).not.toContain("crumb-password")
  })
})

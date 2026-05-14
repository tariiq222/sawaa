export type LoginErrorKind =
  | "invalid_credentials"
  | "account_inactive"
  | "account_locked"
  | "network"

interface ErrorWithStatus {
  status: number
  message?: string
}

function hasStatus(value: unknown): value is ErrorWithStatus {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    typeof (value as { status: unknown }).status === "number"
  )
}

function readMessage(value: unknown): string {
  if (value instanceof Error) return value.message
  if (typeof value === "object" && value !== null && "message" in value) {
    const m = (value as { message: unknown }).message
    if (typeof m === "string") return m
  }
  return ""
}

export function classifyLoginError(error: unknown): LoginErrorKind {
  if (error instanceof TypeError) return "network"

  if (hasStatus(error)) {
    if (error.status >= 500) return "network"
    if (error.status === 401) {
      const message = readMessage(error)
      if (message === "Invalid credentials") return "invalid_credentials"
      if (message === "Account is inactive") return "account_inactive"
      if (message.startsWith("Account locked")) return "account_locked"
    }
  } else {
    const message = readMessage(error)
    if (message === "Invalid credentials") return "invalid_credentials"
    if (message === "Account is inactive") return "account_inactive"
    if (message.startsWith("Account locked")) return "account_locked"
  }

  return "invalid_credentials"
}

export function loginErrorMessage(error: unknown): string {
  const m = readMessage(error)
  return m || "LOGIN_FAILED"
}

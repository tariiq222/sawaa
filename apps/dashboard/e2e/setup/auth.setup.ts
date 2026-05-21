import { test as setup } from "@playwright/test"
import * as fs from "fs"
import * as path from "path"
import {
  getPersonaCredentials,
  type Persona,
  storageStatePath,
} from "../fixtures/auth"

const DASHBOARD_ROOT = path.join(__dirname, "..", "..")
const STORAGE_DIR = path.join(DASHBOARD_ROOT, "playwright", ".auth")
fs.mkdirSync(STORAGE_DIR, { recursive: true })

const BASE_URL = process.env.PW_DASHBOARD_URL ?? "http://localhost:5203"
const API_BASE = process.env.PW_API_URL ?? "http://localhost:5200"
const OPTIONAL_AUTH_TIMEOUT_MS = 35_000

interface LoginResponse {
  refreshToken?: string
  user?: unknown
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  let timeout: NodeJS.Timeout | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeout) {
      clearTimeout(timeout)
    }
  }
}

async function loginAndSave(persona: Persona, options: { required: boolean }) {
  const outPath = path.join(DASHBOARD_ROOT, storageStatePath(persona))
  const adminPath = path.join(DASHBOARD_ROOT, storageStatePath("admin"))

  if (fs.existsSync(outPath)) {
    fs.rmSync(outPath, { force: true })
    console.log(
      `[setup] ${options.required ? "Required" : "Optional"} auth state will be refreshed → ${outPath}`
    )
  }

  const adminCredentials = getPersonaCredentials("admin")
  const personaCredentials = getPersonaCredentials(persona)
  if (
    persona === "owner" &&
    fs.existsSync(adminPath) &&
    personaCredentials.email === adminCredentials.email &&
    personaCredentials.password === adminCredentials.password
  ) {
    fs.copyFileSync(adminPath, outPath)
    console.log(
      `[setup] Auth state copied from admin for owner alias → ${outPath}`
    )
    return
  }

  let loginTask: Promise<void> | undefined
  try {
    loginTask = (async () => {
      const storageState = await buildStorageState(persona)
      fs.writeFileSync(outPath, JSON.stringify(storageState, null, 2))
    })()

    if (options.required) {
      await loginTask
    } else {
      await withTimeout(
        loginTask,
        OPTIONAL_AUTH_TIMEOUT_MS,
        `[setup] Optional auth timed out for ${persona} after ${OPTIONAL_AUTH_TIMEOUT_MS / 1000}s`
      )
    }

    console.log(`[setup] Auth state saved for ${persona} → ${outPath}`)
  } catch (error) {
    if (options.required) {
      throw error
    }
    void loginTask?.catch(() => undefined)
    fs.rmSync(outPath, { force: true })
    console.warn(
      `[setup] Optional auth state skipped for ${persona}; stale state removed at ${outPath}: ${String(error)}`
    )
  }
}

async function buildStorageState(persona: Persona) {
  const { email, password } = getPersonaCredentials(persona)
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "(unreadable)")
    throw new Error(
      `[setup] API login failed for ${persona} (${email}) — HTTP ${res.status}: ${body}`
    )
  }

  const data = (await res.json()) as LoginResponse
  const refreshToken = data.refreshToken ?? parseRefreshCookie(res.headers.get("set-cookie"))
  if (!refreshToken) {
    throw new Error(`[setup] API login response missing refresh token for ${persona}`)
  }
  if (!data.user) {
    throw new Error(`[setup] API login response missing user for ${persona}`)
  }

  const dashboardUrl = new URL(BASE_URL)
  return {
    cookies: [
      {
        name: "ck_refresh",
        value: refreshToken,
        domain: dashboardUrl.hostname,
        path: "/",
        expires: -1,
        httpOnly: true,
        secure: dashboardUrl.protocol === "https:",
        sameSite: "Lax" as const,
      },
    ],
    origins: [
      {
        origin: dashboardUrl.origin,
        localStorage: [
          { name: "sawaa_user", value: JSON.stringify(data.user) },
          { name: "sawaa-locale", value: "ar" },
        ],
      },
    ],
  }
}

function parseRefreshCookie(setCookie: string | null): string | null {
  if (!setCookie) return null
  const match = /(?:^|;\s*)ck_refresh=([^;]+)/.exec(setCookie)
  return match?.[1] ?? null
}

setup("authenticate as admin", async () => {
  await loginAndSave("admin", { required: true })
})

setup("authenticate as owner alias", async () => {
  await loginAndSave("owner", { required: true })
})

setup("authenticate as receptionist", async () => {
  await loginAndSave("receptionist", { required: false })
})

setup("authenticate as employee", async () => {
  await loginAndSave("employee", { required: false })
})

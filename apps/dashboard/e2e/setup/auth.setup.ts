import { test as setup, chromium } from "@playwright/test"
import * as fs from "fs"
import * as path from "path"
import {
  getPersonaCredentials,
  loginAs,
  type Persona,
  storageStatePath,
} from "../fixtures/auth"

const DASHBOARD_ROOT = path.join(__dirname, "..", "..")
const STORAGE_DIR = path.join(DASHBOARD_ROOT, "playwright", ".auth")
fs.mkdirSync(STORAGE_DIR, { recursive: true })

const BASE_URL = process.env.PW_DASHBOARD_URL ?? "http://localhost:5203"
const OPTIONAL_AUTH_TIMEOUT_MS = 35_000

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

  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
  let loginTask: Promise<void> | undefined
  try {
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
      baseURL: BASE_URL,
      locale: "ar-SA",
    })
    const page = await context.newPage()

    loginTask = (async () => {
      await loginAs(page, persona)
      await context.storageState({ path: outPath })
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
    await browser?.close().catch(() => undefined)
    browser = undefined
    fs.rmSync(outPath, { force: true })
    console.warn(
      `[setup] Optional auth state skipped for ${persona}; stale state removed at ${outPath}: ${String(error)}`
    )
  } finally {
    await browser?.close()
  }
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

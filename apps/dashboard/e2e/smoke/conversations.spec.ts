import { test, expect } from "@playwright/test"
import { loginAs } from "../fixtures/auth"
import { expectAuthenticatedShell, expectNoAppCrash } from "../fixtures/assertions"

// This conversation is deliberately provisioned by the disposable E2E seed,
// rather than created through a production-like inbox.  It keeps the smoke
// workflow deterministic and prevents a browser run from modifying data that
// it does not own.
const conversationName = process.env.PW_CHAT_CONVERSATION_NAME

test.describe("website conversation reception flow", () => {
  test.skip(
    !conversationName,
    "PW_CHAT_CONVERSATION_NAME must identify a disposable WAITING_FOR_STAFF conversation seeded for this run.",
  )

  test("receptionist claims, replies, releases, and closes a waiting conversation", async ({ page }) => {
    await loginAs(page, "receptionist")
    await page.goto("/conversations", { waitUntil: "domcontentloaded" })
    await expectAuthenticatedShell(page)
    await expectNoAppCrash(page)

    await page.getByRole("button", { name: new RegExp(conversationName!, "i") }).click()
    await page.getByRole("button", { name: /استلام المحادثة|claim conversation/i }).click()

    const reply = "رد اختبار الاستقبال"
    await page.getByLabel(/الرد|reply/i).fill(reply)
    await page.getByRole("button", { name: /إرسال|send/i }).click()
    await expect(page.getByText(reply)).toBeVisible()

    await page.getByRole("button", { name: /إعادة للمساعد|return to assistant/i }).click()

    // A receptionist deliberately cannot close a conversation after it has
    // returned to AI_ACTIVE. Continue as an administrator to verify the
    // permitted terminal transition without widening receptionist rights.
    await loginAs(page, "admin")
    await page.goto("/conversations", { waitUntil: "domcontentloaded" })
    await expectAuthenticatedShell(page)
    await page.getByRole("button", { name: new RegExp(conversationName!, "i") }).click()
    await page.getByRole("button", { name: /إغلاق المحادثة|close conversation/i }).click()
    await expect(page.getByText(/هذه المحادثة مغلقة|this conversation is closed/i)).toBeVisible()
  })
})

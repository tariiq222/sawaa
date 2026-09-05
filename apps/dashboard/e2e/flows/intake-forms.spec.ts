import { test, expect } from "@playwright/test"
import { loginAs } from "../fixtures/auth"
import { getPersonaToken } from "../fixtures/seed"

const apiBase = `${process.env.PW_API_URL ?? "http://localhost:5200"}/api/v1`
const formsPath = "/dashboard/organization/intake-forms"

test("create and edit intake fields atomically, retaining field IDs on metadata save", async ({ page, request }) => {
  const token = await getPersonaToken("admin")
  const headers = { Authorization: `Bearer ${token}` }
  const name = `اختبار نموذج ${Date.now()}`
  let formId: string | undefined
  try {
    await loginAs(page, "admin")
    await page.goto("/intake-forms/create")
    await page.getByPlaceholder(/مثال: استبيان ما قبل الجلسة/).fill(name)
    await page.getByPlaceholder("e.g. Pre-Session Health Form").fill("Intake regression")
    await page.getByPlaceholder(/مثال: ما مستوى ألمك/).fill("السؤال الأول")
    await page.getByPlaceholder("e.g. What is your pain level?").fill("First question")
    // Keep the test form out of client-facing applicability resolution.
    await page.locator("#form-active").click()
    await expect(page.locator("#form-active")).toHaveAttribute("data-state", "unchecked")
    const created = page.waitForResponse((r) => r.url().includes(formsPath) && r.request().method() === "POST")
    await page.getByRole("button", { name: /إنشاء النموذج|Create Form/, exact: true }).click()
    const response = await created
    expect(response.status()).toBe(201)
    const form = await response.json()
    formId = form.id
    expect(form.fields).toHaveLength(1)
    expect(form.fields[0].fieldType).toBe("TEXT")
    expect(form.submissionsCount).toBe(0)
    const originalFieldId = form.fields[0].id

    await page.goto(`/intake-forms/FRM-${form.ref}/edit`)
    const nameInput = page.getByPlaceholder(/مثال: استبيان ما قبل الجلسة/)
    await expect(nameInput).toHaveValue(name)
    await nameInput.fill(`${name} معدل`)
    await page.getByRole("combobox").first().click()
    await page.getByRole("option", { name: /ما بعد الجلسة|Post-Session/, exact: true }).click()
    const saved = page.waitForResponse((r) => r.url().includes(`${formsPath}/${formId}`) && r.request().method() === "PATCH")
    await page.getByRole("button", { name: /حفظ التعديلات|Save Changes/, exact: true }).click()
    const savedResponse = await saved
    expect(savedResponse.status()).toBe(200)
    expect(savedResponse.request().postDataJSON()).not.toHaveProperty("fields")

    const detailResponse = await request.get(`${apiBase}${formsPath}/${formId}`, { headers })
    expect(detailResponse.ok()).toBeTruthy()
    const detail = await detailResponse.json()
    expect(detail.type).toBe("POST_SESSION")
    expect(detail.nameAr).toBe(`${name} معدل`)
    expect(detail.fields[0].id).toBe(originalFieldId)
  } finally {
    // Only this test's own inactive fixture is removed.
    if (formId) {
      const cleanup = await request.delete(`${apiBase}${formsPath}/${formId}`, { headers })
      expect(cleanup.status()).toBe(204)
    }
  }
})

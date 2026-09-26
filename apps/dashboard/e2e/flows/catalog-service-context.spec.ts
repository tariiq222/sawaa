import { expect, test, type Page, type TestInfo } from "@playwright/test"
import { devLogin } from "../helpers/auth"
import { dashboardApiRequest, getPersonaToken } from "../fixtures/seed"

const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
const apiJson = <T>(response: { json(): Promise<unknown> }) => response.json() as Promise<T>

interface Category {
  id: string
  ref: number
  nameAr: string
  nameEn: string
  departmentId: string | null
  bookingMode: "DIRECT" | "SERVICES"
  kind: "CLINIC" | "SERVICE_GROUP"
}

interface Service {
  id: string
  ref: number
  categoryId: string | null
  nameAr: string
  nameEn: string | null
  isHidden: boolean
  price: number | string
  durationMins: number
  bufferMinutes: number
  category?: { bookingMode?: string; nameAr?: string; nameEn?: string }
}

let token: string
let directClinic: Category
let servicesClinic: Category
let serviceGroup: Category

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await dashboardApiRequest(path, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  expect(response.ok, `POST ${path} returned ${response.status}`).toBeTruthy()
  return apiJson<T>(response)
}

async function get<T>(path: string): Promise<T> {
  const response = await dashboardApiRequest(path, token)
  expect(response.ok, `GET ${path} returned ${response.status}`).toBeTruthy()
  return apiJson<T>(response)
}

async function createCategory(
  suffix: string,
  bookingMode: "DIRECT" | "SERVICES",
  kind: "CLINIC" | "SERVICE_GROUP",
  departmentId: string | null = null,
): Promise<Category> {
  return post<Category>("/dashboard/organization/categories", {
    nameAr: `عيادة تدفق ${suffix}`,
    nameEn: `Flow Clinic ${suffix}`,
    bookingMode,
    kind,
    departmentId,
  })
}

async function openServiceCreateFromCategory(page: Page, category: Category) {
  await page.goto(`/categories/CAT-${category.ref}/edit?tab=services`)
  await expect(page.getByRole("button", { name: /إضافة خدمة|Add Service/ })).toBeVisible()
  await page.getByRole("button", { name: /إضافة خدمة|Add Service/ }).click()
  await page.waitForURL(new RegExp(`/services/create\\?categoryId=${category.id}`))
  await expect(page.locator('input[name="nameAr"]')).toBeVisible()
}

test.describe("clinic and service group context in service administration", () => {
  test.beforeAll(async () => {
    token = await getPersonaToken("admin")
    const department = await post<{ id: string }>("/dashboard/organization/departments", {
      nameAr: `قسم تدفق ${runId}`,
      nameEn: `Flow Department ${runId}`,
      isActive: true,
    })
    directClinic = await createCategory(`${runId}-direct`, "DIRECT", "CLINIC")
    servicesClinic = await createCategory(`${runId}-services`, "SERVICES", "CLINIC", department.id)
    serviceGroup = await createCategory(`${runId}-group`, "SERVICES", "SERVICE_GROUP")
  })

  test("creates from the originating clinic and saves names, booking settings, and category binding", async ({ page }, testInfo: TestInfo) => {
    await devLogin(page)
    await openServiceCreateFromCategory(page, servicesClinic)

    const categoryLabel = page.getByText(/^العيادة أو مجموعة الخدمات\s*\*$/)
    await expect(categoryLabel).toBeVisible()
    const categorySelector = page.locator('button[role="combobox"]:visible')
    await expect(categorySelector).toHaveCount(1)
    await categorySelector.click()
    await expect(page.getByRole("option", { name: serviceGroup.nameAr })).toBeVisible()
    await expect(page.getByRole("option", { name: directClinic.nameAr })).toHaveCount(0)
    await page.keyboard.press("Escape")
    await expect(page.locator("input[readonly]")).toHaveValue(`قسم تدفق ${runId}`)
    await expect(page.locator('input[name="nameAr"]')).toBeEnabled()
    await expect(page.locator('input[name="nameEn"]')).toBeEnabled()

    const nameAr = `خدمة مرتبطة ${runId}`
    const nameEn = `Bound Service ${runId}`
    await page.locator('input[name="nameAr"]').fill(nameAr)
    await page.locator('input[name="nameEn"]').fill(nameEn)
    await page.screenshot({ path: testInfo.outputPath("service-create-category-context.png"), fullPage: true })

    await page.getByRole("tab", { name: "إعدادات الحجز" }).click()
    await page.locator("#create-buffer-toggle").click()
    await expect(page.locator("#create-buffer")).toBeVisible()
    await page.locator("#create-buffer").fill("15")

    const createdResponse = page.waitForResponse((response) =>
      response.url().includes("/dashboard/organization/services") &&
      response.request().method() === "POST" && response.ok(),
    )
    await page.locator('form button[type="submit"]').click()
    const created = await apiJson<Service>(await createdResponse)
    expect(created.categoryId).toBe(servicesClinic.id)
    expect(created.nameAr).toBe(nameAr)
    expect(created.nameEn).toBe(nameEn)

    const saved = await get<Service>(`/dashboard/organization/services/${created.id}`)
    expect(saved.categoryId).toBe(servicesClinic.id)
    expect(saved.bufferMinutes).toBe(15)
    await expect(page).toHaveURL(`/categories/CAT-${servicesClinic.ref}/edit?tab=services`)
  })

  test("blocks create when the originating clinic books directly and links to clinic management", async ({ page }) => {
    await devLogin(page)
    await page.goto(`/services/create?categoryId=${directClinic.id}`)
    await expect(page.getByRole("alert").filter({ hasText: /تستخدم الحجز باسم العيادة|books under its own name/i })).toBeVisible()
    await expect(page.getByRole("alert").getByRole("link", { name: /إدارة العيادات|Manage clinics/ })).toHaveAttribute(
      "href",
      `/categories/CAT-${directClinic.ref}/edit?tab=info`,
    )
    await page.locator('input[name="nameAr"]').fill(`رفض إنشاء ${runId}`)
    await expect(page.locator('form button[type="submit"]')).toBeDisabled()
    await expect(page).toHaveURL(new RegExp(`/services/create\\?categoryId=${directClinic.id}`))
  })

  test("keeps internal service identity read-only while pricing and booking settings stay available", async ({ page }) => {
    const rows = await get<{ items: Service[] }>(
      `/dashboard/organization/services?categoryId=${directClinic.id}&includeHidden=true&limit=50`,
    )
    const internal = rows.items.find((item) => item.isHidden && item.category?.bookingMode === "DIRECT")
    expect(internal, "DIRECT clinic has its backend-owned internal service").toBeTruthy()
    await devLogin(page)
    await page.goto(`/services/SVC-${internal!.ref}/edit`)
    await expect(page.locator('input[name="nameAr"]')).toBeVisible()
    await expect(page.locator('input[name="nameAr"]')).toHaveAttribute("readonly", "")
    await expect(page.locator('input[name="nameEn"]')).toHaveAttribute("readonly", "")
    await expect(page.getByRole("link", { name: /إدارة العيادة|Manage clinic/ })).toBeVisible()
    await expect(page.getByRole("tab", { name: "المدة والتسعير" })).toBeEnabled()
    await expect(page.getByRole("tab", { name: "إعدادات الحجز" })).toBeEnabled()

    await page.goto("/services")
    await page.getByRole("searchbox").fill(directClinic.nameAr)
    const row = page.getByRole("row").filter({ hasText: directClinic.nameAr })
    await expect(row).toBeVisible()
    await expect(row.getByText("حجز العيادة", { exact: true })).toBeVisible()
    await expect(row.getByRole("button", { name: /حذف|Delete/ })).toHaveCount(0)
  })

  test("saves only changed booking settings for a legacy uncategorized service with no English name", async ({ page }) => {
    const originalNameEn = `Legacy service ${runId}`
    const created = await post<Service>("/dashboard/organization/services", {
      nameAr: `خدمة قديمة ${runId}`,
      nameEn: originalNameEn,
      categoryId: servicesClinic.id,
      durationMins: 45,
      price: 12_500,
      currency: "SAR",
      isActive: true,
    })

    try {
      const nullPatch = await dashboardApiRequest(`/dashboard/organization/services/${created.id}`, token, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nameEn: null, categoryId: null }),
      })
      expect(nullPatch.ok, `PATCH nullable legacy fields returned ${nullPatch.status}`).toBeTruthy()
      const patchedFixture = await apiJson<Service>(nullPatch)
      expect(patchedFixture.id).toBe(created.id)
      expect(patchedFixture.nameEn).toBeNull()
      expect(patchedFixture.categoryId).toBeNull()

      await devLogin(page)
      await page.goto(`/services/SVC-${created.ref}/edit`)
      await expect(page.locator('input[name="nameAr"]')).toHaveValue(`خدمة قديمة ${runId}`)
      await expect(page.locator('input[name="nameEn"]')).toHaveValue("")
      await expect(page.locator('input[name="nameAr"]')).toBeEnabled()
      await expect(page.locator('input[name="nameEn"]')).toBeEnabled()

      await page.getByRole("tab", { name: "إعدادات الحجز" }).click()
      await page.locator("#create-buffer-toggle").click()
      await page.locator("#create-buffer").fill("20")

      const updateResponse = page.waitForResponse((response) =>
        response.url().includes(`/dashboard/organization/services/${created.id}`) &&
        response.request().method() === "PATCH",
      )
      await page.locator('form button[type="submit"]').click()
      const savedResponse = await updateResponse
      expect(savedResponse.status(), "settings-only service update succeeded").toBe(200)

      const saved = await get<Service>(`/dashboard/organization/services/${created.id}`)
      expect(saved.id).toBe(created.id)
      expect(saved.nameEn).toBeNull()
      expect(saved.categoryId).toBeNull()
      expect(saved.bufferMinutes).toBe(20)
    } finally {
      const restore = await dashboardApiRequest(`/dashboard/organization/services/${created.id}`, token, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nameEn: originalNameEn }),
      })
      if (!restore.ok) {
        throw new Error(`Could not restore this test's service ${created.id} English name: HTTP ${restore.status}`)
      }
    }
  })
})

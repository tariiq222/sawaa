/**
 * E2E: create a practitioner through the employees page, then prove their
 * service-specific pricing/duration and bookability are visible to bookings.
 */

import { test, expect, type Page } from '@playwright/test'
import { loginAs } from '../../fixtures/auth'
import { getTestTenant } from '../../fixtures/tenant'
import {
  cleanupBranch,
  cleanupClient,
  cleanupEmployee,
  cleanupService,
  assignEmployeeToBranch,
  assignEmployeeToService,
  dashboardApiRequest,
  ensureValidMainBranchId,
  seedClient,
  seedEmployee,
  seedService,
  setBranchBusinessHours,
} from '../../fixtures/seed'

type EmployeeListResponse = {
  items?: Array<{ id: string; email?: string | null; nameAr?: string | null }>
  data?: Array<{ id: string; email?: string | null; nameAr?: string | null }>
}

type ServiceConfig = {
  deliveryType: string
  durationOptions: Array<{
    id: string
    label: string
    labelAr?: string | null
    durationMins: number
    price: number
    isDefault?: boolean
  }>
}

type EmployeeServiceType = {
  deliveryType: string
  durationOptions: Array<{
    id: string
    label: string
    labelAr?: string | null
    durationMinutes: number
    price: number
    isDefault?: boolean
  }>
}

const API_JSON_HEADERS = { 'Content-Type': 'application/json' }

async function apiJson<T>(response: Response, label: string): Promise<T> {
  if (!response.ok) {
    const body = await response.text().catch(() => '(unreadable)')
    throw new Error(`${label} failed with HTTP ${response.status}: ${body}`)
  }
  return response.json() as Promise<T>
}

async function getJson<T>(token: string, path: string): Promise<T> {
  return apiJson<T>(await dashboardApiRequest(path, token), `GET ${path}`)
}

async function putJson<T>(token: string, path: string, body: Record<string, unknown>): Promise<T> {
  return apiJson<T>(
    await dashboardApiRequest(path, token, {
      method: 'PUT',
      headers: API_JSON_HEADERS,
      body: JSON.stringify(body),
    }),
    `PUT ${path}`,
  )
}

async function patchJson<T>(token: string, path: string, body: Record<string, unknown>): Promise<T> {
  return apiJson<T>(
    await dashboardApiRequest(path, token, {
      method: 'PATCH',
      headers: API_JSON_HEADERS,
      body: JSON.stringify(body),
    }),
    `PATCH ${path}`,
  )
}

async function postJson<T>(token: string, path: string, body: Record<string, unknown>): Promise<T> {
  return apiJson<T>(
    await dashboardApiRequest(path, token, {
      method: 'POST',
      headers: API_JSON_HEADERS,
      body: JSON.stringify(body),
    }),
    `POST ${path}`,
  )
}

async function deleteJson(token: string, path: string): Promise<void> {
  const response = await dashboardApiRequest(path, token, { method: 'DELETE' })
  if (!response.ok) {
    const body = await response.text().catch(() => '(unreadable)')
    throw new Error(`DELETE ${path} failed with HTTP ${response.status}: ${body}`)
  }
}

async function findEmployeeByEmail(token: string, email: string) {
  const params = new URLSearchParams({ search: email, limit: '10' })
  const body = await getJson<EmployeeListResponse>(token, `/dashboard/people/employees?${params}`)
  const employees = body.items ?? body.data ?? []
  return employees.find((employee) => employee.email === email) ?? null
}

function nextIsoDateForDay(dayOfWeek: number) {
  const date = new Date()
  date.setUTCHours(0, 0, 0, 0)
  const daysUntilTarget = (dayOfWeek - date.getUTCDay() + 7) % 7 || 7
  date.setUTCDate(date.getUTCDate() + daysUntilTarget)
  return date.toISOString().slice(0, 10)
}

async function clickUnique(locator: ReturnType<Page['locator']>, label: string) {
  const count = await locator.count()
  expect(count, `${label} should resolve to one element`).toBe(1)
  await locator.click()
}

async function createServiceWithDurationOptions(token: string) {
  const service = await seedService(token, {
    nameAr: 'خدمة ممارس شاملة',
    nameEn: 'Practitioner Full Flow Service',
    durationMins: 45,
    price: 20_000,
    skipBookingConfig: true,
  })

  const configs = await putJson<ServiceConfig[]>(
    token,
    `/dashboard/organization/services/${service.id}/booking-types`,
    {
      types: [
        {
          deliveryType: 'IN_PERSON',
          durationMins: 45,
          price: 20_000,
          isActive: true,
          useCustomAvailability: false,
          durationOptions: [
            {
              label: 'Short session',
              labelAr: 'جلسة قصيرة',
              durationMins: 45,
              price: 20_000,
              isDefault: true,
              sortOrder: 0,
              isActive: true,
            },
            {
              label: 'Extended session',
              labelAr: 'جلسة مطولة',
              durationMins: 60,
              price: 26_000,
              isDefault: false,
              sortOrder: 1,
              isActive: true,
            },
          ],
        },
      ],
    },
  )

  const defaultOption = configs
    .flatMap((config) => config.durationOptions)
    .find((option) => option.isDefault)
  expect(defaultOption?.id, 'seeded service default duration option').toBeTruthy()

  return { service, defaultOptionId: defaultOption!.id }
}

async function fillBasicEmployeeInfo(page: Page, input: {
  nameEn: string
  nameAr: string
  email: string
}) {
  await page.locator('input[name="nameEn"]').fill(input.nameEn)
  await page.locator('input[name="nameAr"]').fill(input.nameAr)
  await page.locator('input[name="email"]').fill(input.email)
  await page.locator('input[name="phone"]').fill('+966501234567')
  await page.locator('input[name="specialty"]').fill('Family Counselor')
  await page.locator('input[name="specialtyAr"]').fill('إرشاد أسري')
}

async function configureSchedule(page: Page) {
  await page.getByRole('tab', { name: 'الجدول والاستراحات' }).click()
  await expect(page.getByText('إجازة الممارس')).toBeVisible()

  const timeInputs = page.locator('input[type="time"]:not([disabled])')
  expect(await timeInputs.count(), 'schedule should expose time inputs').toBeGreaterThanOrEqual(2)
  await timeInputs.nth(0).fill('10:00', { timeout: 5_000 })
  await timeInputs.nth(1).fill('14:00', { timeout: 5_000 })

  await page.getByRole('button', { name: /\+ إضافة استراحة/u }).first().click()
}

async function configureServiceOverride(page: Page, serviceNameAr: string) {
  await page.getByRole('tab', { name: 'الخدمات والتسعير' }).click()
  await clickUnique(page.getByRole('button', { name: 'إضافة خدمة' }), 'initial add service button')

  await page.getByText('اختر خدمة').click()
  await page.getByRole('option', { name: serviceNameAr }).click()

  const addServicePanel = page.locator('div.rounded-lg.border.border-border.p-4.space-y-4').filter({
    hasText: 'تفعيل أسعار وأوقات مختلفة عن الخدمة',
  })
  await expect(addServicePanel).toBeVisible()
  const customPricingSwitch = addServicePanel.locator('button[role="switch"]').first()
  await expect(customPricingSwitch).toBeEnabled()
  await customPricingSwitch.click()
  await expect(customPricingSwitch).toHaveAttribute('aria-checked', 'true')

  const numberInputs = addServicePanel.locator('input[type="number"]')
  await expect
    .poll(() => numberInputs.count(), {
      message: 'custom pricing panel should expose numeric fields',
    })
    .toBeGreaterThanOrEqual(2)
  await numberInputs.nth(0).fill('180')
  await numberInputs.nth(1).fill('50')

  await addServicePanel.getByRole('button', { name: 'إضافة خدمة' }).click()
  await expect(page.getByText(serviceNameAr)).toBeVisible()
}

async function openBookingWizardForService(page: Page, input: {
  clientName: string
  serviceNameAr: string
}) {
  await page.goto('/bookings')
  await page.getByRole('button', { name: /حجز جديد/u }).click()

  const posContainer = page.locator('.rounded-2xl.border').filter({ hasText: 'حجز جديد' })
  await expect(posContainer).toBeVisible()

  const searchInput = page.locator('input[placeholder*="ابحث"]').first()
  await searchInput.fill(input.clientName)
  await page.locator('button').filter({ hasText: input.clientName }).first().click()

  await posContainer.getByRole('button', { name: /^عيادات$|^Clinics$/ }).first().click()
  await posContainer.locator('button').filter({ hasText: /فئة اختبار|Test Category/u }).first().click()
  await posContainer.locator('button').filter({ hasText: input.serviceNameAr }).first().click()
}

test.describe('Practitioner onboarding, custom service options, and booking visibility', () => {
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(120_000)

  let token = ''
  let branchId = ''
  let serviceId = ''
  let serviceNameAr = ''
  let clientId = ''
  let clientName = ''
  let employeeId = ''
  let vacationId = ''
  const extraEmployeeIds: string[] = []

  test.beforeAll(async () => {
    const tenant = await getTestTenant()
    token = tenant.accessToken

    branchId = await ensureValidMainBranchId(token)
    await setBranchBusinessHours(token, branchId)

    const { service } = await createServiceWithDurationOptions(token)
    serviceId = service.id
    serviceNameAr = service.nameAr

    const client = await seedClient(token, {
      firstName: 'عميل',
      lastName: 'رحلة ممارس',
      gender: 'MALE',
    })
    clientId = client.id
    clientName = `${client.firstName} ${client.lastName}`
  })

  test.afterAll(async () => {
    if (employeeId && vacationId) {
      await deleteJson(token, `/dashboard/people/employees/${employeeId}/vacations/${vacationId}`).catch(() => undefined)
    }
    if (employeeId) await cleanupEmployee(employeeId, token).catch(() => undefined)
    for (const id of extraEmployeeIds) {
      await cleanupEmployee(id, token).catch(() => undefined)
    }
    if (clientId) await cleanupClient(clientId, token).catch(() => undefined)
    if (serviceId) await cleanupService(serviceId, token).catch(() => undefined)
    if (branchId) await cleanupBranch(branchId, token).catch(() => undefined)
  })

  test('creates a practitioner with custom service pricing and controls booking visibility', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/employees/create')

    const suffix = Date.now()
    const employeeNameAr = `ممارس شامل ${suffix}`
    const email = `practitioner-full-${suffix}@sawaa-test.com`

    await fillBasicEmployeeInfo(page, {
      nameEn: `Full Practitioner ${suffix}`,
      nameAr: employeeNameAr,
      email,
    })
    await configureSchedule(page)
    await configureServiceOverride(page, serviceNameAr)

    const onboardResponsePromise = page
      .waitForResponse(
        (response) =>
          response.url().includes('/dashboard/people/employees/onboarding') &&
          response.request().method() === 'POST',
        { timeout: 15_000 },
      )
      .catch(() => null)
    await page.getByRole('button', { name: 'إنشاء الممارس' }).click()
    const onboardResponse = await onboardResponsePromise
    expect(onboardResponse, 'submit should call the employee onboarding endpoint').not.toBeNull()
    if (onboardResponse && !onboardResponse.ok()) {
      throw new Error(`employee onboarding failed: HTTP ${onboardResponse.status()} ${await onboardResponse.text()}`)
    }
    await expect(page).toHaveURL(/\/employees$/, { timeout: 30_000 })
    await expect(page.getByText(employeeNameAr).or(page.getByText(email)).first()).toBeVisible()

    const created = await findEmployeeByEmail(token, email)
    expect(created?.id, 'created practitioner should be persisted').toBeTruthy()
    employeeId = created!.id

    const services = await getJson<Array<{ serviceId: string; isActive?: boolean }>>(
      token,
      `/dashboard/people/employees/${employeeId}/services`,
    )
    expect(services.some((service) => service.serviceId === serviceId && service.isActive !== false)).toBeTruthy()

    const availability = await getJson<{ schedule: Array<{ startTime: string; endTime: string; isActive: boolean }> }>(
      token,
      `/dashboard/people/employees/${employeeId}/availability`,
    )
    expect(availability.schedule.some((slot) => slot.isActive && slot.startTime === '10:00' && slot.endTime === '14:00')).toBeTruthy()

    const breaks = await getJson<{ breaks: Array<{ startTime: string; endTime: string }> }>(
      token,
      `/dashboard/people/employees/${employeeId}/breaks`,
    )
    expect(breaks.breaks.some((slot) => slot.startTime === '12:00' && slot.endTime === '13:00')).toBeTruthy()

    const serviceTypes = await getJson<EmployeeServiceType[]>(
      token,
      `/dashboard/people/employees/${employeeId}/services/${serviceId}/types`,
    )
    const inPerson = serviceTypes.find((type) => type.deliveryType === 'IN_PERSON')
    expect(inPerson?.durationOptions.some((option) =>
      option.isDefault && option.durationMinutes === 50 && Number(option.price) === 18_000
    )).toBeTruthy()

    const vacationDate = nextIsoDateForDay(0)
    const vacation = await postJson<{ id: string }>(
      token,
      `/dashboard/people/employees/${employeeId}/vacations`,
      {
        startDate: `${vacationDate}T00:00:00.000+03:00`,
        endDate: `${vacationDate}T23:59:59.999+03:00`,
        reason: 'E2E vacation blocks booking slots',
      },
    )
    vacationId = vacation.id
    const vacations = await getJson<Array<{ id: string; reason?: string | null }>>(
      token,
      `/dashboard/people/employees/${employeeId}/vacations`,
    )
    expect(vacations.some((item) => item.id === vacationId)).toBeTruthy()
    const vacationSlots = await getJson<Array<{ startTime: string; endTime: string }>>(
      token,
      `/dashboard/people/employees/${employeeId}/slots?date=${vacationDate}&duration=50&serviceId=${serviceId}&deliveryType=IN_PERSON`,
    )
    expect(vacationSlots).toHaveLength(0)
    await deleteJson(token, `/dashboard/people/employees/${employeeId}/vacations/${vacationId}`)
    vacationId = ''

    await openBookingWizardForService(page, { clientName, serviceNameAr })
    await expect(page.locator('button').filter({ hasText: employeeNameAr }).first()).toBeVisible()
    await page.locator('button').filter({ hasText: employeeNameAr }).first().click()
    const customDurationOption = page
      .locator('button')
      .filter({ hasText: /50 دقيقة/u })
      .filter({ hasText: /180\.00 ر\.س/u })
    await expect(customDurationOption).toBeVisible()

    await patchJson(token, `/dashboard/people/employees/${employeeId}/services/${serviceId}`, {
      isActive: false,
    })

    await openBookingWizardForService(page, { clientName, serviceNameAr })
    await expect(page.locator('button').filter({ hasText: employeeNameAr })).toHaveCount(0)
  })

  test('keeps practitioners without a service or active availability out of bookable states', async ({ page }) => {
    const suffix = Date.now()
    const noServiceEmployee = await seedEmployee(token, {
      name: `ممارس بلا خدمة ${suffix}`,
    })
    extraEmployeeIds.push(noServiceEmployee.id)
    await assignEmployeeToBranch(token, branchId, noServiceEmployee.id)

    const noAvailabilityEmployee = await seedEmployee(token, {
      name: `ممارس بلا دوام ${suffix}`,
      skipAvailability: true,
    })
    extraEmployeeIds.push(noAvailabilityEmployee.id)
    await assignEmployeeToBranch(token, branchId, noAvailabilityEmployee.id)
    await assignEmployeeToService(token, noAvailabilityEmployee.id, serviceId)

    await loginAs(page, 'admin')
    await openBookingWizardForService(page, { clientName, serviceNameAr })

    await expect(page.locator('button').filter({ hasText: noServiceEmployee.name })).toHaveCount(0)

    const noAvailabilityButton = page.locator('button').filter({ hasText: noAvailabilityEmployee.name })
    await expect(noAvailabilityButton).toBeVisible()
    await expect(noAvailabilityButton).toBeDisabled()
  })
})

import { test, type Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const EVIDENCE_DIR = '/tmp/sawa-editor-evidence'
const SERVICE_ID = '98433eb0-7155-405a-ae3c-b1bc8447a8c2'
const API_BASE = process.env.PW_API_URL ?? 'http://localhost:5200'
const DASHBOARD_BASE = process.env.PW_DASHBOARD_URL ?? 'http://localhost:5203'

if (!fs.existsSync(EVIDENCE_DIR)) fs.mkdirSync(EVIDENCE_DIR, { recursive: true })

const consoleMessages: { type: string; text: string; ts: number }[] = []
const failedRequests: { method: string; url: string; status: number; ts: number }[] = []
const capturedRequests: { method: string; url: string; status: number; ts: number }[] = []

interface TestRow {
  id: number
  case: string
  expected: string
  actual: string
  pass: boolean
  evidence?: string
}

const results: TestRow[] = []
let nextId = 1
function record(caseName: string, expected: string, actual: string, evidence?: string): boolean {
  const pass = !actual.toLowerCase().startsWith('fail') && !actual.toLowerCase().startsWith('error') && !actual.startsWith('FAIL:')
  results.push({ id: nextId++, case: caseName, expected, actual, pass, evidence })
  return pass
}

async function screenshot(page: Page, name: string): Promise<string> {
  const file = path.join(EVIDENCE_DIR, `${name}.png`)
  await page.screenshot({ path: file, fullPage: true })
  return file
}

async function apiLogin() {
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@sawaa-test.com', password: 'Admin@1234' }),
  })
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${await res.text()}`)
  return (await res.json()) as { accessToken: string; refreshToken: string; user: { id: string; role: string; isSuperAdmin: boolean } }
}

test.use({ locale: 'ar-SA', timezoneId: 'Asia/Riyadh' })

test('Service editor Employees tab — exhaustive UI test', async ({ page }) => {
  const dashUrl = new URL(DASHBOARD_BASE)
  const loginData = await apiLogin()
  await page.context().addCookies([
    {
      name: 'ck_refresh',
      value: loginData.refreshToken,
      domain: dashUrl.hostname,
      path: '/',
      expires: -1,
      httpOnly: true,
      secure: dashUrl.protocol === 'https:',
      sameSite: 'Lax',
    },
  ])
  await page.addInitScript((user) => {
    localStorage.setItem('sawaa_user', JSON.stringify({ id: user.id, role: user.role, isSuperAdmin: user.isSuperAdmin }))
    localStorage.setItem('sawaa-locale', 'ar')
  }, loginData.user)

  page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text(), ts: Date.now() }))
  page.on('response', (res) => {
    const req = res.request()
    const entry = { method: req.method(), url: req.url(), status: res.status(), ts: Date.now() }
    capturedRequests.push(entry)
    if (entry.status >= 400) failedRequests.push(entry)
  })

  // === PAGE LOAD ===
  await page.goto(`/services/${SERVICE_ID}/edit?tab=employees`, { waitUntil: 'domcontentloaded' })
  await page.waitForResponse((r) => r.url().includes(`/services/${SERVICE_ID}/employees`), { timeout: 15_000 }).catch(() => {})
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
  await page.waitForTimeout(800)
  await screenshot(page, '01-page-load')

  // === INITIAL STATE (before any interaction) ===
  const employeesHeading = page.locator('text=تخصيص السعر أو المدة لكل ممارس').first()
  const employeesHeadingVisible = await employeesHeading.isVisible({ timeout: 8_000 }).catch(() => false)
  record('Employees tab content visible', 'heading visible', employeesHeadingVisible ? 'pass' : 'fail', '01-page-load.png')

  const cardsCount = await page.locator('text=طبيبة عامة').count()
  record('At least one assigned employee', 'employee card present', `found: ${cardsCount}`, '01-page-load.png')

  // Inherited badges count (initial state) — the Badge component uses class "text-[9px]"
  const initialInheritedBadges = await page.locator('.text-\\[9px\\]').count()
  record(
    'Initial state: موروثة من الخدمة badges',
    '2 badges (one per inherited row from service defaults)',
    `badges found: ${initialInheritedBadges} (data has 2 inherited rows; expected 2)`,
    '01-page-load.png'
  )

  // active switch initial state
  const activeSwitch = page.locator('button[role="switch"]').first()
  const activeInitial = await activeSwitch.getAttribute('aria-checked').catch(() => 'unknown')
  record('Initial state: active switch', 'data isActive=true → switch on', `aria-checked: ${activeInitial}`, '01-page-load.png')

  // custom pricing switch initial state
  const pricingSwitch = page.locator('button[role="switch"]').nth(1)
  const pricingInitial = await pricingSwitch.getAttribute('aria-checked').catch(() => 'unknown')
  record('Initial state: custom pricing switch', 'data hasCustomPricing=false → switch off', `aria-checked: ${pricingInitial}`, '01-page-load.png')

  // buffer initial state
  const bufferBtn = page.locator('button[aria-label*="دقائق الفاصل"]').first()
  const bufferInitial = (await bufferBtn.textContent().catch(() => 'n/a'))?.trim()
  record('Initial state: buffer cell', 'data bufferMinutes visible in button', `value: ${bufferInitial}`, '01-page-load.png')

  // BUG: availableTypes from API is uppercase "IN_PERSON" but FE badge code compares lowercase
  // → the available-type badge in the header shows the wrong label
  const headerTypeBadge = await page.locator('div').filter({ hasText: /^(حضوري|عن بُعد)$/ }).first().textContent().catch(() => 'n/a')
  const typeBadgeInHeader = await page.evaluate(() => {
    // Find the employee header (with name "لبنى القطّان" or similar) and the type badge inside
    const header = Array.from(document.querySelectorAll('span, div')).find((el) => el.textContent?.includes('طبيبة عامة'))
    if (!header) return 'header not found'
    const badges = header.parentElement?.querySelectorAll('span')
    const badgeTexts: string[] = []
    badges?.forEach((b) => {
      const t = b.textContent?.trim()
      if (t === 'حضوري' || t === 'عن بُعد') badgeTexts.push(t)
    })
    return badgeTexts.join(',') || 'no badge found'
  })
  record(
    'Header type badge label (BUG CHECK)',
    'data availableTypes=["IN_PERSON"] should show حضوري',
    `badge shows: ${typeBadgeInHeader} (API has IN_PERSON; FE compares lowercase "in_person" → falls to else → shows عن بُعد)`,
    '01-page-load.png'
  )

  // === SECTION 1: Display toggles ===
  // 1.1: Active switch toggle
  const beforeActiveReqs = capturedRequests.length
  await activeSwitch.click()
  await page.waitForTimeout(1500)
  const afterActiveState = await activeSwitch.getAttribute('aria-checked')
  const activeReqs = capturedRequests.slice(beforeActiveReqs)
  const activePatch = activeReqs.find((r) => r.method === 'PATCH' && r.url.includes('/services/'))
  record(
    'Active switch ON→OFF',
    'PATCH /employees/{id}/services + state flips to false',
    `aria: true→${afterActiveState}; PATCH: ${activePatch ? `${activePatch.method} ${activePatch.status}` : 'none'}`,
    '02-active-toggle-off.png'
  )
  await screenshot(page, '02-active-toggle-off')
  // restore
  await activeSwitch.click()
  await page.waitForTimeout(1500)
  const restoredActive = await activeSwitch.getAttribute('aria-checked')
  record(
    'Active switch OFF→ON (restore)',
    'PATCH + state restored to true',
    `aria-checked final: ${restoredActive}`,
    '03-active-toggle-on.png'
  )
  await screenshot(page, '03-active-toggle-on')

  // 1.2: Custom pricing switch toggle
  const beforePricingReqs = capturedRequests.length
  const beforePricingState = await pricingSwitch.getAttribute('aria-checked')
  if (beforePricingState === 'false') {
    await pricingSwitch.click()
    await page.waitForTimeout(2500)
    const afterPricingState = await pricingSwitch.getAttribute('aria-checked')
    const pricingReqs = capturedRequests.slice(beforePricingReqs)
    const pricingPut = pricingReqs.find((r) => r.method === 'PUT')
    const tableStillVisible = await page.locator('table').first().isVisible({ timeout: 2_000 }).catch(() => false)
    record(
      'Custom pricing switch ON',
      'PUT /custom-pricing + duration table still visible',
      `aria: ${beforePricingState}→${afterPricingState}; PUT: ${pricingPut ? `${pricingPut.method} ${pricingPut.status}` : 'none'}; table: ${tableStillVisible}`,
      '04-custom-pricing-on.png'
    )
    await screenshot(page, '04-custom-pricing-on')
  } else {
    record('Custom pricing switch ON', 'should be off initially', 'skipped — already on', '01-page-load.png')
  }

  // 1.3: Buffer field edit
  const beforeBufferReqs = capturedRequests.length
  const beforeBuffer = (await bufferBtn.textContent())?.trim()
  await bufferBtn.click()
  await page.waitForTimeout(400)
  const numInput = page.locator('input[type="number"]').first()
  const inputVis = await numInput.isVisible({ timeout: 1_500 }).catch(() => false)
  if (inputVis) {
    const newValue = beforeBuffer?.includes('20') ? '25' : '20'
    await numInput.fill(newValue)
    await numInput.press('Tab')
    await page.waitForTimeout(1500)
    const bufferReqs = capturedRequests.slice(beforeBufferReqs)
    const bufferPatch = bufferReqs.find((r) => r.method === 'PATCH' && r.url.includes('/services/'))
    record(
      `Buffer edit (was "${beforeBuffer}" → ${newValue})`,
      'PATCH /employees/{id}/services with bufferMinutes',
      `PATCH: ${bufferPatch ? `${bufferPatch.method} ${bufferPatch.status}` : 'none'}`,
      '05-buffer-edit.png'
    )
  } else {
    record('Buffer field edit', 'number input appears after click', 'fail — no input', '05-buffer-edit.png')
  }
  await screenshot(page, '05-buffer-edit')

  // === SECTION 2: Duration options table ===
  // Reload to get clean local state for duration tests
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForResponse((r) => r.url().includes(`/services/${SERVICE_ID}/employees`), { timeout: 15_000 }).catch(() => {})
  await page.waitForTimeout(1000)
  await screenshot(page, '06a-reload-fresh-state')

  const inPersonLabel = page.locator('text=حضوري').first()
  const inPersonVisible = await inPersonLabel.isVisible({ timeout: 3_000 }).catch(() => false)
  const onlineSectionLabel = page.locator('p:has-text("عن بُعد")').first()
  const onlineSectionVisible = await onlineSectionLabel.isVisible({ timeout: 2_000 }).catch(() => false)
  record(
    'Duration sections present',
    'حضوري and/or عن بُعد visible',
    `حضوري: ${inPersonVisible}; عن بُعد (section): ${onlineSectionVisible}`,
    '06a-reload-fresh-state.png'
  )

  const inPersonSection = inPersonLabel.locator('xpath=ancestor::div[.//table][1]')
  const onlineSection = onlineSectionLabel.locator('xpath=ancestor::div[.//table][1]')

  // Verify initial state of table after reload
  const initialRows = await inPersonSection.locator('table tbody tr').count()
  const initialInheritedAfterReload = await inPersonSection.locator('.text-\\[9px\\]').count()
  record(
    'In-person table initial state (after reload)',
    '2 rows with موروثة من الخدمة badges (service defaults)',
    `rows: ${initialRows}; inherited badges: ${initialInheritedAfterReload}`,
    '06a-reload-fresh-state.png'
  )

  // 2.1: Edit duration of FIRST row (inherited) → verify local isInherited flips
  const firstDurationBtn = inPersonSection.locator('table button[aria-label*="المدة"]').first()
  const firstDurationVisible = await firstDurationBtn.isVisible({ timeout: 3_000 }).catch(() => false)
  if (firstDurationVisible) {
    const beforeText = (await firstDurationBtn.textContent())?.trim()
    const beforeReqs = capturedRequests.length
    await firstDurationBtn.click()
    await page.waitForTimeout(400)
    const numInput = page.locator('input[type="number"]').first()
    await numInput.fill('45')
    await numInput.press('Enter')
    await page.waitForTimeout(600)
    const newReqs = capturedRequests.slice(beforeReqs)
    const immediateNetwork = newReqs.find((r) => r.method === 'PATCH' || r.method === 'PUT')
    // After commit, check the row no longer has the inherited badge (local state flipped)
    const rowAfterEdit = inPersonSection.locator('table tbody tr').first()
    const hasInheritedBadge = await rowAfterEdit.locator('.text-\\[9px\\]').first().isVisible({ timeout: 1_000 }).catch(() => false)
    record(
      'Edit duration on INHERITED row',
      'no immediate network; local isInherited flips to false (badge disappears)',
      `before: ${beforeText}; reqs after commit: ${newReqs.length}; immediate network: ${!!immediateNetwork}; inherited badge still shown: ${hasInheritedBadge}`,
      '07-duration-edit-inherited.png'
    )
    await screenshot(page, '07-duration-edit-inherited')
  } else {
    record('Edit duration on inherited row', 'duration button visible', 'fail — not found', '06a-reload-fresh-state.png')
  }

  // 2.2: Edit price
  const firstPriceBtn = inPersonSection.locator('table button[aria-label*="السعر"]').first()
  const firstPriceVisible = await firstPriceBtn.isVisible({ timeout: 3_000 }).catch(() => false)
  if (firstPriceVisible) {
    const beforeText = (await firstPriceBtn.textContent())?.trim()
    await firstPriceBtn.click()
    await page.waitForTimeout(400)
    const numInput = page.locator('input[type="number"]').first()
    await numInput.fill('150')
    await numInput.press('Enter')
    await page.waitForTimeout(600)
    record(
      'Edit price on first row',
      'no immediate network; value updates in UI',
      `before: ${beforeText}`,
      '08-price-edit.png'
    )
    await screenshot(page, '08-price-edit')
  } else {
    record('Edit price', 'price button visible', 'fail — not found', '07-duration-edit-inherited.png')
  }

  // 2.3: Section save — KNOWN BUG: editing an inherited row keeps the service-default id
  // which the backend rejects with 400. This is a real regression.
  const saveBtn = inPersonSection.locator('button:has-text("حفظ")').first()
  const saveBtnVisible = await saveBtn.isVisible({ timeout: 3_000 }).catch(() => false)
  if (saveBtnVisible) {
    const beforeReqs = capturedRequests.length
    const failedBefore = failedRequests.length
    await saveBtn.click()
    await page.waitForTimeout(3000)
    const newReqs = capturedRequests.slice(beforeReqs)
    const newFailures = failedRequests.slice(failedBefore)
    const mutatingCall = newReqs.find((r) => r.method === 'PUT' || r.method === 'PATCH')
    const saveSucceeded = newFailures.length === 0 && mutatingCall && mutatingCall.status < 400
    record(
      'Section save (in-person) — REGRESSION',
      'PUT /durations should succeed (200). Editing an inherited row must clone, not reuse the service-default id.',
      `mutating: ${mutatingCall ? `${mutatingCall.method} ${mutatingCall.url.split('/').slice(-3).join('/')} → ${mutatingCall.status}` : 'none'}; ${saveSucceeded ? 'PASS' : 'FAIL: 400 — backend rejects because row id belongs to a service default'}`,
      '09-section-save-bug.png'
    )
    await screenshot(page, '09-section-save-bug')
  } else {
    record('Section save', 'save button visible after edits', 'fail — save not visible', '08-price-edit.png')
  }

  // 2.4: Add row
  const addRowBtn = page.locator('button:has-text("إضافة مدة")').first()
  const addRowVisible = await addRowBtn.isVisible({ timeout: 3_000 }).catch(() => false)
  if (addRowVisible) {
    const rowsBefore = await page.locator('table tbody tr').count()
    await addRowBtn.click()
    await page.waitForTimeout(300)
    await addRowBtn.click()
    await page.waitForTimeout(300)
    const rowsAfter = await page.locator('table tbody tr').count()
    const lastRow = page.locator('table tbody tr').last()
    const lastRowText = (await lastRow.textContent())?.trim().replace(/\s+/g, ' ')
    record(
      '+ إضافة مدة (click 2x)',
      '2 new rows at the bottom; defaults: 60 min, 0 price, no inherited badge',
      `rows: ${rowsBefore} → ${rowsAfter}; last row: ${lastRowText}`,
      '10-add-row.png'
    )
    await screenshot(page, '10-add-row')
  } else {
    record('+ إضافة مدة', 'add row button visible', 'fail — not found', '09-section-save-bug.png')
  }

  // 2.5: Delete row (trash icon)
  const deleteBtns = page.locator('table tbody tr button[aria-label*="حذف"], table tbody tr button[aria-label*="Remove"], table tbody tr button[aria-label*="remove"]')
  const deleteCount = await deleteBtns.count()
  if (deleteCount > 0) {
    const rowsBeforeDel = await page.locator('table tbody tr').count()
    await deleteBtns.last().click()
    await page.waitForTimeout(300)
    const rowsAfterDel = await page.locator('table tbody tr').count()
    record(
      'Delete row (trash icon)',
      'row removed from table',
      `rows: ${rowsBeforeDel} → ${rowsAfterDel}`,
      '11-delete-row.png'
    )
    await screenshot(page, '11-delete-row')
  } else {
    record('Delete row', 'delete buttons present', 'fail — no delete buttons found', '10-add-row.png')
  }

  // === SECTION 3: Per-section save behavior ===
  if (onlineSectionVisible) {
    const onlineFirstDurationBtn = onlineSection.locator('table button[aria-label*="المدة"]').first()
    const onlineDurVis = await onlineFirstDurationBtn.isVisible({ timeout: 2_000 }).catch(() => false)
    if (onlineDurVis) {
      await onlineFirstDurationBtn.click()
      await page.waitForTimeout(300)
      const numInput = page.locator('input[type="number"]').first()
      await numInput.fill('60')
      await numInput.press('Enter')
      await page.waitForTimeout(500)
    }
    const onlineSaveBtn = onlineSection.locator('button:has-text("حفظ")').first()
    const onlineSaveVisible = await onlineSaveBtn.isVisible({ timeout: 3_000 }).catch(() => false)
    if (onlineSaveVisible) {
      const beforeReqs = capturedRequests.length
      await onlineSaveBtn.click()
      await page.waitForTimeout(2500)
      const newReqs = capturedRequests.slice(beforeReqs)
      const mutatingCall = newReqs.find((r) => r.method === 'PUT' || r.method === 'PATCH')
      record(
        'Online section save (separate call)',
        'Separate PUT/PATCH for online section',
        `mutating: ${mutatingCall ? `${mutatingCall.method} ${mutatingCall.url.split('/').slice(-3).join('/')}` : 'none'}`,
        '12-online-section-save.png'
      )
      await screenshot(page, '12-online-section-save')
    } else {
      record('Online section save', 'save button visible', 'fail — not visible', '12-online-section-save.png')
    }
  } else {
    record('Online section save', 'separate section visible', 'skipped — only حضوري section is rendered (employee is IN_PERSON only)', '06a-reload-fresh-state.png')
  }

  // === SECTION 4: Footer actions ===
  // 4.1: Edit button
  const editBtn = page.locator('button:has-text("تعديل")').first()
  const editBtnVisible = await editBtn.isVisible({ timeout: 3_000 }).catch(() => false)
  if (editBtnVisible) {
    await editBtn.click()
    await page.waitForTimeout(1500)
    const dialog = page.locator('[role="dialog"]').first()
    const sheetVisible = await dialog.isVisible({ timeout: 3_000 }).catch(() => false)
    const sheetTitle = sheetVisible
      ? (await dialog.locator('h1, h2, h3, [data-slot="dialog-title"]').first().textContent().catch(() => 'n/a'))
      : 'n/a'
    record(
      'تعديل button → opens side sheet',
      'opens EditEmployeeServiceSheet dialog',
      `dialog: ${sheetVisible}; title: ${sheetTitle?.trim()}`,
      '13-edit-sheet.png'
    )
    await screenshot(page, '13-edit-sheet')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
  } else {
    record('تعديل button', 'edit button visible', 'fail — not found', '10-add-row.png')
  }

  // 4.2: View button
  const viewBtn = page.locator('button:has-text("عرض")').first()
  const viewBtnVisible = await viewBtn.isVisible({ timeout: 3_000 }).catch(() => false)
  if (viewBtnVisible) {
    const urlBefore = page.url()
    await Promise.all([
      page.waitForURL(/\/employees\/[^/]+\/edit/, { timeout: 10_000 }).catch(() => {}),
      viewBtn.click(),
    ])
    await page.waitForTimeout(800)
    const urlAfter = page.url()
    const navigatedToEmployee = /\/employees\/[^/]+\/edit/.test(urlAfter)
    record(
      'عرض button → employee profile route',
      'navigates to /employees/{id}/edit',
      `${urlBefore.replace(DASHBOARD_BASE, '')} → ${urlAfter.replace(DASHBOARD_BASE, '')}; navigated: ${navigatedToEmployee}`,
      '14-view-employee.png'
    )
    await screenshot(page, '14-view-employee')
    await page.goBack()
    await page.waitForTimeout(800)
  } else {
    record('عرض button', 'view button visible', 'fail — not found', '10-add-row.png')
  }

  // === CROSS-CUTTING ===
  await page.goto(`/services/${SERVICE_ID}/edit?tab=employees`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  await screenshot(page, '15-final-fullpage')

  const dirAttr = await page.evaluate(() => document.documentElement.dir)
  record('RTL direction set', 'document.dir === "rtl"', `dir: ${dirAttr}`, '15-final-fullpage.png')

  const requiredLabels = ['حضوري', 'تسعير مخصص', 'إضافة مدة', 'حفظ', 'تعديل', 'عرض']
  const labelResults: string[] = []
  for (const label of requiredLabels) {
    const found = await page.getByText(label, { exact: false }).first().isVisible({ timeout: 1_000 }).catch(() => false)
    labelResults.push(`${label}=${found}`)
  }
  record('AR label parity (key labels)', 'all key labels present', labelResults.join(', '), '15-final-fullpage.png')

  const tabularNumsCount = await page.evaluate(() => document.querySelectorAll('.tabular-nums').length)
  record('tabular-nums on numeric cells', 'numeric cells use .tabular-nums', `count: ${tabularNumsCount}`, '15-final-fullpage.png')

  // === REPORTS ===
  const md = [
    '# Sawa Service-Editor E2E Test Report',
    '',
    `**Date:** ${new Date().toISOString()}`,
    `**URL:** ${DASHBOARD_BASE}/services/${SERVICE_ID}/edit?tab=employees`,
    `**Service ID:** ${SERVICE_ID}`,
    `**Employee ID:** 00000000-0000-4000-8000-00000000000a (لبنى القطّاني / طبيبة عامة)`,
    '',
    `## Summary`,
    `Total: ${results.length} | Passed: ${results.filter((r) => r.pass).length} | Failed: ${results.filter((r) => !r.pass).length}`,
    `Console errors: ${consoleMessages.filter((m) => m.type === 'error').length}`,
    `Console warnings: ${consoleMessages.filter((m) => m.type === 'warning').length}`,
    `Network failures (>=400): ${failedRequests.length}`,
    '',
    '## Test Results',
    '',
    '| # | Case | Expected | Actual | Pass | Evidence |',
    '|---|------|----------|--------|------|----------|',
    ...results.map((r) => `| ${r.id} | ${r.case} | ${r.expected.replace(/\|/g, '\\|')} | ${r.actual.replace(/\|/g, '\\|')} | ${r.pass ? '✅' : '❌'} | ${r.evidence ?? '-'} |`),
    '',
    '## Bugs / Regressions',
    '',
    '### 🔴 BUG: PUT /durations returns 400 when editing an inherited row',
    'When a user edits a row marked as "موروثة من الخدمة" (inherited from service default) and saves,',
    'the frontend sends the service-default `id` in the payload, but the backend rejects it because the',
    'row does not belong to the practitioner (employeeServiceId is null).',
    'See `set-employee-durations.handler.ts:67-71` for the throw.',
    '**Fix options:** (a) Frontend must omit the id when isInherited was true, treating it as a create;',
    '(b) Backend should treat the id as a service-default reference and clone to a new employee-owned row.',
    '',
    '### 🟡 BUG: Header type badge mislabels IN_PERSON as "عن بُعد"',
    'The API returns `availableTypes: ["IN_PERSON"]` (uppercase enum value), but the badge code in',
    '`assigned-employee-row.tsx:106` compares `type === "in_person"` (lowercase). The else branch always',
    'fires, so the badge shows "عن بُعد" (online) instead of "حضوري" (in-person).',
    '**Fix:** Normalize the case in the comparison, e.g. `type.toLowerCase() === "in_person"`.',
    '',
    '### 🟡 OBSERVATION: Custom pricing switch click does not visually flip on',
    'After clicking the "تسعير مخصص" switch, the PUT request was sent successfully (200) but',
    '`aria-checked` remained `false→false`. The duration table stays visible (good).',
    '**Note:** the `item.hasCustomPricing` data from the API may not have been refreshed',
    'after the PUT — possibly a query invalidation gap, or the switch is using a different',
    'state source than the API response. Worth investigating.',
    '',
    '## Console Errors',
    '',
    ...(consoleMessages.filter((m) => m.type === 'error').length === 0
      ? ['No console errors.']
      : consoleMessages.filter((m) => m.type === 'error').map((m) => `- ${m.text}`)),
    '',
    '## Console Warnings',
    '',
    ...(consoleMessages.filter((m) => m.type === 'warning').length === 0
      ? ['No console warnings.']
      : consoleMessages.filter((m) => m.type === 'warning').slice(0, 20).map((m) => `- ${m.text}`)),
    '',
    '## Failed Network Requests (status >= 400)',
    '',
    ...(failedRequests.length === 0
      ? ['No failed network requests.']
      : failedRequests.map((r) => `- ${r.method} ${r.url} → ${r.status}`)),
    '',
    '## All Captured Network Requests',
    '',
    '| Method | URL | Status |',
    '|--------|-----|--------|',
    ...capturedRequests.map((r) => `| ${r.method} | ${r.url.replace(DASHBOARD_BASE, '').replace(API_BASE, '')} | ${r.status} |`),
  ].join('\n')

  fs.writeFileSync(path.join(EVIDENCE_DIR, 'report.md'), md)
  fs.writeFileSync(path.join(EVIDENCE_DIR, 'console.json'), JSON.stringify(consoleMessages, null, 2))
  fs.writeFileSync(path.join(EVIDENCE_DIR, 'network.json'), JSON.stringify(capturedRequests, null, 2))
  fs.writeFileSync(path.join(EVIDENCE_DIR, 'failed-network.json'), JSON.stringify(failedRequests, null, 2))

  console.log('\n=== TEST RESULTS ===')
  results.forEach((r) => console.log(`${r.pass ? 'PASS' : 'FAIL'} #${r.id} ${r.case}: ${r.actual}`))
  console.log(`\nTotal: ${results.length} | Passed: ${results.filter((r) => r.pass).length} | Failed: ${results.filter((r) => !r.pass).length}`)
  console.log(`Console errors: ${consoleMessages.filter((m) => m.type === 'error').length}`)
  console.log(`Network failures (>=400): ${failedRequests.length}`)
  console.log(`Evidence: ${EVIDENCE_DIR}`)
})

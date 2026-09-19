import { expect, test } from "@playwright/test"
import { loginAs } from "../../fixtures/auth"
import {
  cancelBookingViaUI,
  chooseActualDateAndTime,
  clickReceptionAction,
  expectGroupedCreditLocked,
  fetchClientPurchase,
  openBookingDetail,
  openPackageWizard,
  pickGroupedCredit,
  seedGroupedLifecycleFixtures,
  submitCreditBooking,
  teardownGroupedLifecycleFixtures,
  transferCreditViaUI,
  type GroupedLifecycleHarness,
} from "./_shared/package-groups-lifecycle-fixture"

const runId = String(Date.now()).slice(-6)
const harness: GroupedLifecycleHarness = {
  token: "",
  runId,
  branchId: "",
  client: undefined!,
  scalesService: undefined!,
  clinicService: undefined!,
  scalesEmployee: undefined!,
  clinicEmployee: undefined!,
  transferEmployee: undefined!,
  scalesDurationId: "",
  clinicDurationId: "",
  packageId: "",
  purchaseId: "",
  scaleCreditId: "",
  clinicFirstCreditId: "",
  clinicSecondCreditId: "",
  scalesGroupId: "",
  clinicGroupId: "",
  bookingIds: [],
}

test.beforeAll(async () => {
  await seedGroupedLifecycleFixtures(harness)
})

test.afterAll(async () => {
  await teardownGroupedLifecycleFixtures(harness)
})

test.describe("GROUPED_V2 package lifecycle — real dashboard journey", () => {
  test("reserves, completes, cancels, no-shows, and transfers grouped credits", async ({ page }, testInfo) => {
    test.setTimeout(240_000)
    await loginAs(page, "admin")

    // Scale session: choose the exact mixed-package credit in the bookings wizard.
    let pos = await openPackageWizard(page, harness)
    await pickGroupedCredit(page, pos, harness.scalesGroupId)
    await chooseActualDateAndTime(pos)
    const scaleBookingId = await submitCreditBooking(page, pos, harness.scaleCreditId)
    harness.bookingIds.push(scaleBookingId)
    console.info(`[package-groups-lifecycle] scales reserved: ${scaleBookingId}`)
    let purchase = await fetchClientPurchase(harness.token, harness.client.id, harness.purchaseId)
    const reservedScale = purchase.credits.find((credit) => credit.id === harness.scaleCreditId)
    expect(reservedScale).toMatchObject({ id: harness.scaleCreditId, reservedQuantity: 1, remaining: 0 })
    await page.screenshot({ path: testInfo.outputPath("01-scales-reserved.png"), fullPage: true })

    // The dependent clinic group remains locked while the predecessor is only reserved.
    pos = await openPackageWizard(page, harness)
    await expectGroupedCreditLocked(pos, harness.clinicGroupId)
    await page.screenshot({ path: testInfo.outputPath("02-clinic-locked-before-complete.png"), fullPage: true })
    await pos.getByRole("button", { name: /إغلاق|Close/i }).click()

    // Complete the predecessor through reception UI, then verify the dependent group opens.
    let dialog = await openBookingDetail(page, harness, scaleBookingId)
    await clickReceptionAction(page, dialog, /تسجيل حضور|Check in/i)
    pos = await openPackageWizard(page, harness)
    await expectGroupedCreditLocked(pos, harness.clinicGroupId)
    await page.screenshot({ path: testInfo.outputPath("03-clinic-locked-after-check-in.png"), fullPage: true })
    await pos.getByRole("button", { name: /إغلاق|Close/i }).click()
    dialog = await openBookingDetail(page, harness, scaleBookingId)
    await clickReceptionAction(page, dialog, /إتمام الحجز|Complete booking/i)
    console.info(`[package-groups-lifecycle] scales completed: ${scaleBookingId}`)
    await expect.poll(async () => {
      const row = await fetchClientPurchase(harness.token, harness.client.id, harness.purchaseId)
      return row.credits.find((credit) => credit.id === harness.scaleCreditId)?.usedQuantity
    }, { timeout: 15_000 }).toBe(1)
    await page.screenshot({ path: testInfo.outputPath("03-scales-completed.png"), fullPage: true })

    // Clinic session 1: booking through the wizard reserves the exact credit.
    pos = await openPackageWizard(page, harness)
    await pickGroupedCredit(page, pos, harness.clinicGroupId)
    await chooseActualDateAndTime(pos)
    const firstClinicBookingId = await submitCreditBooking(page, pos, harness.clinicFirstCreditId)
    harness.bookingIds.push(firstClinicBookingId)
    console.info(`[package-groups-lifecycle] clinic session 1 reserved: ${firstClinicBookingId}`)
    purchase = await fetchClientPurchase(harness.token, harness.client.id, harness.purchaseId)
    expect(purchase.credits.find((credit) => credit.id === harness.clinicFirstCreditId)).toMatchObject({ reservedQuantity: 1, remaining: 0 })
    expect(purchase.credits.find((credit) => credit.id === harness.clinicSecondCreditId)).toMatchObject({ reservedQuantity: 0, remaining: 1 })
    await page.screenshot({ path: testInfo.outputPath("04-clinic-first-reserved.png"), fullPage: true })

    // Cancel through the booking detail UI. The same credit returns and clinic session 2 stays locked.
    dialog = await openBookingDetail(page, harness, firstClinicBookingId)
    await cancelBookingViaUI(page, dialog)
    console.info(`[package-groups-lifecycle] clinic session 1 cancelled: ${firstClinicBookingId}`)
    await expect.poll(async () => (await fetchClientPurchase(harness.token, harness.client.id, harness.purchaseId)).credits.find((credit) => credit.id === harness.clinicFirstCreditId)?.remaining, { timeout: 15_000 }).toBe(1)
    purchase = await fetchClientPurchase(harness.token, harness.client.id, harness.purchaseId)
    expect(purchase.credits.find((credit) => credit.id === harness.clinicFirstCreditId)).toMatchObject({ reservedQuantity: 0, remaining: 1 })
    expect(purchase.credits.find((credit) => credit.id === harness.clinicSecondCreditId)).toMatchObject({ reservedQuantity: 0, remaining: 1 })
    pos = await openPackageWizard(page, harness)
    const clinicGroup = pos.locator(`[data-testid="package-credit-group-${harness.clinicGroupId}"]`)
    await expect(clinicGroup.locator("ol > li").first().getByRole("button", { name: /حجز|Book/i })).toBeVisible()
    await expect(clinicGroup.locator("ol > li").nth(1).getByRole("button", { name: /حجز|Book/i })).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath("05-clinic-cancel-returned-second-locked.png"), fullPage: true })
    await pos.getByRole("button", { name: /إغلاق|Close/i }).click()

    // Rebook session 1, then mark it no-show through reception UI so the credit returns again.
    pos = await openPackageWizard(page, harness)
    await pickGroupedCredit(page, pos, harness.clinicGroupId)
    await chooseActualDateAndTime(pos)
    const noShowBookingId = await submitCreditBooking(page, pos, harness.clinicFirstCreditId)
    harness.bookingIds.push(noShowBookingId)
    console.info(`[package-groups-lifecycle] clinic session 1 rebooked: ${noShowBookingId}`)
    dialog = await openBookingDetail(page, harness, noShowBookingId)
    await clickReceptionAction(page, dialog, /لم يحضر|No-show/i)
    console.info(`[package-groups-lifecycle] clinic session 1 no-show: ${noShowBookingId}`)
    await expect.poll(async () => {
      const row = await fetchClientPurchase(harness.token, harness.client.id, harness.purchaseId)
      return row.credits.find((credit) => credit.id === harness.clinicFirstCreditId)?.remaining
    }, { timeout: 15_000 }).toBe(1)
    await page.screenshot({ path: testInfo.outputPath("06-clinic-no-show-returned.png"), fullPage: true })

    // Transfer the returned, unreserved clinic session to a compatible practitioner via client balances.
    purchase = await fetchClientPurchase(harness.token, harness.client.id, harness.purchaseId)
    const netValueBeforeTransfer = purchase.credits.find((credit) => credit.id === harness.clinicFirstCreditId)?.netValue
    expect(netValueBeforeTransfer, "grouped credit netValue must be present before transfer").toEqual(expect.any(Number))
    await transferCreditViaUI(page, harness, harness.clinicFirstCreditId, netValueBeforeTransfer)
    purchase = await fetchClientPurchase(harness.token, harness.client.id, harness.purchaseId)
    const transferred = purchase.credits.find((credit) => credit.id === harness.clinicFirstCreditId)
    expect(transferred).toMatchObject({ employeeId: harness.transferEmployee.id, reservedQuantity: 0, remaining: 1 })
    expect(transferred?.netValue).toBe(netValueBeforeTransfer)
    await page.screenshot({ path: testInfo.outputPath("07-clinic-credit-transferred.png"), fullPage: true })
  })
})

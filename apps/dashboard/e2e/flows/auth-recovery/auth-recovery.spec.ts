/**
 * auth-recovery.spec.ts
 *
 * E2E: forgot-password and reset-password flows.
 *
 * Real routes:
 *   - /forgot-password  → ForgotPasswordForm (request reset email)
 *   - /reset-password?token=... → ResetPasswordForm (submit new password)
 *
 * These flows run *unauthenticated*. They exercise the public
 * /auth/forgot-password (requestStaffPasswordReset) and
 * /auth/reset-password (performStaffPasswordReset) endpoints indirectly by
 * asserting the form's response state.
 *
 * Requires: dashboard on :5203. The form submits call
 * POST /api/v1/auth/request-password-reset; for /forgot-password success path
 * this requires the seeded admin email to be present (returns 204 → success
 * state). /reset-password is tested via form rendering + client-side
 * validation only — the actual perform-password-reset POST requires a real
 * reset token which is sent over email.
 */
import { test, expect, type Page } from '@playwright/test'

// Warm the auth recovery route table before tests start so the page goto +
// heading queries don't trip on cold Turbopack compiles of the (public)
// auth shell + forgot/reset forms.
test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext()
  const page = await context.newPage()
  try {
    await page.goto('/forgot-password', { waitUntil: 'domcontentloaded' })
    await page.goto('/reset-password', { waitUntil: 'domcontentloaded' })
  } finally {
    await context.close()
  }
})

/**
 * Fill a password input deterministically:
 *   1. Wait for the controlled input to be visible AND not disabled.
 *   2. Focus the input via real keyboard interaction (Tab/Click).
 *   3. Clear the value with select-all + delete to reset controlled state.
 *   4. Type each character with `pressSequentially` so React's onChange
 *      observers receive every keystroke.
 *   5. Assert the DOM `value` matches the requested string before returning.
 *
 * Why not `locator.fill()`?
 *   Playwright's `fill()` clears-and-sets via the input element's `value`
 *   descriptor in one atomic op. React's controlled-input onChange may run
 *   asynchronously after hydration; if hydration hasn't finished the
 *   synthetic change event is dropped and the input silently stays empty.
 *   Real keystrokes are processed synchronously per character, so once
 *   hydration is live the value lands.
 *
 * We still wait for `toBeEditable()` (not disabled) BEFORE we type — that
 * covers the hydration gate because the input is rendered before hydration
 * finishes but is wired into React state only after hydration. We then
 * poll-read the DOM value until it matches what we typed, so a slow
 * hydrate-then-render cycle never races against our assertion.
 */
async function typePasswordDeterministically(
  page: Page,
  inputId: '#new-password' | '#confirm-password',
  value: string,
): Promise<void> {
  const input = page.locator(inputId)
  await expect(input).toBeVisible({ timeout: 15_000 })
  await expect(input).toBeEditable({ timeout: 15_000 })
  await input.focus()
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.press('Delete')
  await input.pressSequentially(value, { delay: 8 })
  // Assert the DOM value matches before moving on; in practice this resolves
  // immediately because pressSequentially awaits the keystroke events.
  await expect(input).toHaveValue(value, { timeout: 5_000 })
}

test.describe('Auth recovery flows', () => {
  // Cold dev-server compiles can push loginAs's `expectAuthenticatedShell`
  // (which waits up to 30s for `main`) past its timeout in local runs.
  test.setTimeout(120_000)

  test.describe('Forgot password', () => {
    test('forgot-password page renders the email form', async ({ page }) => {
      await page.goto('/forgot-password', { waitUntil: 'domcontentloaded' })

      const heading = page
        .getByRole('heading', { name: /نسيت كلمة المرور|Forgot Password/i })
        .first()
      await expect(heading).toBeVisible({ timeout: 10_000 })

      // The form's email input has id="email" and a Submit button.
      const emailInput = page.locator('#email')
      await expect(emailInput).toBeVisible({ timeout: 5_000 })

      const submitButton = page.getByRole('button', {
        name: /إرسال رابط الاستعادة|Send Reset Link/i,
      })
      await expect(submitButton).toBeVisible()
      // Disabled until the email is filled.
      await expect(submitButton).toBeDisabled()
    })

    test('submitting a valid email shows the success state', async ({ page }) => {
      await page.goto('/forgot-password')

      await page.locator('#email').fill('admin@sawaa-test.com')

      const submitButton = page.getByRole('button', {
        name: /إرسال رابط الاستعادة|Send Reset Link/i,
      }).first()
      await submitButton.click()

      // Success state: t("forgotPassword.successTitle") = "تحقق من بريدك" /
      // "Check your email" rendered as <h2>. The success view replaces the
      // form entirely.
      const successHeading = page
        .getByRole('heading', { name: /تحقق من بريدك|Check your email/i })
        .first()
      await expect(successHeading).toBeVisible({ timeout: 15_000 })

      // Body paragraph: t("forgotPassword.successBody").
      await expect(
        page.getByText(/30 دقيقة|30 minutes/i).first(),
      ).toBeVisible({ timeout: 5_000 })

      const backLink = page.getByRole('link', {
        name: /العودة لتسجيل الدخول|Back to Sign In/i,
      }).first()
      await expect(backLink).toBeVisible()
      await expect(backLink).toHaveAttribute('href', '/')
    })
  })

  test.describe('Reset password', () => {
    test('reset-password without a token shows the invalid-token message', async ({ page }) => {
      await page.goto('/reset-password', { waitUntil: 'domcontentloaded' })

      // Wait for the Suspense fallback (null) to resolve before asserting on
      // the inner form. The form checks for ?token= and renders an inline
      // error from t("resetPassword.invalidToken") = "الرابط غير صالح أو
      // منتهي الصلاحية" / "This link is invalid or has expired".
      await expect(
        page
          .getByText(
            /الرابط غير صالح أو منتهي الصلاحية|This link is invalid or has expired/i,
          )
          .first(),
      ).toBeVisible({ timeout: 15_000 })

      const backLink = page.getByRole('link', {
        name: /تسجيل الدخول|Go to sign in/i,
      }).first()
      await expect(backLink).toBeVisible()
      await expect(backLink).toHaveAttribute('href', '/')
    })

    test('reset-password with a token renders the new-password form', async ({ page }) => {
      // Use a fake but well-formed token — the form renders regardless; only
      // the submit POST would surface a 4xx, which we don't trigger here.
      await page.goto('/reset-password?token=fake-token-for-render-check', {
        waitUntil: 'domcontentloaded',
      })

      const heading = page
        .getByRole('heading', {
          name: /إعادة تعيين كلمة المرور|Reset Password/i,
        })
        .first()
      await expect(heading).toBeVisible({ timeout: 10_000 })

      const newPasswordInput = page.locator('#new-password')
      const confirmInput = page.locator('#confirm-password')
      await expect(newPasswordInput).toBeVisible({ timeout: 5_000 })
      await expect(confirmInput).toBeVisible()

      // Submit button is disabled until both fields are non-empty.
      const submitButton = page.locator('form button[type="submit"]')
      await expect(submitButton).toBeDisabled()

      // Type into both fields via pressSequentially; assert the value lands
      // before checking the submit button enables. This protects against
      // the hydration race where controlled inputs drop `fill()`.
      await typePasswordDeterministically(page, '#new-password', 'Test1234')
      await typePasswordDeterministically(page, '#confirm-password', 'Test1234')
      await expect(submitButton).toBeEnabled()
    })

    test('reset-password form rejects mismatched passwords', async ({ page }) => {
      await page.goto('/reset-password?token=fake-token-for-validation', {
        waitUntil: 'domcontentloaded',
      })

      // Wait for React to hydrate the form before filling — the page reaches
      // domcontentloaded before the useState/useEffect handlers are wired up,
      // and filling before hydration silently drops the input. We pair the
      // visibility wait with the deterministic keyboard typing helper.
      await typePasswordDeterministically(page, '#new-password', 'Test1234')
      await typePasswordDeterministically(page, '#confirm-password', 'Different1')

      const submitButton = page.locator('form button[type="submit"]')
      await expect(submitButton).toBeEnabled({ timeout: 5_000 })
      await submitButton.click()

      // Mismatch surfaces t("resetPassword.passwordMismatch") = "كلمتا المرور
      // غير متطابقتين" / "Passwords do not match" in the inline error banner.
      await expect(
        page
          .getByText(/غير متطابقتين|do not match/i)
          .first(),
      ).toBeVisible({ timeout: 5_000 })
      await expect(page.locator('#new-password')).toBeVisible()
    })

    test('reset-password form rejects a weak password', async ({ page }) => {
      await page.goto('/reset-password?token=fake-token-for-validation', {
        waitUntil: 'domcontentloaded',
      })

      // 8 chars but no uppercase + no digit — fails the strong-password schema.
      await typePasswordDeterministically(page, '#new-password', 'weakpass')
      await typePasswordDeterministically(page, '#confirm-password', 'weakpass')

      const submitButton = page.locator('form button[type="submit"]')
      await expect(submitButton).toBeEnabled({ timeout: 5_000 })
      await submitButton.click()

      // t("resetPassword.weakPassword") = "كلمة المرور يجب أن تكون 8 أحرف
      // على الأقل" / "Password must be at least 8 characters" rendered in
      // the inline error banner.
      await expect(
        page
          .getByText(/8 أحرف|at least 8 characters/i)
          .first(),
      ).toBeVisible({ timeout: 5_000 })
      await expect(page.locator('#new-password')).toBeVisible()
    })
  })
})

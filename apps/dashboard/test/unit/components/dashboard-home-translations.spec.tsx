/**
 * TodayPulse — real-translation integration test
 *
 * Regression guard for the dashboard home raw-keys bug. TodayPulse uses
 * `t("dashboard.todayPulse.*")`. If the production translation chain ever
 * drops the dashboard keys (e.g. a refactor of `lib/translations.ts` that
 * forgets to merge `arDashboard` / `enDashboard` into the runtime
 * `translations` map), `t(key)` falls back to returning the key string and
 * the UI flashes `dashboard.todayPulse.title` instead of "نبض اليوم".
 *
 * The mocked `useLocale` tests in `today-pulse.spec.tsx` cannot catch this
 * — they replace the provider with a hard-coded lookup table. This file
 * mounts the REAL `LocaleProvider` so the lookup hits the real
 * `lib/translations` module graph.
 *
 * Asserts:
 *  - Rendered DOM contains no raw `dashboard.todayPulse.*` key.
 *  - Arabic (default locale) renders the real AR strings.
 *  - English (after `toggleLocale`) renders the real EN strings.
 *  - The parity verifier's expected keys (from
 *    `scripts/verify-translation-parity.mjs`) are all present in the
 *    AR/EN dashboard modules — defensive check that the resource
 *    files were not deleted between the bug report and this run.
 */

import { describe, expect, it } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { LocaleProvider, useLocale } from "@/components/locale-provider"
import { TodayPulse } from "@/components/features/dashboard/today-pulse"
import { arDashboard } from "@/lib/translations/ar.dashboard"
import { enDashboard } from "@/lib/translations/en.dashboard"

// These keys must be present in BOTH the AR and EN dashboard modules.
// If the parity verifier ever flips, this test fires first and gives a
// focused message instead of a wall of "missing key" warnings.
const REQUIRED_KEYS = [
  "dashboard.todayPulse.title",
  "dashboard.todayPulse.total",
  "dashboard.todayPulse.confirmed",
  "dashboard.todayPulse.pending",
  "dashboard.todayPulse.awaitingPayment",
] as const

function assertKeyShape() {
  for (const k of REQUIRED_KEYS) {
    expect(arDashboard[k], `ar.dashboard.ts missing key: ${k}`).toBeTypeOf(
      "string",
    )
    expect(enDashboard[k], `en.dashboard.ts missing key: ${k}`).toBeTypeOf(
      "string",
    )
  }
}

function ToggleProbe() {
  const { toggleLocale } = useLocale()
  return (
    <button type="button" onClick={toggleLocale}>
      toggle-locale
    </button>
  )
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <ToggleProbe />
      {children}
    </LocaleProvider>
  )
}

describe("dashboard home widget — real translation chain", () => {
  it("ar.dashboard / en.dashboard export every required key", () => {
    assertKeyShape()
  })

  it("TodayPulse renders Arabic labels and no raw keys (default locale = ar)", () => {
    render(
      <Wrapper>
        <TodayPulse
          visible
          total={12}
          confirmed={3}
          pending={5}
          awaitingPayment={2}
        />
      </Wrapper>,
    )

    const strip = screen.getByTestId("today-pulse")

    expect(strip.textContent).toContain(arDashboard["dashboard.todayPulse.total"])
    expect(strip.textContent).toContain(
      arDashboard["dashboard.todayPulse.confirmed"],
    )
    expect(strip.textContent).toContain(
      arDashboard["dashboard.todayPulse.pending"],
    )
    expect(strip.textContent).toContain(
      arDashboard["dashboard.todayPulse.awaitingPayment"],
    )

    // The aria-label is the canonical place for the title; it must be the
    // resolved translation, not the raw key.
    expect(strip.getAttribute("aria-label")).toBe(
      arDashboard["dashboard.todayPulse.title"],
    )

    // No raw key string should leak into the DOM anywhere.
    expect(strip.textContent ?? "").not.toMatch(/dashboard\.todayPulse\./)
  })

  it("TodayPulse renders English labels after toggleLocale", async () => {
    const user = userEvent.setup()
    render(
      <Wrapper>
        <TodayPulse
          visible
          total={1}
          confirmed={1}
          pending={0}
          awaitingPayment={0}
        />
      </Wrapper>,
    )

    // Initial state is ar — flip to en so we cover both locales through
    // the same provider instance.
    await user.click(screen.getByRole("button", { name: /toggle-locale/i }))

    await waitFor(() => {
      const strip = screen.getByTestId("today-pulse")
      expect(strip.getAttribute("aria-label")).toBe(
        enDashboard["dashboard.todayPulse.title"],
      )
      expect(strip.textContent).toContain(
        enDashboard["dashboard.todayPulse.confirmed"],
      )
    })

    const strip = screen.getByTestId("today-pulse")
    expect(strip.textContent ?? "").not.toMatch(/dashboard\.todayPulse\./)
  })
})
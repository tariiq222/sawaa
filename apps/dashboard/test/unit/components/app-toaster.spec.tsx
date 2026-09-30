import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { toast } from "sonner"
import { AppToaster as Toaster } from "@/components/app-toaster"
import { LocaleProvider, useLocale } from "@/components/locale-provider"

vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() })))
function Toggle() {
  const { toggleLocale } = useLocale()
  return <button onClick={toggleLocale}>Change language</button>
}
afterEach(() => { act(() => { toast.dismiss() }) })

describe("application toast localization", () => {
  it("announces Arabic notifications and follows locale changes", async () => {
    render(<LocaleProvider><Toggle /><Toaster /></LocaleProvider>)
    act(() => { toast.success("تم حفظ البيانات", { duration: Infinity }) })
    expect(await screen.findByText("تم حفظ البيانات")).toBeVisible()
    expect(screen.getByRole("region", { name: /الإشعارات/ })).toBeVisible()
    expect(screen.getByRole("list")).toHaveAttribute("dir", "rtl")
    await userEvent.setup().click(screen.getByRole("button", { name: "Change language" }))
    await waitFor(() => expect(screen.getByRole("list")).toHaveAttribute("dir", "ltr"))
    expect(screen.getByRole("region", { name: /Notifications/ })).toBeVisible()
  })
})

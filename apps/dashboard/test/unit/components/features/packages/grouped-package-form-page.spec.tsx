import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { UseFormReturn } from "react-hook-form"
import type { GroupedPackageFormData } from "@/lib/schemas/package-groups.schema"

const toastError = vi.hoisted(() => vi.fn())
const focusError = vi.hoisted(() => vi.fn())
vi.mock("sonner", () => ({ toast: { error: toastError, success: vi.fn(), warning: vi.fn() } }))
vi.mock("@/lib/package-validation", () => ({ collectPackageErrorPaths: () => [], focusPackageError: focusError }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("@/hooks/use-packages", () => ({ usePackage: () => ({ data: undefined, isLoading: false }), usePackageMutations: () => ({ createMut: { isPending: false, mutateAsync: vi.fn() }, updateMut: { isPending: false, mutateAsync: vi.fn() } }) }))
vi.mock("@/lib/api/packages", () => ({ uploadPackageImage: vi.fn() }))
vi.mock("@/components/locale-provider", () => ({ useLocale: () => ({ locale: "en", dir: "ltr", t: (key: string) => key }) }))
vi.mock("@/components/features/list-page-shell", () => ({ ListPageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
vi.mock("@/components/features/page-header", () => ({ PageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }))
vi.mock("@/components/features/breadcrumbs", () => ({ Breadcrumbs: () => <div /> }))
vi.mock("@/components/features/packages/grouped-package-details", () => ({ GroupedPackageDetails: ({ form }: { form: UseFormReturn<GroupedPackageFormData> }) => <input id="nameAr" {...form.register("nameAr")} /> }))
vi.mock("@/components/features/packages/grouped-package-groups", () => ({ GroupedPackageGroups: ({ form }: { form: UseFormReturn<GroupedPackageFormData> }) => <section data-package-section="groups"><select id="groups.0.serviceId" {...form.register("groups.0.serviceId")} /><select id="groups.0.employeeId" {...form.register("groups.0.employeeId")} /></section> }))
vi.mock("@/components/features/packages/grouped-package-pricing", () => ({ GroupedPackagePricing: () => <div /> }))
vi.mock("@/components/features/packages/grouped-package-review", () => ({ GroupedPackageReview: () => <div /> }))

import { GroupedPackageFormPage } from "@/components/features/packages/grouped-package-form-page"

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><GroupedPackageFormPage mode="create" /></QueryClientProvider>)
}

describe("GroupedPackageFormPage navigation validation", () => {
  it("advances past valid details even while later group fields are empty", () => {
    renderPage()
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Valid package" } })
    fireEvent.click(screen.getByRole("button", { name: "packages.steps.next" }))
    expect(screen.getAllByLabelText("packages.steps.label")[0].querySelector('[aria-current="step"]')).toHaveTextContent("packages.grouped.steps.groups")
  })

  it("focuses the first invalid group control on the groups step", async () => {
    renderPage()
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Valid package" } })
    fireEvent.click(screen.getByRole("button", { name: "packages.steps.next" }))
    fireEvent.click(screen.getByRole("button", { name: "packages.steps.next" }))
    await waitFor(() => expect(focusError).toHaveBeenCalledWith("groups.0.serviceId"))
    expect(toastError).toHaveBeenCalledWith("packages.errors.stepSummary")
  })
})

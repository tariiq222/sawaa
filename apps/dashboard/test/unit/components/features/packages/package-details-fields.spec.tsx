import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type PropsWithChildren,
  type ReactNode,
} from "react"
import { useForm } from "react-hook-form"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({
    locale: "ar",
    dir: "rtl" as const,
    t: (key: string) => key,
    toggleLocale: vi.fn(),
  }),
}))

vi.mock("@/hooks/use-employees", () => ({
  useAllEmployees: () => ({
    employees: [{ id: "owner-id", isActive: true, name: "Owner A" }],
  }),
}))

vi.mock("@/components/features/shared/service-avatar-picker", () => ({
  ServiceAvatarPicker: () => null,
}))

vi.mock("@sawaa/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@sawaa/ui")>()
  type FakeSelectProps = PropsWithChildren<{
    value?: string
    onValueChange: (value: string) => void
  }>
  type FakeContentProps = PropsWithChildren
  type FakeItemProps = PropsWithChildren<{ value?: string }>
  type FakeTriggerProps = PropsWithChildren<
    ButtonHTMLAttributes<HTMLButtonElement>
  >
  type FakeValueProps = { placeholder?: ReactNode }

  const FakeSelect = ({ value, onValueChange, children }: FakeSelectProps) => {
    const emittedHydrationValue = useRef(false)
    useEffect(() => {
      if (value === "owner-id" && !emittedHydrationValue.current) {
        emittedHydrationValue.current = true
        onValueChange("")
      }
    }, [onValueChange, value])
    return (
      <div data-testid="owner-select" data-value={value}>
        <button
          type="button"
          data-testid="owner-empty"
          onClick={() => onValueChange("")}
        />
        <button
          type="button"
          data-testid="owner-same"
          onClick={() => onValueChange("owner-id")}
        />
        {children}
      </div>
    )
  }
  const FakeSelectContent = ({ children }: FakeContentProps) => (
    <div>{children}</div>
  )
  const FakeSelectItem = ({ children }: FakeItemProps) => <div>{children}</div>
  const FakeSelectTrigger = ({ children, ...props }: FakeTriggerProps) => (
    <button {...props}>{children}</button>
  )
  const FakeSelectValue = ({ placeholder }: FakeValueProps) => (
    <span>{placeholder}</span>
  )

  return {
    ...actual,
    Select: FakeSelect,
    SelectContent: FakeSelectContent,
    SelectItem: FakeSelectItem,
    SelectTrigger: FakeSelectTrigger,
    SelectValue: FakeSelectValue,
  }
})

import { PackageDetailsFields } from "@/components/features/packages/package-details-fields"
import { DEFAULT_PACKAGE_EDITOR_VALUES } from "@/lib/package-editor-defaults"
import type { PackageFormData } from "@/lib/schemas/package.schema"

function HydrationHarness() {
  const form = useForm<PackageFormData>({
    defaultValues: DEFAULT_PACKAGE_EDITOR_VALUES,
  })
  const owner = form.watch("ownerEmployeeId")
  const revision = form.watch("ownerChangeRevision")

  useEffect(() => {
    form.reset({
      ...DEFAULT_PACKAGE_EDITOR_VALUES,
      ownerEmployeeId: "owner-id",
      ownerChangeRevision: 0,
    })
  }, [form])

  return (
    <>
      <PackageDetailsFields form={form} translateError={(message) => message} />
      <output data-testid="owner-value">{owner ?? "null"}</output>
      <output data-testid="owner-revision">{revision ?? "null"}</output>
      <output data-testid="form-dirty">{String(form.formState.isDirty)}</output>
    </>
  )
}

describe("PackageDetailsFields owner hydration", () => {
  it("ignores Radix empty hydration and same-owner callbacks", async () => {
    const user = userEvent.setup()
    render(<HydrationHarness />)

    await waitFor(() =>
      expect(screen.getByTestId("owner-value")).toHaveTextContent("owner-id")
    )
    await user.click(screen.getByTestId("owner-same"))
    await user.click(screen.getByTestId("owner-empty"))

    expect(screen.getByTestId("owner-select")).toHaveAttribute(
      "data-value",
      "owner-id"
    )
    expect(screen.getByTestId("owner-revision")).toHaveTextContent("0")
    expect(screen.getByTestId("form-dirty")).toHaveTextContent("false")
  })
})

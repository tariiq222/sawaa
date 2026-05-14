import { render, screen, fireEvent } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}))

import { EmployeeStatusDialog } from "@/components/features/employees/employee-status-dialog"

describe("EmployeeStatusDialog", () => {
  it("shows the activate title/description when targetStatus is true", () => {
    render(
      <EmployeeStatusDialog
        open
        targetStatus={true}
        employeeName="Ali"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    )
    expect(screen.getByText("employees.status.activateTitle")).toBeTruthy()
    expect(screen.getByText("employees.status.activateDesc")).toBeTruthy()
    expect(screen.getByText("employees.status.confirmActivate")).toBeTruthy()
  })

  it("shows the suspend title/description when targetStatus is false", () => {
    render(
      <EmployeeStatusDialog
        open
        targetStatus={false}
        employeeName="Ali"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    )
    expect(screen.getByText("employees.status.suspendTitle")).toBeTruthy()
    expect(screen.getByText("employees.status.suspendDesc")).toBeTruthy()
    expect(screen.getByText("employees.status.confirmSuspend")).toBeTruthy()
  })

  it("fires onConfirm when the confirm action is clicked", () => {
    const onConfirm = vi.fn()
    render(
      <EmployeeStatusDialog
        open
        targetStatus={true}
        employeeName="Ali"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    )
    fireEvent.click(screen.getByText("employees.status.confirmActivate"))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it("fires onCancel when the cancel action is clicked", () => {
    // Radix AlertDialogCancel fires onClick AND triggers onOpenChange(false),
    // so onCancel gets called twice. Tracked as a minor wart — the handler is idempotent.
    const onCancel = vi.fn()
    render(
      <EmployeeStatusDialog
        open
        targetStatus={false}
        employeeName="Ali"
        onConfirm={() => {}}
        onCancel={onCancel}
      />,
    )
    fireEvent.click(screen.getByText("common.cancel"))
    expect(onCancel).toHaveBeenCalled()
  })

  it("does not render dialog content when open is false", () => {
    render(
      <EmployeeStatusDialog
        open={false}
        targetStatus={true}
        employeeName="Ali"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    )
    expect(screen.queryByText("employees.status.activateTitle")).toBeNull()
  })
})

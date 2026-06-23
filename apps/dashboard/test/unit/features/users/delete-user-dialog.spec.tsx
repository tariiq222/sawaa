/**
 * delete-user-dialog.spec.tsx — regression guard for the `onDeleted` bugfix.
 *
 * The dialog was given an optional `onDeleted?: () => void` callback that must
 * fire on a SUCCESSFUL delete only. Specifically:
 *   - SUCCESS path:  await deleteMut.mutateAsync → toast.success → onOpenChange(false)
 *                    → onDeleted() (exactly once).
 *   - ERROR path:    mutateAsync rejects → showApiError → onDeleted MUST NOT fire,
 *                    onOpenChange(false) MUST NOT fire (dialog stays open so the
 *                    user can retry or close it manually).
 *   - CANCEL path:   clicking the cancel button → onOpenChange(false) → onDeleted
 *                    MUST NOT fire, mutateAsync MUST NOT be called.
 *
 * These tests assert the wiring, not the visuals — a "did not throw" test would
 * miss the regression we are guarding against.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import type { User } from "@/lib/types/user"

// ─── Hoisted mocks (referenced inside vi.mock factories) ────────────────────

const { useUserMutations } = vi.hoisted(() => ({
  useUserMutations: vi.fn(),
}))

const { showApiError } = vi.hoisted(() => ({
  showApiError: vi.fn(),
}))

const toastSuccess = vi.hoisted(() => vi.fn())
const toastError = vi.hoisted(() => vi.fn())

vi.mock("@/hooks/use-users", () => ({
  useUserMutations,
}))

// Locale returns the key unchanged so assertions can target the i18n keys
// directly (matches the convention used by record-payment-dialog.spec.tsx).
vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string) => key,
    locale: "ar",
    dir: "rtl" as const,
    toggleLocale: vi.fn(),
  }),
}))

vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: toastError },
}))

vi.mock("@/lib/mutation-helpers", () => ({
  showApiError,
}))

// ─── Test helpers ───────────────────────────────────────────────────────────

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "u-1",
    ref: 1,
    email: "ali@example.com",
    name: "علي",
    phone: null,
    gender: null,
    avatarUrl: null,
    isActive: true,
    role: "ADMIN",
    customRoleId: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  }
}

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function W({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
  W.displayName = "TestWrapper"
  return W
}

// Component import must come after vi.mock declarations.
import { DeleteUserDialog } from "@/components/features/users/delete-user-dialog"

describe("DeleteUserDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function setupDeleteMut(overrides: { mutateAsync?: ReturnType<typeof vi.fn>; isPending?: boolean } = {}) {
    const mutateAsync = overrides.mutateAsync ?? vi.fn().mockResolvedValue(undefined)
    useUserMutations.mockReturnValue({
      deleteMut: { mutateAsync, isPending: overrides.isPending ?? false },
    })
    return { mutateAsync }
  }

  it("calls deleteMut.mutateAsync with user.id and fires onDeleted exactly once on success", async () => {
    const { mutateAsync } = setupDeleteMut()
    const onDeleted = vi.fn()
    const onOpenChange = vi.fn()

    render(
      <DeleteUserDialog
        user={makeUser()}
        open
        onOpenChange={onOpenChange}
        onDeleted={onDeleted}
      />,
      { wrapper: makeWrapper() },
    )

    fireEvent.click(screen.getByText("users.delete.submit"))

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledTimes(1)
    })
    expect(mutateAsync).toHaveBeenCalledWith("u-1")

    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledTimes(1)
    })
    expect(toastSuccess).toHaveBeenCalledTimes(1)
    expect(toastSuccess).toHaveBeenCalledWith("users.delete.success")
    // onOpenChange(false) must fire on success — exactly once.
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onOpenChange).toHaveBeenCalledTimes(1)
  })

  it("does not call onDeleted when the cancel button is clicked", () => {
    const { mutateAsync } = setupDeleteMut()
    const onDeleted = vi.fn()
    const onOpenChange = vi.fn()

    render(
      <DeleteUserDialog
        user={makeUser()}
        open
        onOpenChange={onOpenChange}
        onDeleted={onDeleted}
      />,
      { wrapper: makeWrapper() },
    )

    fireEvent.click(screen.getByText("users.delete.cancel"))

    // Cancel path: onOpenChange fires, mutation NEVER runs, onDeleted NEVER runs.
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(mutateAsync).not.toHaveBeenCalled()
    expect(onDeleted).not.toHaveBeenCalled()
  })

  it("does not call onDeleted or close the dialog when the mutation rejects", async () => {
    const failingMutate = vi.fn().mockRejectedValue(new Error("boom"))
    setupDeleteMut({ mutateAsync: failingMutate })
    const onDeleted = vi.fn()
    const onOpenChange = vi.fn()

    render(
      <DeleteUserDialog
        user={makeUser()}
        open
        onOpenChange={onOpenChange}
        onDeleted={onDeleted}
      />,
      { wrapper: makeWrapper() },
    )

    fireEvent.click(screen.getByText("users.delete.submit"))

    await waitFor(() => {
      expect(failingMutate).toHaveBeenCalledWith("u-1")
    })

    // Error path: showApiError MUST be called with the error and the
    // user-visible fallback string. The dialog stays open so the user can retry
    // or close it themselves — onOpenChange(false) MUST NOT be called.
    await waitFor(() => {
      expect(showApiError).toHaveBeenCalledTimes(1)
    })
    const [errorArg, opts] = showApiError.mock.calls[0]!
    expect(errorArg).toBeInstanceOf(Error)
    expect((errorArg as Error).message).toBe("boom")
    expect(opts).toMatchObject({ fallback: "users.delete.error" })

    expect(onDeleted).not.toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(toastSuccess).not.toHaveBeenCalled()
  })

  it("disables the submit button while deleteMut.isPending is true", () => {
    setupDeleteMut({ isPending: true })

    render(
      <DeleteUserDialog
        user={makeUser()}
        open
        onOpenChange={vi.fn()}
      />,
      { wrapper: makeWrapper() },
    )

    // While pending, the button label flips to the submitting copy.
    const submit = screen.getByText("users.delete.submitting").closest("button")!
    expect(submit).toBeDisabled()
  })
})

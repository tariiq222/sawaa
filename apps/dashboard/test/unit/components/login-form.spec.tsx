import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import React from "react"

const mockUseLoginFlow = vi.hoisted(() => vi.fn())

vi.mock("@/components/features/login/use-login-flow", () => ({
  useLoginFlow: mockUseLoginFlow,
}))

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
  LocaleProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Step components are covered by their own tests — here we verify that
// LoginForm routes to the correct step and wires the flow callbacks.
vi.mock("@/components/features/login/identifier-step", () => ({
  IdentifierStep: ({ onSubmit }: { onSubmit: (id: string) => void }) => (
    <div data-testid="identifier-step">
      <button onClick={() => onSubmit("test@test.com")}>submit-identifier</button>
    </div>
  ),
}))

vi.mock("@/components/features/login/method-step", () => ({
  MethodStep: () => <div data-testid="method-step">Method Step</div>,
}))

vi.mock("@/components/features/login/combined-step", () => ({
  CombinedStep: ({ onSubmit }: { onSubmit: (password: string) => void }) => (
    <div data-testid="combined-step">
      <button onClick={() => onSubmit("password123")}>submit-password</button>
    </div>
  ),
}))

vi.mock("@/components/features/login/otp-step", () => ({
  OtpStep: ({ onBack }: { onBack: () => void }) => (
    <div data-testid="otp-step">
      OTP Step
      <button onClick={onBack}>back</button>
    </div>
  ),
}))

import { LoginForm } from "@/components/features/login-form"

const baseFlow = {
  step: "identifier" as const,
  identifier: "",
  error: null,
  loading: false,
  otpSentAt: null,
  lookupResult: null,
  submitIdentifier: vi.fn(),
  selectMethod: vi.fn(),
  submitPassword: vi.fn(),
  submitOtp: vi.fn(),
  resendOtp: vi.fn(),
  backToIdentifier: vi.fn(),
  backToMethod: vi.fn(),
  clearError: vi.fn(),
}

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseLoginFlow.mockReturnValue(baseFlow)
  })

  it("renders the identifier step by default", () => {
    render(<LoginForm />)
    expect(screen.getByTestId("identifier-step")).toBeInTheDocument()
    expect(screen.queryByTestId("method-step")).not.toBeInTheDocument()
    expect(screen.queryByTestId("combined-step")).not.toBeInTheDocument()
    expect(screen.queryByTestId("otp-step")).not.toBeInTheDocument()
  })

  it("calls submitIdentifier from the identifier step", async () => {
    render(<LoginForm />)
    await userEvent.click(screen.getByRole("button", { name: "submit-identifier" }))
    expect(baseFlow.submitIdentifier).toHaveBeenCalledWith("test@test.com")
  })

  it("renders the method step when step is 'method'", () => {
    mockUseLoginFlow.mockReturnValue({ ...baseFlow, step: "method" })
    render(<LoginForm />)
    expect(screen.getByTestId("method-step")).toBeInTheDocument()
    expect(screen.queryByTestId("identifier-step")).not.toBeInTheDocument()
  })

  it("renders the combined (password) step when step is 'password'", () => {
    mockUseLoginFlow.mockReturnValue({ ...baseFlow, step: "password" })
    render(<LoginForm />)
    expect(screen.getByTestId("combined-step")).toBeInTheDocument()
  })

  it("calls submitPassword from the combined step", async () => {
    mockUseLoginFlow.mockReturnValue({ ...baseFlow, step: "password" })
    render(<LoginForm />)
    await userEvent.click(screen.getByRole("button", { name: "submit-password" }))
    expect(baseFlow.submitPassword).toHaveBeenCalledWith("password123")
  })

  it("renders the otp step when step is 'otp'", () => {
    mockUseLoginFlow.mockReturnValue({ ...baseFlow, step: "otp", identifier: "test@test.com" })
    render(<LoginForm />)
    expect(screen.getByTestId("otp-step")).toBeInTheDocument()
  })

  it("calls backToMethod when Back is clicked in the otp step", async () => {
    mockUseLoginFlow.mockReturnValue({ ...baseFlow, step: "otp", identifier: "test@test.com" })
    render(<LoginForm />)
    await userEvent.click(screen.getByRole("button", { name: "back" }))
    expect(baseFlow.backToMethod).toHaveBeenCalled()
  })

  it("shows the welcome title on the identifier step", () => {
    render(<LoginForm />)
    expect(screen.getByText("login.welcome")).toBeInTheDocument()
  })

  it("shows the otp title on the otp step", () => {
    mockUseLoginFlow.mockReturnValue({ ...baseFlow, step: "otp", identifier: "test@test.com" })
    render(<LoginForm />)
    expect(screen.getByText("login.otp.title")).toBeInTheDocument()
  })

  it("does not render the otp step on the identifier step", () => {
    render(<LoginForm />)
    expect(screen.queryByTestId("otp-step")).not.toBeInTheDocument()
  })
})

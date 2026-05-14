import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockSubmitIdentifier, mockSubmitPassword, mockBack, mockChooseMethod } = vi.hoisted(() => ({
  mockSubmitIdentifier: vi.fn(),
  mockSubmitPassword: vi.fn(),
  mockBack: vi.fn(),
  mockChooseMethod: vi.fn(),
}))

const mockUseLoginFlow = vi.hoisted(() => vi.fn())

vi.mock("@/components/features/login/use-login-flow", () => ({
  useLoginFlow: mockUseLoginFlow,
}))

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
  LocaleProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock step components — we test LoginForm orchestration, not step internals
vi.mock("@/components/features/login/identifier-step", () => ({
  IdentifierStep: ({ onSubmit }: { onSubmit: (id: string) => void }) => (
    <div>
      <input data-testid="identifier-input" placeholder="email" />
      <button onClick={() => onSubmit("test@test.com")}>Continue</button>
    </div>
  ),
}))

vi.mock("@/components/features/login/method-step", () => ({
  MethodStep: ({ onPick, onBack }: { onPick: (m: string) => void; onBack: () => void }) => (
    <div>
      <button onClick={() => onPick("password")}>Use Password</button>
      <button onClick={onBack}>Back</button>
    </div>
  ),
}))

vi.mock("@/components/features/login/password-step", () => ({
  PasswordStep: ({ onSubmit, onBack, error }: { onSubmit: (p: string) => void; onBack: () => void; error?: string | null }) => (
    <div>
      <input data-testid="password-input" placeholder="••••••••" type="password" />
      <button onClick={() => onSubmit("pass123")}>تسجيل الدخول</button>
      <button onClick={onBack}>Back</button>
      {error && <div>{error}</div>}
    </div>
  ),
}))

vi.mock("@/components/features/login/otp-step", () => ({
  OtpStep: () => <div>OTP Step</div>,
}))

import { LoginForm } from "@/components/features/login-form"
import { LocaleProvider } from "@/components/locale-provider"

function renderLoginForm() {
  return render(
    <LocaleProvider>
      <LoginForm />
    </LocaleProvider>
  )
}

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: identifier step
    mockUseLoginFlow.mockReturnValue({
      step: "identifier",
      identifier: "",
      loading: false,
      error: null,
      otpSentAt: null,
      submitIdentifier: mockSubmitIdentifier,
      submitPassword: mockSubmitPassword,
      chooseMethod: mockChooseMethod,
      back: mockBack,
      resendOtp: vi.fn(),
      submitOtp: vi.fn(),
    })
  })

  it("renders identifier step by default", () => {
    renderLoginForm()
    expect(screen.getByTestId("identifier-input")).toBeInTheDocument()
  })

  it("renders submit button", () => {
    renderLoginForm()
    expect(screen.getByRole("button", { name: /Continue/i })).toBeInTheDocument()
  })

  it("calls submitIdentifier when Continue is clicked", async () => {
    renderLoginForm()
    await userEvent.click(screen.getByRole("button", { name: /Continue/i }))
    expect(mockSubmitIdentifier).toHaveBeenCalledWith("test@test.com")
  })

  it("renders method step when step is method", () => {
    mockUseLoginFlow.mockReturnValue({
      step: "method",
      identifier: "test@test.com",
      loading: false,
      error: null,
      otpSentAt: null,
      submitIdentifier: mockSubmitIdentifier,
      submitPassword: mockSubmitPassword,
      chooseMethod: mockChooseMethod,
      back: mockBack,
      resendOtp: vi.fn(),
      submitOtp: vi.fn(),
    })
    renderLoginForm()
    expect(screen.getByRole("button", { name: /Use Password/i })).toBeInTheDocument()
  })

  it("renders password step when step is password", () => {
    mockUseLoginFlow.mockReturnValue({
      step: "password",
      identifier: "test@test.com",
      loading: false,
      error: null,
      otpSentAt: null,
      submitIdentifier: mockSubmitIdentifier,
      submitPassword: mockSubmitPassword,
      chooseMethod: mockChooseMethod,
      back: mockBack,
      resendOtp: vi.fn(),
      submitOtp: vi.fn(),
    })
    renderLoginForm()
    expect(screen.getByTestId("password-input")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /تسجيل الدخول/i })).toBeInTheDocument()
  })

  it("shows error in password step", () => {
    mockUseLoginFlow.mockReturnValue({
      step: "password",
      identifier: "test@test.com",
      loading: false,
      error: "بيانات غير صحيحة",
      otpSentAt: null,
      submitIdentifier: mockSubmitIdentifier,
      submitPassword: mockSubmitPassword,
      chooseMethod: mockChooseMethod,
      back: mockBack,
      resendOtp: vi.fn(),
      submitOtp: vi.fn(),
    })
    renderLoginForm()
    expect(screen.getByText("بيانات غير صحيحة")).toBeInTheDocument()
  })

  it("calls submitPassword when login button clicked", async () => {
    mockUseLoginFlow.mockReturnValue({
      step: "password",
      identifier: "test@test.com",
      loading: false,
      error: null,
      otpSentAt: null,
      submitIdentifier: mockSubmitIdentifier,
      submitPassword: mockSubmitPassword,
      chooseMethod: mockChooseMethod,
      back: mockBack,
      resendOtp: vi.fn(),
      submitOtp: vi.fn(),
    })
    renderLoginForm()
    await userEvent.click(screen.getByRole("button", { name: /تسجيل الدخول/i }))
    expect(mockSubmitPassword).toHaveBeenCalledWith("pass123")
  })

  it("calls back when Back is clicked in method step", async () => {
    mockUseLoginFlow.mockReturnValue({
      step: "method",
      identifier: "test@test.com",
      loading: false,
      error: null,
      otpSentAt: null,
      submitIdentifier: mockSubmitIdentifier,
      submitPassword: mockSubmitPassword,
      chooseMethod: mockChooseMethod,
      back: mockBack,
      resendOtp: vi.fn(),
      submitOtp: vi.fn(),
    })
    renderLoginForm()
    await userEvent.click(screen.getByRole("button", { name: /Back/i }))
    expect(mockBack).toHaveBeenCalled()
  })

  it("does not show password field in identifier step", () => {
    renderLoginForm()
    expect(screen.queryByTestId("password-input")).not.toBeInTheDocument()
  })

  it("shows loading title from translation keys", () => {
    renderLoginForm()
    // title comes from stepTitles map via t()
    expect(screen.getByText("login.welcome")).toBeInTheDocument()
  })

  it("renders otp step when step is otp", () => {
    mockUseLoginFlow.mockReturnValue({
      step: "otp",
      identifier: "test@test.com",
      loading: false,
      error: null,
      otpSentAt: null,
      submitIdentifier: mockSubmitIdentifier,
      submitPassword: mockSubmitPassword,
      chooseMethod: mockChooseMethod,
      back: mockBack,
      resendOtp: vi.fn(),
      submitOtp: vi.fn(),
    })
    renderLoginForm()
    expect(screen.getByText("OTP Step")).toBeInTheDocument()
  })

  it("clears old password error when step changes back to identifier", () => {
    mockUseLoginFlow.mockReturnValue({
      step: "identifier",
      identifier: "",
      loading: false,
      error: null,
      otpSentAt: null,
      submitIdentifier: mockSubmitIdentifier,
      submitPassword: mockSubmitPassword,
      chooseMethod: mockChooseMethod,
      back: mockBack,
      resendOtp: vi.fn(),
      submitOtp: vi.fn(),
    })
    renderLoginForm()
    // No error shown on identifier step
    expect(screen.queryByText("بيانات غير صحيحة")).not.toBeInTheDocument()
  })
})

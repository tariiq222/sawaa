import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockSubmitLogin, mockSwitchToOtp, mockBackToLogin } = vi.hoisted(() => ({
  mockSubmitLogin: vi.fn(),
  mockSwitchToOtp: vi.fn(),
  mockBackToLogin: vi.fn(),
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
vi.mock("@/components/features/login/combined-step", () => ({
  CombinedStep: ({
    onSubmit,
    onSwitchToOtp,
  }: {
    onSubmit: (id: string, password: string) => void
    onSwitchToOtp: (id: string) => void
  }) => (
    <div>
      <input data-testid="identifier-input" placeholder="email" />
      <input data-testid="password-input" type="password" placeholder="••••••••" />
      <button onClick={() => onSubmit("test@test.com", "password123")}>
        login.password.submit
      </button>
      <button onClick={() => onSwitchToOtp("test@test.com")}>نسيت كلمة المرور؟</button>
    </div>
  ),
}))

vi.mock("@/components/features/login/otp-step", () => ({
  OtpStep: ({ onBack }: { onBack: () => void }) => (
    <div>
      OTP Step
      <button onClick={onBack}>login.common.back</button>
    </div>
  ),
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

const defaultLoginFlow = {
  mode: "login" as const,
  identifier: "",
  loading: false,
  error: null,
  otpSentAt: null,
  submitLogin: mockSubmitLogin,
  switchToOtp: mockSwitchToOtp,
  submitOtp: vi.fn(),
  resendOtp: vi.fn(),
  backToLogin: mockBackToLogin,
  clearError: vi.fn(),
}

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseLoginFlow.mockReturnValue(defaultLoginFlow)
  })

  it("renders combined step by default (login mode)", () => {
    renderLoginForm()
    expect(screen.getByTestId("identifier-input")).toBeInTheDocument()
    expect(screen.getByTestId("password-input")).toBeInTheDocument()
  })

  it("renders submit button", () => {
    renderLoginForm()
    expect(screen.getByRole("button", { name: /login\.password\.submit/i })).toBeInTheDocument()
  })

  it("calls submitLogin when submit button is clicked", async () => {
    renderLoginForm()
    await userEvent.click(screen.getByRole("button", { name: /login\.password\.submit/i }))
    expect(mockSubmitLogin).toHaveBeenCalledWith("test@test.com", "password123")
  })

  it("calls switchToOtp when forgot password link clicked", async () => {
    renderLoginForm()
    await userEvent.click(screen.getByRole("button", { name: /نسيت كلمة المرور/i }))
    expect(mockSwitchToOtp).toHaveBeenCalledWith("test@test.com")
  })

  it("renders otp step when mode is otp", () => {
    mockUseLoginFlow.mockReturnValue({
      ...defaultLoginFlow,
      mode: "otp",
      identifier: "test@test.com",
    })
    renderLoginForm()
    expect(screen.getByText("OTP Step")).toBeInTheDocument()
  })

  it("calls backToLogin when Back is clicked in otp step", async () => {
    mockUseLoginFlow.mockReturnValue({
      ...defaultLoginFlow,
      mode: "otp",
      identifier: "test@test.com",
    })
    renderLoginForm()
    await userEvent.click(screen.getByRole("button", { name: /login\.common\.back/i }))
    expect(mockBackToLogin).toHaveBeenCalled()
  })

  it("shows login.welcome title in login mode", () => {
    renderLoginForm()
    expect(screen.getByText("login.welcome")).toBeInTheDocument()
  })

  it("shows login.otp.title in otp mode", () => {
    mockUseLoginFlow.mockReturnValue({
      ...defaultLoginFlow,
      mode: "otp",
      identifier: "test@test.com",
    })
    renderLoginForm()
    expect(screen.getByText("login.otp.title")).toBeInTheDocument()
  })

  it("does not render otp step in login mode", () => {
    renderLoginForm()
    expect(screen.queryByText("OTP Step")).not.toBeInTheDocument()
  })

  it("does not render combined step in otp mode", () => {
    mockUseLoginFlow.mockReturnValue({
      ...defaultLoginFlow,
      mode: "otp",
      identifier: "test@test.com",
    })
    renderLoginForm()
    expect(screen.queryByTestId("identifier-input")).not.toBeInTheDocument()
  })
})

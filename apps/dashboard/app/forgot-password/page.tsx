import { ForgotPasswordForm } from "@/components/features/forgot-password-form"

export default function ForgotPasswordPage() {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background p-4">
      <div className="login-card relative z-10 w-full max-w-[400px] overflow-hidden rounded-2xl border border-border bg-card">
        <div aria-hidden className="login-grid-pattern pointer-events-none absolute inset-x-0 top-0 h-72" />
        <div aria-hidden className="login-blob pointer-events-none absolute inset-x-0 top-0 h-72" />
        <div className="relative p-8">
          <ForgotPasswordForm />
        </div>
      </div>
    </div>
  )
}

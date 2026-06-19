import { AuthShell } from "@/components/features/login/auth-shell"
import { ForgotPasswordForm } from "@/components/features/forgot-password-form"

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <ForgotPasswordForm />
    </AuthShell>
  )
}

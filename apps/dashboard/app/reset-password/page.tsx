import { AuthShell } from "@/components/features/login/auth-shell"
import { ResetPasswordForm } from "@/components/features/reset-password-form"

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <ResetPasswordForm />
    </AuthShell>
  )
}

"use client"

import { Button } from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import type { LoginMethod } from "@/lib/schemas/auth-login.schema"

interface Props {
  identifier: string
  loading: boolean
  onPick: (method: LoginMethod) => void
  onBack: () => void
}

export function MethodStep({ identifier, loading, onPick, onBack }: Props) {
  const { t } = useLocale()

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground break-all" dir="ltr">
        {identifier}
      </p>
      <p className="text-sm">{t("login.chooseMethod")}</p>
      <Button className="w-full" disabled={loading} onClick={() => onPick("password")}>
        {t("login.usePassword")}
      </Button>
      <Button variant="outline" className="w-full" disabled={loading} onClick={() => onPick("otp")}>
        {t("login.useOtp")}
      </Button>
      <Button variant="ghost" className="w-full" onClick={onBack} disabled={loading}>
        {t("common.back")}
      </Button>
    </div>
  )
}

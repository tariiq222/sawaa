"use client"

import { Button } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { HugeiconsIcon } from "@hugeicons/react"
import { Key01Icon, SmartPhone01Icon } from "@hugeicons/core-free-icons"

interface Props {
  identifier: string
  hasPassword: boolean
  loading: boolean
  onSelectMethod: (method: "password" | "otp") => void
  onBack: () => void
}

export function MethodStep({ identifier, hasPassword, loading, onSelectMethod, onBack }: Props) {
  const { t } = useLocale()

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground text-center">
        {t("login.chooseMethod")}
      </p>
      <p className="text-sm font-medium text-center" dir="ltr">{identifier}</p>

      <div className="flex flex-col gap-3">
        {hasPassword && (
          <Button
            type="button"
            variant="outline"
            className="w-full h-14 justify-start gap-3"
            onClick={() => onSelectMethod("password")}
            disabled={loading}
          >
            <HugeiconsIcon icon={Key01Icon} size={20} />
            <span>{t("login.usePassword")}</span>
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          className="w-full h-14 justify-start gap-3"
          onClick={() => onSelectMethod("otp")}
          disabled={loading}
        >
          <HugeiconsIcon icon={SmartPhone01Icon} size={20} />
          <span>{t("login.useOtp")}</span>
        </Button>
      </div>

      <Button type="button" variant="ghost" className="w-full" onClick={onBack} disabled={loading}>
        {t("common.back")}
      </Button>
    </div>
  )
}

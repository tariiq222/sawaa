"use client"

import type { ComponentProps } from "react"
import { AvatarUpload } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"]
const MAX_BYTES = 5 * 1024 * 1024

export function EmployeeImageUpload(props: ComponentProps<typeof AvatarUpload>) {
  const { t } = useLocale()
  return (
    <div>
      <AvatarUpload
        {...props}
        accept={ALLOWED_TYPES.join(",")}
        validateFile={(file) => {
          if (!ALLOWED_TYPES.includes(file.type)) return t("employees.avatar.invalidType")
          if (file.size > MAX_BYTES) return t("employees.avatar.tooLarge")
        }}
      />
      <p className="text-xs text-muted-foreground">{t("employees.avatar.hint")}</p>
    </div>
  )
}

"use client"

import { Toaster } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"

/** Keep app translations out of the presentation-only UI package. */
export function AppToaster() {
  const { dir, t } = useLocale()
  return <Toaster dir={dir} containerAriaLabel={t("notifications.title")} />
}

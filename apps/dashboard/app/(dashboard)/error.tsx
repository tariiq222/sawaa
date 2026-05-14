"use client"

import { Button } from "@deqah/ui"
import {
  Alert02Icon,
  ArrowReloadHorizontalIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useLocale } from "@/components/locale-provider"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { t } = useLocale()

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24">
      <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
        <HugeiconsIcon
          icon={Alert02Icon}
          className="size-8 text-destructive"
        />
      </div>
      <div className="flex flex-col items-center gap-2 text-center">
        <h2 className="text-lg font-semibold text-foreground">
          {t("error.somethingWrong")}
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {error.message || t("error.unexpected")}
        </p>
      </div>
      <Button variant="outline" onClick={reset} className="gap-2">
        <HugeiconsIcon icon={ArrowReloadHorizontalIcon} className="size-4" />
        {t("error.tryAgain")}
      </Button>
    </div>
  )
}

"use client"

import Link from "next/link"
import { Button } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"

export default function NotFound() {
  const { t } = useLocale()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-7xl font-bold tabular-nums text-primary">404</h1>
        <h2 className="text-xl font-semibold text-foreground">
          {t("notFound.title")}
        </h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          {t("notFound.description")}
        </p>
      </div>
      <Button asChild>
        <Link href="/">{t("notFound.backToDashboard")}</Link>
      </Button>
    </div>
  )
}

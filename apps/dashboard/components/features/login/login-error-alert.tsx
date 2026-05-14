"use client"

import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { AlertCircleIcon, CloudOffIcon } from "@hugeicons/core-free-icons"
import { useLocale } from "@/components/locale-provider"
import { classifyLoginError, type LoginErrorKind } from "@/lib/api/auth-errors"

interface Props {
  error: unknown
}

interface Variant {
  titleKey: string
  descriptionKey: string
  showForgotPassword: boolean
  tone: "destructive" | "muted"
  Icon: typeof AlertCircleIcon
}

const VARIANTS: Record<LoginErrorKind, Variant> = {
  invalid_credentials: {
    titleKey: "login.error.invalidCredentials.title",
    descriptionKey: "login.error.invalidCredentials.description",
    showForgotPassword: true,
    tone: "destructive",
    Icon: AlertCircleIcon,
  },
  account_inactive: {
    titleKey: "login.error.accountInactive.title",
    descriptionKey: "login.error.accountInactive.description",
    showForgotPassword: false,
    tone: "destructive",
    Icon: AlertCircleIcon,
  },
  account_locked: {
    titleKey: "login.error.accountLocked.title",
    descriptionKey: "login.error.accountLocked.description",
    showForgotPassword: true,
    tone: "destructive",
    Icon: AlertCircleIcon,
  },
  network: {
    titleKey: "login.error.network.title",
    descriptionKey: "login.error.network.description",
    showForgotPassword: false,
    tone: "muted",
    Icon: CloudOffIcon,
  },
}

export function LoginErrorAlert({ error }: Props) {
  const { t } = useLocale()
  if (!error) return null

  const kind = classifyLoginError(error)
  const variant = VARIANTS[kind]

  const containerTone =
    variant.tone === "destructive"
      ? "bg-destructive/10 border-destructive/30 text-destructive"
      : "bg-muted/40 border-border text-foreground"

  return (
    <div
      role="alert"
      data-testid="login-error-alert"
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${containerTone}`}
    >
      <HugeiconsIcon
        icon={variant.Icon}
        size={20}
        className="mt-0.5 shrink-0"
        aria-hidden
      />
      <div className="flex flex-1 flex-col gap-1">
        <p className="text-sm font-medium leading-tight">{t(variant.titleKey)}</p>
        <p className="text-sm leading-relaxed opacity-90">
          {t(variant.descriptionKey)}
        </p>
        {variant.showForgotPassword && (
          <Link
            href="/forgot-password"
            className="mt-1 self-start text-sm font-medium underline-offset-4 hover:underline"
          >
            {t("login.error.forgotPasswordLink")}
          </Link>
        )}
      </div>
    </div>
  )
}

"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"
import {
  Calendar03Icon,
  UserAdd01Icon,
  MoneyBag02Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons"
import { useLocale } from "@/components/locale-provider"
import type { QuickActionKey } from "@/lib/dashboard-widgets"

type ActionConfig = {
  titleKey: string
  hintKey: string
  icon: IconSvgElement
  href: string
  color: "primary" | "success" | "info"
}

const ACTION_CONFIG: Record<QuickActionKey, ActionConfig> = {
  newBooking: {
    titleKey: "actions.newBooking",
    hintKey: "actions.newBooking.hint",
    icon: Calendar03Icon,
    href: "/bookings?new=1",
    color: "primary",
  },
  newClient: {
    titleKey: "actions.addClient",
    hintKey: "actions.addClient.hint",
    icon: UserAdd01Icon,
    href: "/clients?new=1",
    color: "success",
  },
  recordPayment: {
    titleKey: "actions.recordPayment",
    hintKey: "actions.recordPayment.hint",
    icon: MoneyBag02Icon,
    href: "/payments?new=1",
    color: "info",
  },
}

const colorMap = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  info: "bg-info/10 text-info",
} as const

interface Props {
  actions: QuickActionKey[]
}

export function QuickActions({ actions }: Props) {
  const { t } = useLocale()

  if (actions.length === 0) return null

  return (
    <div
      data-testid="quick-actions"
      className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-card sm:flex-row sm:divide-x sm:divide-y-0 rtl:sm:divide-x-reverse"
    >
      {actions.map((key) => {
        const cfg = ACTION_CONFIG[key]
        return (
          <Link
            key={key}
            href={cfg.href}
            data-testid={`quick-action-${key}`}
            className="group flex flex-1 items-center gap-3.5 px-5 py-4 transition-colors hover:bg-muted/60 first:rounded-t-2xl last:rounded-b-2xl sm:first:rounded-s-2xl sm:first:rounded-e-none sm:last:rounded-e-2xl sm:last:rounded-s-none"
          >
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl",
                colorMap[cfg.color],
              )}
              aria-hidden
            >
              <HugeiconsIcon icon={cfg.icon} size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{t(cfg.titleKey)}</p>
              <p className="truncate text-xs text-muted-foreground">{t(cfg.hintKey)}</p>
            </div>
            <span
              className="shrink-0 text-muted-foreground/70 transition-transform duration-200 motion-safe:group-hover:translate-x-0.5 motion-safe:rtl:group-hover:-translate-x-0.5"
              aria-hidden
            >
              <HugeiconsIcon icon={ArrowRight01Icon} size={14} className="rtl:rotate-180" />
            </span>
          </Link>
        )
      })}
    </div>
  )
}

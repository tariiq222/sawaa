"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { useLocale } from "@/components/locale-provider"

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[]
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  const { t, dir } = useLocale()
  const pathname = usePathname()

  // Auto-generate from pathname if no items provided
  const breadcrumbs: BreadcrumbItem[] = items ?? generateBreadcrumbs(pathname, t)

  if (breadcrumbs.length <= 1) return null

  return (
    <nav aria-label="Breadcrumbs" className="flex items-center gap-2 text-sm">
      {breadcrumbs.map((item, i) => {
        const isLast = i === breadcrumbs.length - 1
        return (
          <div key={item.href} className="flex items-center gap-2">
            {i > 0 && (
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                size={12}
                className={`text-muted-foreground ${dir === "rtl" ? "rotate-180" : ""}`}
              />
            )}
            {isLast || !item.href ? (
              <span className="text-primary font-medium">{item.label}</span>
            ) : (
              <Link
                href={item.href}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            )}
          </div>
        )
      })}
    </nav>
  )
}

function generateBreadcrumbs(pathname: string, t: (key: string) => string): BreadcrumbItem[] {
  const segments = pathname.split("/").filter(Boolean)

  const routeLabels: Record<string, string> = {
    bookings: t("nav.bookings"),
    clients: t("nav.clients"),
    employees: t("nav.employees"),
    services: t("nav.services"),
    categories: t("nav.categories"),
    departments: t("nav.departments"),
    payments: t("nav.payments"),
    invoices: t("nav.invoices"),
    reports: t("nav.reports"),
    notifications: t("nav.notifications"),
    chatbot: t("nav.chatbot"),
    ratings: t("nav.ratings"),
    "activity-log": t("nav.activityLog"),
    coupons: t("nav.coupons"),
    branches: t("nav.branches"),
    users: t("nav.users"),
    settings: t("nav.settings"),
    create: t("nav.create"),
    edit: t("nav.edit"),
  }

  const isUuid = (s: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)

  const items: BreadcrumbItem[] = [
    { label: t("nav.dashboard"), href: "/" },
  ]

  let currentPath = ""
  for (const segment of segments) {
    currentPath += `/${segment}`
    const label = isUuid(segment)
      ? `${segment.slice(0, 8)}…`
      : (routeLabels[segment] ?? segment)
    items.push({ label, href: currentPath })
  }

  return items
}

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
          <div key={`${item.href ?? item.label}-${i}`} className="flex items-center gap-2">
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
    programs: t("nav.programs"),
    clients: t("nav.clients"),
    employees: t("nav.employees"),
    services: t("nav.services"),
    categories: t("nav.categories"),
    departments: t("nav.departments"),
    payments: t("nav.payments"),
    invoices: t("nav.invoices"),
    reports: t("nav.reports"),
    notifications: t("nav.notifications"),
    conversations: t("nav.conversations"),
    ratings: t("nav.ratings"),
    "activity-log": t("nav.activityLog"),
    coupons: t("nav.coupons"),
    branches: t("nav.branches"),
    users: t("nav.users"),
    settings: t("nav.settings"),
    packages: t("nav.packages"),
    families: t("packages.family.title"),
    "intake-forms": t("nav.intakeForms"),
    "contact-messages": t("nav.contactMessages"),
    profile: t("nav.profile"),
    create: t("nav.create"),
    edit: t("nav.edit"),
  }

  const isUuid = (s: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)

  const items: BreadcrumbItem[] = [
    { label: t("nav.dashboard"), href: "/" },
  ]

  let currentPath = ""
  for (const [index, segment] of segments.entries()) {
    currentPath += `/${segment}`
    const label = isUuid(segment)
      ? `${segment.slice(0, 8)}…`
      : (routeLabels[segment] ?? segment)
    // There is no standalone /packages/families index route; return to the
    // package list when this grouping segment is clicked. Family IDs point to
    // the existing edit route instead of a dead /families/:id page.
    const href = segment === "families"
      ? "/packages"
      : (isUuid(segment) && segments[index - 1] === "families"
        ? `/packages/families/${segment}/edit`
        : currentPath)
    items.push({ label, href })
  }

  return items
}

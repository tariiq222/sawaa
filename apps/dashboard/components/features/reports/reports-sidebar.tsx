"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useLocale } from "@/components/locale-provider"
import { cn } from "@/lib/utils"

interface ReportNavItem {
  href: string
  labelKey: string
}

interface ReportNavGroup {
  labelKey: string
  items: ReportNavItem[]
}

const GROUPS: ReportNavGroup[] = [
  {
    labelKey: "reports.nav.group.general",
    items: [{ href: "/reports/overview", labelKey: "reports.nav.overview" }],
  },
  {
    labelKey: "reports.nav.group.operations",
    items: [
      { href: "/reports/financial", labelKey: "reports.nav.financial" },
      { href: "/reports/bookings", labelKey: "reports.nav.bookings" },
      { href: "/reports/clients", labelKey: "reports.nav.clients" },
    ],
  },
  {
    labelKey: "reports.nav.group.team",
    items: [
      { href: "/reports/practitioners", labelKey: "reports.nav.practitioners" },
      { href: "/reports/services", labelKey: "reports.nav.services" },
      { href: "/reports/ratings", labelKey: "reports.nav.ratings" },
    ],
  },
]

export function ReportsSidebar() {
  const pathname = usePathname()
  const { t } = useLocale()

  return (
    <aside className="rounded-xl border border-border bg-surface p-2 lg:sticky lg:top-[88px] lg:h-fit">
      {GROUPS.map((g) => (
        <div key={g.labelKey} className="mb-2 last:mb-0">
          <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t(g.labelKey)}
          </p>
          <nav className="flex flex-col gap-0.5">
            {g.items.map((item) => {
              const active =
                pathname === item.href || pathname?.startsWith(item.href + "/")
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  data-testid={`reports-nav-${item.href.split("/").pop()}`}
                >
                  {t(item.labelKey)}
                </Link>
              )
            })}
          </nav>
        </div>
      ))}
    </aside>
  )
}

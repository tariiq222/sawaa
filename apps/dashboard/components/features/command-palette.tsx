"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Home01Icon,
  Calendar03Icon,
  UserMultiple02Icon,
  Stethoscope02Icon,
  Settings02Icon,
  AnalyticsUpIcon,
  Add01Icon,
} from "@hugeicons/core-free-icons"

import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandEmpty,
  CommandSeparator,
} from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"

type CommandEntry = {
  id: string
  labelKey: string
  searchTerms: string
  href: string
  icon: typeof Home01Icon
  shortcut?: string
}

// i18n-allow: bilingual search hints are intentional — fed to fuzzy matcher,
// not rendered. Display labels go through `labelKey` + t().
const QUICK_ACTIONS: CommandEntry[] = [
  { id: "new-booking", labelKey: "cmd.newBooking", searchTerms: "new booking حجز جديد", href: "/bookings?new=1", icon: Add01Icon, shortcut: "⌘N" },
  { id: "search-clients", labelKey: "cmd.searchClients", searchTerms: "search clients البحث مرضى", href: "/clients", icon: UserMultiple02Icon },
  { id: "today-schedule", labelKey: "cmd.todaySchedule", searchTerms: "today schedule جدول اليوم", href: "/bookings?tab=today", icon: Calendar03Icon },
]

const NAV_COMMANDS: CommandEntry[] = [
  { id: "nav-dashboard", labelKey: "cmd.navDashboard", searchTerms: "dashboard لوحة التحكم", href: "/", icon: Home01Icon },
  { id: "nav-bookings", labelKey: "cmd.navBookings", searchTerms: "bookings الحجوزات", href: "/bookings", icon: Calendar03Icon },
  { id: "nav-clients", labelKey: "cmd.navClients", searchTerms: "clients المرضى", href: "/clients", icon: UserMultiple02Icon },
  { id: "nav-employees", labelKey: "cmd.navEmployees", searchTerms: "employees الأطباء", href: "/employees", icon: Stethoscope02Icon },
  { id: "nav-reports", labelKey: "cmd.navReports", searchTerms: "reports التقارير", href: "/reports", icon: AnalyticsUpIcon },
  { id: "nav-settings", labelKey: "cmd.navSettings", searchTerms: "settings الإعدادات", href: "/settings", icon: Settings02Icon },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { t } = useLocale()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [])

  const run = useCallback(
    (href: string) => {
      setOpen(false)
      router.push(href)
    },
    [router],
  )

  const renderItem = (cmd: CommandEntry) => (
    <CommandItem key={cmd.id} value={cmd.searchTerms} onSelect={() => run(cmd.href)}>
      <HugeiconsIcon icon={cmd.icon} size={16} className="me-2 shrink-0 text-muted-foreground" />
      <span>{t(cmd.labelKey)}</span>
      {cmd.shortcut && <CommandShortcut>{cmd.shortcut}</CommandShortcut>}
    </CommandItem>
  )

  return (
    <CommandDialog open={open} onOpenChange={setOpen} className="max-w-[520px]">
      <CommandInput placeholder={t("cmd.placeholder")} />
      <CommandList>
        <CommandEmpty>{t("cmd.noResults")}</CommandEmpty>
        <CommandGroup heading={t("cmd.quickActions")}>{QUICK_ACTIONS.map(renderItem)}</CommandGroup>
        <CommandSeparator />
        <CommandGroup heading={t("cmd.navigate")}>{NAV_COMMANDS.map(renderItem)}</CommandGroup>
      </CommandList>
      <div className="border-t px-3 py-2 text-xs text-muted-foreground">{t("cmd.hint")}</div>
    </CommandDialog>
  )
}

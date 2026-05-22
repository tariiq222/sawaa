"use client"

import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CustomerService01Icon,
  Book02Icon,
  Add01Icon,
} from "@hugeicons/core-free-icons"
import { SawaaMark } from "@/components/brand/sawaa-mark"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@sawaa/ui"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@sawaa/ui"
import { Separator } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { cn } from "@/lib/utils"
import { useSidebarNav } from "@/hooks/use-sidebar-nav"

/* ─── Component ─── */

export function AppSidebar() {
  const { t, dir } = useLocale()
  const { isMobile, setOpenMobile } = useSidebar()

  const {
    filteredGroups,
    isItemActive,
    navigate,
    prefetchItem,
  } = useSidebarNav()

  return (
    <>
      <Sidebar collapsible="offcanvas" side={dir === "rtl" ? "right" : "left"} dir={dir}>
        {/* ─── Brand ─── */}
        <SidebarHeader className="px-4 pt-5 pb-4">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link href="/">
                  <SawaaMark />
                  <div className="grid flex-1 text-start leading-tight">
                    <span className="truncate text-lg font-bold">{t("app.name")}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {t("app.tagline")}
                    </span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        {/* ─── Quick action: new booking ─── */}
        <div className="px-3 pb-2">
          <Link
            href="/bookings?new=1"
            onClick={() => isMobile && setOpenMobile(false)}
            className={cn(
              "group flex w-full items-center justify-center gap-1.5 rounded-lg",
              "bg-primary text-primary-foreground px-3 py-2 text-xs font-semibold",
              "transition-all hover:bg-primary/90 hover:-translate-y-px",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2",
            )}
          >
            <HugeiconsIcon icon={Add01Icon} size={14} strokeWidth={2.5} />
            <span>{t("bookings.newBooking")}</span>
          </Link>
        </div>

        {/* ─── Navigation ─── */}
        <SidebarContent className="pt-0">
          {filteredGroups.map((group) => (
            <SidebarGroup key={group.labelKey}>
              <SidebarGroupLabel className="!text-[11px] !tracking-[1px]">
                {t(group.labelKey)}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const isActive = isItemActive(item.href)
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onMouseEnter={() => prefetchItem(item.href)}
                          onClick={() => navigate(item.href, isMobile ? () => setOpenMobile(false) : undefined)}
                          className={cn(
                            "cursor-pointer",
                            isActive
                              ? "sidebar-active"
                              : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60",
                          )}
                        >
                          <HugeiconsIcon icon={item.icon} size={18} />
                          <span className="flex-1">{t(item.titleKey)}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        {/* ─── Footer — Support & Knowledge Base ─── */}
        <div className="px-4"><Separator /></div>

        <SidebarFooter className="px-4 pt-2 pb-4">
          <div className="flex items-center justify-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href="mailto:support@sawaa.sa"
                  aria-label={t("nav.support")}
                  className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60 transition-colors"
                >
                  <HugeiconsIcon icon={CustomerService01Icon} size={18} />
                </a>
              </TooltipTrigger>
              <TooltipContent side="top">{t("nav.support")}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/chatbot"
                  aria-label={t("nav.knowledge")}
                  onClick={isMobile ? () => setOpenMobile(false) : undefined}
                  className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60 transition-colors"
                >
                  <HugeiconsIcon icon={Book02Icon} size={18} />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="top">{t("nav.knowledge")}</TooltipContent>
            </Tooltip>
          </div>
        </SidebarFooter>
      </Sidebar>
    </>
  )
}

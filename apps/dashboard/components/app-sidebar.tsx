"use client"

import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CustomerService01Icon,
  Book02Icon,
} from "@hugeicons/core-free-icons"
import { DeqahMark } from "@/components/brand/deqah-mark"

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
} from "@deqah/ui"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deqah/ui"
import { Separator } from "@deqah/ui"
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
                  <DeqahMark />
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
                          {item.href === "/bookings" && false && (
                            <span className="flex size-5 items-center justify-center rounded-full text-[11px] font-bold tabular-nums bg-accent text-accent-foreground">
                            </span>
                          )}
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
                <button
                  aria-label={t("nav.support")}
                  className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60 transition-colors"
                >
                  <HugeiconsIcon icon={CustomerService01Icon} size={18} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">{t("nav.support")}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  aria-label={t("nav.knowledge")}
                  className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60 transition-colors"
                >
                  <HugeiconsIcon icon={Book02Icon} size={18} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">{t("nav.knowledge")}</TooltipContent>
            </Tooltip>
          </div>
        </SidebarFooter>
      </Sidebar>
    </>
  )
}

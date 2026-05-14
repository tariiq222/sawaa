"use client"

import { useCallback, useMemo } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/components/providers/auth-provider"
import { navGroups } from "@/components/sidebar-config"
import { prefetchRouteData } from "@/lib/route-prefetch"
import type { NavItem } from "@/components/sidebar-config"

export interface NavGroupFiltered {
  labelKey: string
  items: NavItem[]
}

export function useSidebarNav() {
  const pathname = usePathname()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  /* ── permission filtered nav groups (feature flags removed in single-tenant) ── */
  const filteredGroups = useMemo<NavGroupFiltered[]>(
    () =>
      navGroups.map((group) => ({
        labelKey: group.labelKey,
        items: group.items.filter((item) => {
          // Permission gate only — all features are enabled in single-tenant mode
          if (
            item.permission &&
            !user?.permissions?.includes(item.permission)
          ) {
            return false
          }
          return true
        }),
      })),
    [user?.permissions]
  )

  /* ── user display info ── */
  const userInitials = useMemo(() => {
    if (!user) return "??"
    const parts = user.name?.trim().split(/\s+/).filter(Boolean) ?? []
    return (
      parts
        .slice(0, 2)
        .map((p) => p[0])
        .join("")
        .toUpperCase() || "??"
    )
  }, [user])

  const userName = useMemo(
    () => user?.name?.trim() || user?.email || "—",
    [user]
  )

  /* ── active route check ── */
  const isItemActive = useCallback(
    (href: string) =>
      href === "/" ? pathname === "/" : pathname.startsWith(href),
    [pathname]
  )

  /* ── navigation ── */
  const navigate = useCallback(
    (href: string, closeMobile?: () => void) => {
      const isExact = href === "/" ? pathname === "/" : pathname === href
      if (isExact) return
      closeMobile?.()
      router.push(href)
    },
    [pathname, router]
  )

  const prefetchItem = useCallback(
    (href: string) => {
      if (isItemActive(href)) return
      router.prefetch(href)
      prefetchRouteData(href, queryClient)
    },
    [isItemActive, router, queryClient]
  )

  return {
    filteredGroups,
    /** Always false in single-tenant mode — no feature flag loading. */
    featuresLoading: false,
    pathname,
    userInitials,
    userName,
    isItemActive,
    navigate,
    prefetchItem,
  }
}

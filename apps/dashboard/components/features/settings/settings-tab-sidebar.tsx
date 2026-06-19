"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface SidebarItem {
  id: string
  label: string
  /** Description shown below label when active */
  desc?: string
  /** Secondary label (e.g. slug) shown below label when active */
  subLabel?: string
  /** Extra slot rendered at the end of the item (e.g. a Switch) */
  extra?: ReactNode
}

interface SettingsTabSidebarProps {
  title: string
  icon?: ReactNode
  items: SidebarItem[]
  activeId: string
  onSelect: (id: string) => void
  /** Optional trailing slot inserted after the items list (e.g. a divider + more items) */
  footer?: ReactNode
  width?: "w-56" | "w-64"
}

export function SettingsTabSidebar({
  title,
  icon,
  items,
  activeId,
  onSelect,
  footer,
  width = "w-64",
}: SettingsTabSidebarProps) {
  return (
    <div className={cn("flex shrink-0 flex-col border-e border-border bg-surface-muted", width)}>
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          {icon}
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </p>
        </div>
      </div>
      <div role="tablist" className="flex-1 space-y-1.5 overflow-y-auto p-3">
        {items.map((item) => {
          const isActive = activeId === item.id
          return (
            <div
              key={item.id}
              role="tab"
              aria-selected={isActive}
              tabIndex={0}
              onClick={() => onSelect(item.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onSelect(item.id)
              }}
              className={cn(
                "flex w-full cursor-pointer select-none items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-all",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium leading-tight">{item.label}</p>
                {isActive && item.desc && (
                  <p className="mt-0.5 line-clamp-2 text-xs leading-tight opacity-80">{item.desc}</p>
                )}
                {isActive && item.subLabel && (
                  <p className="mt-0.5 line-clamp-1 font-mono text-xs leading-tight opacity-80">{item.subLabel}</p>
                )}
              </div>
              {item.extra && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="shrink-0"
                >
                  {item.extra}
                </div>
              )}
            </div>
          )
        })}
        {footer}
      </div>
    </div>
  )
}

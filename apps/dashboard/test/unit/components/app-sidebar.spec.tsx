import type { ReactNode } from "react"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ canReadConversations: true }))

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key, dir: "ltr" }),
}))
vi.mock("@/hooks/use-sidebar-nav", () => ({
  useSidebarNav: () => ({
    filteredGroups: mocks.canReadConversations
      ? [{ labelKey: "nav.communication", items: [{ titleKey: "nav.conversations", href: "/conversations", icon: {} }] }]
      : [],
    isItemActive: () => false,
    navigate: vi.fn(),
    prefetchItem: vi.fn(),
  }),
}))
vi.mock("@/components/brand/sawaa-mark", () => ({ SawaaMark: () => <span>Sawaa</span> }))
vi.mock("@hugeicons/react", () => ({ HugeiconsIcon: () => <span aria-hidden="true" /> }))
vi.mock("@sawaa/ui", () => {
  const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>
  const Button = ({ children }: { children?: ReactNode }) => <div>{children}</div>
  return {
    Sidebar: Box, SidebarContent: Box, SidebarFooter: Box, SidebarGroup: Box,
    SidebarGroupContent: Box, SidebarGroupLabel: Box, SidebarHeader: Box,
    SidebarMenu: Box, SidebarMenuButton: Button, SidebarMenuItem: Box,
    Tooltip: Box, TooltipContent: Box, TooltipTrigger: Box, Separator: Box,
    useSidebar: () => ({ isMobile: false, setOpenMobile: vi.fn() }),
  }
})

import { AppSidebar } from "@/components/app-sidebar"

describe("AppSidebar conversation cutover", () => {
  beforeEach(() => { mocks.canReadConversations = true })

  it("uses the permission-filtered conversations destination in the footer", () => {
    render(<AppSidebar />)
    const links = screen.getAllByRole("link", { name: "nav.conversations" })
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute("href", "/conversations")
    expect(screen.queryByRole("link", { name: "nav.whatsapp" })).not.toBeInTheDocument()
  })

  it("hides the footer conversation shortcut without conversation read access", () => {
    mocks.canReadConversations = false
    render(<AppSidebar />)
    expect(screen.queryByRole("link", { name: "nav.conversations" })).not.toBeInTheDocument()
  })
})

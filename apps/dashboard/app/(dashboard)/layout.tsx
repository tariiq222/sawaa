"use client"

import type { ReactNode } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { Header } from "@/components/header"
import { MobileSidebarTrigger } from "@/components/mobile-sidebar-trigger"
import { SidebarInset, SidebarProvider } from "@sawaa/ui"
import { AuthGate } from "@/components/providers/auth-gate"
import { CommandPalette } from "@/components/features/command-palette"

export default function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <AuthGate>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="min-h-0 relative z-[1]">
          <Header />
          <div className="flex-1 overflow-y-auto p-4 md:px-8 md:py-7">
            {children}
          </div>
          <CommandPalette />
        </SidebarInset>
        <MobileSidebarTrigger />
      </SidebarProvider>
    </AuthGate>
  )
}

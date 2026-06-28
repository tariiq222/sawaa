"use client"

import type { ReactNode } from "react"
import dynamic from "next/dynamic"
import { AppSidebar } from "@/components/app-sidebar"
import { Header } from "@/components/header"
import { MobileSidebarTrigger } from "@/components/mobile-sidebar-trigger"
import { SidebarInset, SidebarProvider } from "@sawaa/ui"
import { AuthGate } from "@/components/providers/auth-gate"
import { useLocale } from "@/components/locale-provider"

const CommandPalette = dynamic(
  () => import("@/components/features/command-palette").then((mod) => mod.CommandPalette),
  { ssr: false },
)

export default function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const { t } = useLocale()
  return (
    <AuthGate>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-md focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {t("common.skipToContent")}
      </a>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="min-h-0 min-w-0 relative z-[1]">
          <Header />
          <main
            id="main"
            tabIndex={-1}
            className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto p-4 md:px-8 md:py-7 focus:outline-none"
          >
            {children}
          </main>
          <CommandPalette />
        </SidebarInset>
        <MobileSidebarTrigger />
      </SidebarProvider>
    </AuthGate>
  )
}

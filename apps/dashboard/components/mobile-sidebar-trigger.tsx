"use client"

import { SidebarTrigger } from "@deqah/ui"

export function MobileSidebarTrigger() {
  return (
    <div className="fixed bottom-4 end-4 z-50 md:hidden">
      <SidebarTrigger className="size-12 rounded-full bg-primary text-primary-foreground shadow-primary hover:shadow-primary-hover" />
    </div>
  )
}

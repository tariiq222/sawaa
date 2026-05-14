"use client"

import { useState } from "react"
import { Card } from "@deqah/ui"
import { cn } from "@/lib/utils"
import { useLocale } from "@/components/locale-provider"
import { ZoomSettingsForm } from "@/components/features/zoom/zoom-settings-form"
import { EmailConfigForm } from "@/components/features/email-config/email-config-form"
import { ZohoSettingsForm } from "@/components/features/zoho/zoho-settings-form"

type IntegrationId = "zoom" | "email" | "zoho"

export function SettingsIntegrationsTab() {
  const { t } = useLocale()
  const [activeId, setActiveId] = useState<IntegrationId>("zoom")

  const integrations: { id: IntegrationId; label: string }[] = [
    { id: "zoom", label: "Zoom" },
    { id: "email", label: t("emailConfig.menuLabel") },
    { id: "zoho", label: t("zoho.menuLabel") },
  ]

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex min-h-[520px]">
        {/* Sidebar */}
        <div className="flex w-56 shrink-0 flex-col border-e border-border bg-surface-muted">
          <div className="border-b border-border px-4 py-3">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {t("settings.tabs.integrations")}
            </p>
          </div>
          <div role="tablist" className="flex-1 space-y-1.5 p-3">
            {integrations.map((item) => {
              const isActive = activeId === item.id
              return (
                <div
                  key={item.id}
                  role="tab"
                  aria-selected={isActive}
                  tabIndex={0}
                  onClick={() => setActiveId(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setActiveId(item.id)
                  }}
                  className={cn(
                    "w-full cursor-pointer rounded-lg px-3 py-2.5 transition-all select-none",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
                  )}
                >
                  <p className="truncate text-sm leading-tight font-medium">
                    {item.label}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Content panel */}
        <div className="flex flex-1 flex-col overflow-y-auto bg-surface-muted/50 p-5">
          {activeId === "zoom" && <ZoomSettingsForm />}
          {activeId === "email" && <EmailConfigForm />}
          {activeId === "zoho" && <ZohoSettingsForm />}
        </div>
      </div>
    </Card>
  )
}

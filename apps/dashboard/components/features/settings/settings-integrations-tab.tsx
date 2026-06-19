"use client"

import { useState } from "react"
import { Card } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { ZoomSettingsForm } from "@/components/features/zoom/zoom-settings-form"
import { EmailConfigForm } from "@/components/features/email-config/email-config-form"
import { SettingsTabSidebar } from "./settings-tab-sidebar"

type IntegrationId = "zoom" | "email"

export function SettingsIntegrationsTab() {
  const { t } = useLocale()
  const [activeId, setActiveId] = useState<IntegrationId>("zoom")

  const integrations: { id: IntegrationId; label: string }[] = [
    { id: "zoom", label: "Zoom" },
    { id: "email", label: t("emailConfig.menuLabel") },
  ]

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex min-h-[520px]">
        {/* Sidebar */}
        <SettingsTabSidebar
          title={t("settings.tabs.integrations")}
          items={integrations.map(item => ({ id: item.id, label: item.label }))}
          activeId={activeId}
          onSelect={(id) => setActiveId(id as IntegrationId)}
          width="w-56"
        />

        {/* Content panel */}
        <div className="flex flex-1 flex-col overflow-y-auto bg-surface-muted/50 p-5">
          {activeId === "zoom" && <ZoomSettingsForm />}
          {activeId === "email" && <EmailConfigForm />}
        </div>
      </div>
    </Card>
  )
}

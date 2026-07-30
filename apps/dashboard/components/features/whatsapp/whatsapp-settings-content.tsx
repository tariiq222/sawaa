"use client"

// WhatsappSettingsContent — rendered inside the WhatsApp tab of /settings.
// Mirrors the Integrations tab layout: a right-side SettingsTabSidebar with
// the sub-areas (Connection / AI / Conversations) as tiles, and a content
// panel on the left that renders the selected tile.
//
// Status (QR + connection state) is rendered as an info strip at the top of
// the connection panel so the operator sees the live state without an extra
// tab.

import { useState } from "react"
import { Card } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { SettingsTabSidebar } from "@/components/features/settings/settings-tab-sidebar"
import { WhatsappConnectionForm } from "./forms/whatsapp-connection-form"
import { WhatsappAiConfigForm } from "./forms/whatsapp-ai-config-form"
import { WhatsappConversationsTab } from "./tabs/whatsapp-conversations-tab"
import { WhatsappStatusTab } from "./tabs/whatsapp-status-tab"

type WhatsAppTileId = "status" | "connection" | "ai" | "conversations"

const TILES: { id: WhatsAppTileId; key: string; desc?: string }[] = [
  { id: "status", key: "whatsapp.tile.status" },
  { id: "connection", key: "whatsapp.tile.connection", desc: "whatsapp.tile.connection.desc" },
  { id: "ai", key: "whatsapp.tile.ai", desc: "whatsapp.tile.ai.desc" },
  { id: "conversations", key: "whatsapp.tile.conversations" },
]

export function WhatsappSettingsContent() {
  const { t } = useLocale()
  const [active, setActive] = useState<WhatsAppTileId>("status")

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex min-h-[520px]">
        <SettingsTabSidebar
          title={t("whatsapp.sidebar.title")}
          items={TILES.map((tile) => ({
            id: tile.id,
            label: t(tile.key),
            desc: tile.desc ? t(tile.desc) : undefined,
          }))}
          activeId={active}
          onSelect={(id) => setActive(id as WhatsAppTileId)}
          width="w-56"
        />

        <div className="flex flex-1 flex-col overflow-y-auto bg-surface-muted/50 p-5">
          {active === "status" && <WhatsappStatusTab />}
          {active === "connection" && <WhatsappConnectionForm />}
          {active === "ai" && <WhatsappAiConfigForm />}
          {active === "conversations" && <WhatsappConversationsTab />}
        </div>
      </div>
    </Card>
  )
}

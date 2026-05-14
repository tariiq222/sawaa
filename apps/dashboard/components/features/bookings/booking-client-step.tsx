"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon, CheckmarkCircle01Icon } from "@hugeicons/core-free-icons"

import { Input } from "@deqah/ui"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@deqah/ui"

import { useClients } from "@/hooks/use-clients"
import type { Client } from "@/lib/types/client"
import { BookingWalkInForm } from "./booking-walkin-form"
import { useLocale } from "@/components/locale-provider"

/* ── Card styles ── */

const card = "bg-surface rounded-xl border border-border shadow-sm overflow-hidden"
const cardHeader = "px-4 py-2.5 bg-surface border-b border-border"
const cardTitle = "text-xs font-semibold text-muted-foreground uppercase tracking-wider"
const cardBody = "px-4 py-4 flex flex-col gap-3"

/* ── Client search result row ── */

function ClientRow({ client, onSelect }: { client: Client; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start transition-colors hover:bg-primary/5 group"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
        {client.firstName.charAt(0)}{client.lastName.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">
          {client.firstName} {client.lastName}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{client.phone}</p>
      </div>
      <HugeiconsIcon
        icon={CheckmarkCircle01Icon}
        size={16}
        className="shrink-0 text-muted-foreground group-hover:text-primary transition-colors"
      />
    </button>
  )
}

/* ── Props ── */

interface ClientStepProps {
  onSelect: (clientId: string, name: string) => void
}

/* ── Main component ── */

export function ClientStep({ onSelect }: ClientStepProps) {
  const { t } = useLocale()
  const [mode, setMode] = useState<"search" | "create">("search")
  const { clients, search, setSearch, isLoading } = useClients()

  return (
    <Tabs value={mode} onValueChange={(v) => setMode(v as "search" | "create")} className="flex flex-col gap-3">

      <div className="flex justify-center">
        <TabsList className="h-10 p-1 w-full">
          <TabsTrigger value="search" className="flex-1 h-8 text-sm font-medium">{t("bookings.client.tab.search")}</TabsTrigger>
          <TabsTrigger value="create" className="flex-1 h-8 text-sm font-medium">{t("bookings.client.tab.create")}</TabsTrigger>
        </TabsList>
      </div>

      {/* Search tab */}
      <TabsContent value="search">
        <div className={card}>
          <div className={cardHeader}><p className={cardTitle}>{t("bookings.client.search.header")}</p></div>
          <div className={cardBody}>
            <div className="relative">
              <HugeiconsIcon
                icon={Search01Icon}
                size={16}
                className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("bookings.client.search.placeholder")}
                className="ps-9 bg-surface-muted"
              />
            </div>
            <div className="flex flex-col max-h-52 overflow-y-auto -mx-1 px-1">
              {isLoading && (
                <p className="text-sm text-center text-muted-foreground py-6">{t("bookings.client.search.loading")}</p>
              )}
              {!isLoading && clients.length === 0 && !search && (
                <p className="text-sm text-center text-muted-foreground py-6">{t("bookings.client.search.startTyping")}</p>
              )}
              {!isLoading && clients.length === 0 && search && (
                <p className="text-sm text-center text-muted-foreground py-6">
                  {t("bookings.client.search.noResults")}{" "}
                  <button
                    type="button"
                    className="text-primary underline underline-offset-2 hover:opacity-80"
                    onClick={() => setMode("create")}
                  >
                    {t("bookings.client.search.createNew")}
                  </button>
                </p>
              )}
              {clients.map((p) => (
                <ClientRow
                  key={p.id}
                  client={p}
                  onSelect={() => onSelect(p.id, `${p.firstName} ${p.lastName}`)}
                />
              ))}
            </div>
          </div>
        </div>
      </TabsContent>

      {/* Create tab */}
      <TabsContent value="create">
        <BookingWalkInForm onSelect={onSelect} />
      </TabsContent>

    </Tabs>
  )
}

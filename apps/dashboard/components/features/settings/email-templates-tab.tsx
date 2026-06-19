"use client"

import { useState } from "react"
import { Card, CardContent } from "@sawaa/ui"
import { Badge } from "@sawaa/ui"
import { Button } from "@sawaa/ui"
import { Skeleton } from "@sawaa/ui"
import { cn } from "@/lib/utils"
import { useEmailTemplates } from "@/hooks/use-email-templates"
import { useLocale } from "@/components/locale-provider"
import { EmailLayoutForm } from "./email-layout-form"
import { EmailTemplateInlineEditor } from "./email-template-inline-editor"
import { BlockPreview } from "./email-builder/block-preview"
import type { EmailTemplate } from "@/lib/types/email-template"
import { SettingsTabSidebar } from "./settings-tab-sidebar"

const EMAIL_LAYOUT_ID = "__email-layout__"

/* ─── Template View (read-only) ─── */

function TemplateView({ template, t, onEdit }: {
  template: EmailTemplate
  t: (k: string) => string
  onEdit: () => void
}) {
  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground">{template.name}</p>
          <Badge
            variant="outline"
            className={cn(
              "text-xs",
              template.isActive
                ? "bg-success/10 text-success border-success/30"
                : "bg-muted text-muted-foreground",
            )}
          >
            {template.isActive ? t("settings.emailTemplates.active") : t("common.inactive")}
          </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={onEdit}>
          {t("common.edit")}
        </Button>
      </div>

      {/* Subject */}
      <Card className="shadow-sm bg-surface min-w-0">
        <CardContent className="space-y-1.5 pt-3 pb-3">
          <p className="text-xs text-muted-foreground">{t("settings.emailTemplates.subject")}</p>
          <p className="text-sm text-foreground truncate" dir="auto">{template.subject || "—"}</p>
        </CardContent>
      </Card>

      {/* Body */}
      <Card className="shadow-sm bg-surface min-w-0 overflow-hidden">
        <CardContent className="space-y-1.5 pt-3 pb-3">
          <p className="text-xs text-muted-foreground">{t("settings.emailTemplates.preview")}</p>
          {template.blocks != null ? (
            <div className="max-h-64 overflow-auto">
              <BlockPreview blocks={template.blocks} />
            </div>
          ) : (
            <pre className="whitespace-pre-wrap break-words text-xs text-foreground leading-relaxed font-mono overflow-hidden" dir="ltr">
              {template.htmlBody || "—"}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/* ─── Main Tab ─── */

export function EmailTemplatesTab() {
  const { t } = useLocale()
  const { data: templates, isLoading } = useEmailTemplates()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="flex gap-0 rounded-xl border border-border overflow-hidden">
        <div className="w-64 border-e border-border bg-surface-muted space-y-1 p-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={`skeleton-${i}`} className="h-14 rounded-lg" />)}
        </div>
        <div className="flex-1 p-6"><Skeleton className="h-48 rounded-lg" /></div>
      </div>
    )
  }

  const list = templates ?? []
  const isLayoutSelected = activeId === EMAIL_LAYOUT_ID
  const selectedTemplate = isLayoutSelected
    ? null
    : (list.find((tmpl: EmailTemplate) => tmpl.id === activeId) ?? list[0] ?? null)
  const isEditing = selectedTemplate?.id === editingId

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex min-h-[520px]">
        {/* Sidebar */}
        <SettingsTabSidebar
          title={t("settings.emailTemplates.title")}
          items={[{ id: EMAIL_LAYOUT_ID, label: t("settings.emailLayout.title") }]}
          activeId={activeId ?? list[0]?.id ?? ""}
          onSelect={(id) => { setActiveId(id); setEditingId(null) }}
          width="w-56"
          footer={
            <>
              <div className="mx-1 my-1 border-b border-border" />
              {list.map((tmpl: EmailTemplate) => {
                const isActive = !isLayoutSelected && (activeId ?? list[0]?.id) === tmpl.id
                return (
                  <div
                    key={tmpl.id}
                    role="tab"
                    aria-selected={isActive}
                    tabIndex={0}
                    onClick={() => { setActiveId(tmpl.id); setEditingId(null) }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { setActiveId(tmpl.id); setEditingId(null) } }}
                    className={cn(
                      "w-full cursor-pointer select-none rounded-lg px-3 py-2.5 transition-all",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
                    )}
                  >
                    <p className="truncate text-sm font-medium leading-tight">{tmpl.name}</p>
                    {isActive && (
                      <p className="mt-0.5 line-clamp-1 font-mono text-xs leading-tight opacity-80">{tmpl.slug}</p>
                    )}
                  </div>
                )
              })}
            </>
          }
        />

        {/* Content Panel */}
        <div className="flex-1 min-w-0 p-5 overflow-y-auto overflow-x-hidden bg-surface-muted/50 flex flex-col">
          {isLayoutSelected ? (
            <EmailLayoutForm onCancel={() => setActiveId(null)} />
          ) : selectedTemplate ? (
            isEditing ? (
              <EmailTemplateInlineEditor
                key={`edit-${selectedTemplate.id}`}
                template={selectedTemplate}
                t={t}
                onSaved={() => setEditingId(null)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <TemplateView
                key={`view-${selectedTemplate.id}`}
                template={selectedTemplate}
                t={t}
                onEdit={() => setEditingId(selectedTemplate.id)}
              />
            )
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              {t("settings.emailTemplates.description")}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

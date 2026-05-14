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
import { EmailFallbackQuotaBanner } from "./email-fallback-quota-banner"
import type { EmailTemplate } from "@/lib/types/email-template"

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
      <>
        <EmailFallbackQuotaBanner />
        <div className="flex gap-0 rounded-xl border border-border overflow-hidden">
          <div className="w-64 border-e border-border bg-surface-muted space-y-1 p-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={`skeleton-${i}`} className="h-14 rounded-lg" />)}
          </div>
          <div className="flex-1 p-6"><Skeleton className="h-48 rounded-lg" /></div>
        </div>
      </>
    )
  }

  const list = templates ?? []
  const isLayoutSelected = activeId === EMAIL_LAYOUT_ID
  const selectedTemplate = isLayoutSelected
    ? null
    : (list.find((tmpl: EmailTemplate) => tmpl.id === activeId) ?? list[0] ?? null)
  const isEditing = selectedTemplate?.id === editingId

  return (
    <>
      <EmailFallbackQuotaBanner />
      <Card className="overflow-hidden p-0">
      <div className="flex min-h-[520px]">
        {/* Sidebar */}
        <div className="w-56 shrink-0 border-e border-border bg-surface-muted flex flex-col">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t("settings.emailTemplates.title")}
            </p>
          </div>
          <div role="tablist" className="flex-1 p-3 space-y-1.5 overflow-y-auto">
            {/* Email Layout entry */}
            <div
              role="tab"
              aria-selected={isLayoutSelected}
              tabIndex={0}
              onClick={() => { setActiveId(EMAIL_LAYOUT_ID); setEditingId(null) }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { setActiveId(EMAIL_LAYOUT_ID); setEditingId(null) } }}
              className={cn(
                "w-full rounded-lg px-3 py-2.5 cursor-pointer select-none transition-all",
                isLayoutSelected
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
              )}
            >
              <p className="text-sm font-medium truncate leading-tight">
                {t("settings.emailLayout.title")}
              </p>
            </div>
            <div className="border-b border-border mx-1 my-1" />
            {/* Template list */}
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
                    "w-full rounded-lg px-3 py-2.5 cursor-pointer select-none transition-all",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
                  )}
                >
                  <p className="text-sm font-medium truncate leading-tight">
                    {tmpl.name}
                  </p>
                  {isActive && (
                    <p className="text-xs mt-0.5 line-clamp-1 leading-tight opacity-80 font-mono">
                      {tmpl.slug}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>

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
    </>
  )
}

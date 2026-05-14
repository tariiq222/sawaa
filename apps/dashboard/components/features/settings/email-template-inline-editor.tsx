"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Card, CardContent, Button, Input, Label, Switch } from "@deqah/ui"
import { useEmailTemplateMutations } from "@/hooks/use-email-templates"
import type { EmailTemplate, EmailBlock } from "@/lib/types/email-template"
import { BlockList } from "./email-builder/block-list"
import { BlockPreview } from "./email-builder/block-preview"

interface Props {
  template: EmailTemplate
  t: (k: string) => string
  onSaved: () => void
  onCancel: () => void
}

export function EmailTemplateInlineEditor({ template, t, onSaved, onCancel }: Props) {
  const { updateMut } = useEmailTemplateMutations()
  const [subject, setSubject] = useState(template.subject ?? "")
  const [blocks, setBlocks] = useState<EmailBlock[]>(template.blocks ?? [])
  const [isActive, setIsActive] = useState(template.isActive)

  const isLegacy = template.blocks === null && template.htmlBody.length > 0 && blocks.length === 0

  const handleSave = () => {
    updateMut.mutate(
      { id: template.id, subject, blocks, isActive },
      {
        onSuccess: () => { toast.success(t("settings.emailTemplates.saved")); onSaved() },
        onError: () => toast.error(t("settings.error")),
      },
    )
  }

  return (
    <div className="flex flex-col gap-3 h-full overflow-hidden min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 shrink-0">
        <p className="text-sm font-semibold text-foreground">{template.name}</p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{t("settings.emailTemplates.active")}</span>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>
      </div>

      {/* Subject */}
      <Card className="shadow-sm bg-surface min-w-0 shrink-0">
        <CardContent className="space-y-2 pt-3 pb-3">
          <Label>{t("settings.emailTemplates.subject")}</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} dir="auto" className="w-full" />
        </CardContent>
      </Card>

      {isLegacy && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning shrink-0">
          {t("settings.emailTemplates.legacyWarning")}
        </div>
      )}

      {/* Builder + Preview split */}
      <div className="grid grid-cols-2 gap-3 flex-1 min-h-0 min-w-0">
        <Card className="shadow-sm bg-surface min-w-0 overflow-hidden flex flex-col">
          <CardContent className="pt-3 pb-3 flex-1 overflow-auto space-y-2">
            <Label>{t("settings.emailTemplates.builder")}</Label>
            <BlockList blocks={blocks} onChange={setBlocks} t={t} />
          </CardContent>
        </Card>
        <Card className="shadow-sm bg-surface min-w-0 overflow-hidden flex flex-col">
          <CardContent className="pt-3 pb-3 flex-1 overflow-hidden flex flex-col gap-2">
            <Label>{t("settings.emailTemplates.preview")}</Label>
            <div className="flex-1 min-h-0">
              <BlockPreview blocks={blocks} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-2 shrink-0">
        <Button variant="outline" size="sm" onClick={onCancel}>{t("common.cancel")}</Button>
        <Button size="sm" onClick={handleSave} disabled={updateMut.isPending}>
          {updateMut.isPending ? t("common.saving") : t("settings.save")}
        </Button>
      </div>
    </div>
  )
}

"use client"

// whatsapp-prompts-section — unified agent prompt, active policy rules, and greetings.

import { Input, Label, Textarea } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"

interface WhatsappPromptsSectionProps {
  systemPrompt: string
  greeting: string
  onChangeSystemPrompt: (value: string) => void
  onChangeGreeting: (value: string) => void
}

export function WhatsappPromptsSection({
  systemPrompt,
  greeting,
  onChangeSystemPrompt,
  onChangeGreeting,
}: WhatsappPromptsSectionProps) {
  const { t } = useLocale()

  return (
    <>
      <div className="rounded-lg border border-border/70 bg-surface-muted/30 p-4">
        <p className="text-sm font-semibold text-foreground">
          {t("whatsapp.ai.currentRules")}
        </p>
        <ul className="mt-3 list-disc space-y-1 ps-5 text-xs leading-5 text-muted-foreground">
          {[1, 2, 3, 4, 5, 6, 7].map((rule) => (
            <li key={rule}>{t(`whatsapp.ai.rule${rule}`)}</li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ai-system-prompt">{t("whatsapp.ai.systemPrompt")}</Label>
        <Textarea
          id="ai-system-prompt"
          value={systemPrompt}
          onChange={(e) => onChangeSystemPrompt(e.target.value)}
          rows={8}
        />
        <p className="text-xs text-muted-foreground">
          {t("whatsapp.ai.systemPromptHint")}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ai-greeting">{t("whatsapp.ai.greeting")}</Label>
        <Input
          id="ai-greeting"
          value={greeting}
          onChange={(e) => onChangeGreeting(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          {t("whatsapp.ai.greetingHint")}
        </p>
      </div>
    </>
  )
}

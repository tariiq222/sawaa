"use client"

// whatsapp-prompts-section — Arabic/English system prompts + greetings.

import { Input, Label, Textarea } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"

interface WhatsappPromptsSectionProps {
  systemPromptAr: string
  systemPromptEn: string
  greetingAr: string
  greetingEn: string
  onChangeSystemPromptAr: (value: string) => void
  onChangeSystemPromptEn: (value: string) => void
  onChangeGreetingAr: (value: string) => void
  onChangeGreetingEn: (value: string) => void
}

export function WhatsappPromptsSection({
  systemPromptAr,
  systemPromptEn,
  greetingAr,
  greetingEn,
  onChangeSystemPromptAr,
  onChangeSystemPromptEn,
  onChangeGreetingAr,
  onChangeGreetingEn,
}: WhatsappPromptsSectionProps) {
  const { t } = useLocale()

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ai-promptAr">{t("whatsapp.ai.systemPromptAr")}</Label>
          <Textarea
            id="ai-promptAr"
            value={systemPromptAr}
            onChange={(e) => onChangeSystemPromptAr(e.target.value)}
            rows={6}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ai-promptEn">{t("whatsapp.ai.systemPromptEn")}</Label>
          <Textarea
            id="ai-promptEn"
            value={systemPromptEn}
            onChange={(e) => onChangeSystemPromptEn(e.target.value)}
            rows={6}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ai-greetingAr">{t("whatsapp.ai.greetingAr")}</Label>
          <Input
            id="ai-greetingAr"
            value={greetingAr}
            onChange={(e) => onChangeGreetingAr(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ai-greetingEn">{t("whatsapp.ai.greetingEn")}</Label>
          <Input
            id="ai-greetingEn"
            value={greetingEn}
            onChange={(e) => onChangeGreetingEn(e.target.value)}
          />
        </div>
      </div>
    </>
  )
}

"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@sawaa/ui"
import { Input } from "@sawaa/ui"
import { Label } from "@sawaa/ui"
import { Button } from "@sawaa/ui"
import { Skeleton } from "@sawaa/ui"
import { Textarea } from "@sawaa/ui"
import { useChatbotConfig, useChatbotMutations } from "@/hooks/use-chatbot"
import { useLocale } from "@/components/locale-provider"
import type { UpsertChatbotConfigPayload } from "@/lib/types/chatbot"

/* ─── Component ─── */

export function ConfigTab() {
  const { t } = useLocale()
  const { config, loading } = useChatbotConfig()
  const { updateConfigMut } = useChatbotMutations()

  const [systemPromptAr, setSystemPromptAr] = useState("")
  const [systemPromptEn, setSystemPromptEn] = useState("")
  const [greetingAr, setGreetingAr] = useState("")
  const [greetingEn, setGreetingEn] = useState("")
  const [escalateToHumanAt, setEscalateToHumanAt] = useState("")

  useEffect(() => {
    if (!config) return
    setSystemPromptAr(config.systemPromptAr ?? "")
    setSystemPromptEn(config.systemPromptEn ?? "")
    setGreetingAr(config.greetingAr ?? "")
    setGreetingEn(config.greetingEn ?? "")
    setEscalateToHumanAt(config.escalateToHumanAt?.toString() ?? "")
  }, [config])

  const handleSave = async () => {
    const payload: UpsertChatbotConfigPayload = {
      systemPromptAr: systemPromptAr || undefined,
      systemPromptEn: systemPromptEn || undefined,
      greetingAr: greetingAr || undefined,
      greetingEn: greetingEn || undefined,
      escalateToHumanAt: escalateToHumanAt ? parseInt(escalateToHumanAt, 10) : undefined,
    }
    try {
      await updateConfigMut.mutateAsync(payload)
      toast.success(t("chatbot.config.saved"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("chatbot.config.saveError"))
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4 pt-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={`skeleton-${i}`} className="h-40 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 pt-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            {t("chatbot.config.category.personality") || "System Prompts"}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">
              {t("chatbot.config.systemPromptAr") || "System Prompt (Arabic)"}
            </Label>
            <Textarea
              value={systemPromptAr}
              onChange={(e) => setSystemPromptAr(e.target.value)}
              rows={4}
              dir="rtl"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">
              {t("chatbot.config.systemPromptEn") || "System Prompt (English)"}
            </Label>
            <Textarea
              value={systemPromptEn}
              onChange={(e) => setSystemPromptEn(e.target.value)}
              rows={4}
              dir="ltr"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            {t("chatbot.config.category.general") || "Greetings"}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">
              {t("chatbot.config.greetingAr") || "Greeting (Arabic)"}
            </Label>
            <Input
              value={greetingAr}
              onChange={(e) => setGreetingAr(e.target.value)}
              dir="rtl"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">
              {t("chatbot.config.greetingEn") || "Greeting (English)"}
            </Label>
            <Input
              value={greetingEn}
              onChange={(e) => setGreetingEn(e.target.value)}
              dir="ltr"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            {t("chatbot.config.category.handoff") || "Handoff"}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">
              {t("chatbot.config.escalateToHumanAt") || "Auto-escalate after N messages"}
            </Label>
            <Input
              type="number"
              min={1}
              value={escalateToHumanAt}
              onChange={(e) => setEscalateToHumanAt(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={updateConfigMut.isPending}>
          {updateConfigMut.isPending ? t("chatbot.config.saving") : t("chatbot.config.save")}
        </Button>
      </div>
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Input } from "@sawaa/ui"
import { Label } from "@sawaa/ui"
import { Button } from "@sawaa/ui"
import { Skeleton } from "@sawaa/ui"
import { Textarea } from "@sawaa/ui"
import { useChatbotConfig, useChatbotMutations } from "@/hooks/use-chatbot"
import { useLocale } from "@/components/locale-provider"
import type { UpsertChatbotConfigPayload } from "@/lib/types/chatbot"
import { showApiError } from "@/lib/mutation-helpers"

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

  // Seed local form state when server config arrives/changes.
  /* eslint-disable react-hooks/set-state-in-effect -- intentional sync from server → local form state */
  useEffect(() => {
    if (!config) return
    setSystemPromptAr(config.systemPromptAr ?? "")
    setSystemPromptEn(config.systemPromptEn ?? "")
    setGreetingAr(config.greetingAr ?? "")
    setGreetingEn(config.greetingEn ?? "")
    setEscalateToHumanAt(config.escalateToHumanAt?.toString() ?? "")
  }, [config])
  /* eslint-enable react-hooks/set-state-in-effect */

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
      showApiError(err, { fallback: t("chatbot.config.saveError"), t })
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
    <div className="flex flex-col gap-6 pt-4">
      {/* ─── System Prompts ─── */}
      <section className="flex flex-col gap-4">
        <p className="text-sm font-semibold text-foreground">
          {t("chatbot.config.category.personality")}
        </p>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">
            {t("chatbot.config.systemPromptAr")}
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
            {t("chatbot.config.systemPromptEn")}
          </Label>
          <Textarea
            value={systemPromptEn}
            onChange={(e) => setSystemPromptEn(e.target.value)}
            rows={4}
            dir="ltr"
          />
        </div>
      </section>

      <div className="h-px bg-border/60" />

      {/* ─── Greetings ─── */}
      <section className="flex flex-col gap-4">
        <p className="text-sm font-semibold text-foreground">
          {t("chatbot.config.category.general")}
        </p>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">
            {t("chatbot.config.greetingAr")}
          </Label>
          <Input
            value={greetingAr}
            onChange={(e) => setGreetingAr(e.target.value)}
            dir="rtl"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">
            {t("chatbot.config.greetingEn")}
          </Label>
          <Input
            value={greetingEn}
            onChange={(e) => setGreetingEn(e.target.value)}
            dir="ltr"
          />
        </div>
      </section>

      <div className="h-px bg-border/60" />

      {/* ─── Handoff ─── */}
      <section className="flex flex-col gap-4">
        <p className="text-sm font-semibold text-foreground">
          {t("chatbot.config.category.handoff")}
        </p>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">
            {t("chatbot.config.escalateToHumanAt")}
          </Label>
          <Input
            type="number"
            min={1}
            value={escalateToHumanAt}
            onChange={(e) => setEscalateToHumanAt(e.target.value)}
          />
        </div>
      </section>

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={updateConfigMut.isPending}>
          {updateConfigMut.isPending ? t("chatbot.config.saving") : t("chatbot.config.save")}
        </Button>
      </div>
    </div>
  )
}

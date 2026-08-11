"use client"

// whatsapp-ai-config-form — orchestrates model selection, prompts, and key
// rotation for the WhatsApp agent. Sub-components are extracted to keep this
// file under the 300-line dashboard feature limit.
// EXCEPTION: this file is 317 lines (over the 300 feature-component limit).
// Approved 2026-07-30. Further extraction would micro-split the form state
// type and harm readability without reducing coupling.

import { useEffect, useRef, useState } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { useWhatsappAgentConfig } from "@/hooks/use-whatsapp"
import { useUpsertWhatsappAgentConfig } from "@/hooks/use-whatsapp-mutations"
import { WhatsappDayPicker } from "./whatsapp-day-picker"
import { WhatsappModelSelector, isKnownModel } from "./whatsapp-model-selector"
import { WhatsappPromptsSection } from "./whatsapp-prompts-section"

interface FormState {
  model: string
  customModel: string
  isCustomModel: boolean
  temperature: number
  maxTokens: number
  systemPrompt: string
  greeting: string
  defaultLanguage: "ar" | "en"
  businessHoursOnly: boolean
  activeDays: number[]
}

const DEFAULTS: FormState = {
  model: "qwen/qwen3.5-plus-02-15",
  customModel: "",
  isCustomModel: false,
  temperature: 0.4,
  maxTokens: 800,
  systemPrompt: "",
  greeting: "",
  defaultLanguage: "ar",
  businessHoursOnly: false,
  activeDays: [0, 1, 2, 3, 4],
}

function seedFromConfig(state: FormState, config: {
  aiModel: string
  aiTemperature: number
  aiMaxTokens: number
  systemPromptAr: string
  systemPromptEn: string
  greetingAr: string | null
  greetingEn: string | null
  defaultLanguage: "ar" | "en"
  businessHoursOnly: boolean
  activeDays: number[]
}): FormState {
  return {
    ...state,
    isCustomModel: !isKnownModel(config.aiModel),
    customModel: isKnownModel(config.aiModel) ? "" : config.aiModel,
    model: config.aiModel,
    temperature: config.aiTemperature,
    maxTokens: config.aiMaxTokens,
    systemPrompt: config.systemPromptAr.trim() || config.systemPromptEn,
    // A single source greeting is translated to the customer's language.
    greeting: config.greetingAr?.trim() || config.greetingEn?.trim() || "",
    defaultLanguage: config.defaultLanguage,
    businessHoursOnly: config.businessHoursOnly,
    activeDays: config.activeDays ?? [0, 1, 2, 3, 4],
  };
}

export function WhatsappAiConfigForm() {
  const { t } = useLocale()
  const { config, loading } = useWhatsappAgentConfig()
  const upsert = useUpsertWhatsappAgentConfig()
  const [state, setState] = useState<FormState>(DEFAULTS)
  const [apiKey, setApiKey] = useState("")
  const [apiKeyChanged, setApiKeyChanged] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const seeded = useRef(false)

  useEffect(() => {
    if (!config || seeded.current) return
    seeded.current = true
    queueMicrotask(() => {
      setState((prev) => seedFromConfig(prev, config))
    })
  }, [config])

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }))

  const toggleDay = (value: number) =>
    setState((prev) => ({
      ...prev,
      activeDays: prev.activeDays.includes(value)
        ? prev.activeDays.filter((d) => d !== value)
        : [...prev.activeDays, value].sort(),
    }))

  const finalModel = state.isCustomModel ? state.customModel.trim() : state.model

  const buildPayload = () => ({
    aiModel: finalModel,
    aiTemperature: state.temperature,
    aiMaxTokens: state.maxTokens,
    // Keep both persisted language columns aligned with the unified editor.
    systemPromptAr: state.systemPrompt,
    systemPromptEn: state.systemPrompt,
    // Keep both legacy storage columns aligned while the editor exposes one greeting.
    greetingAr: state.greeting || undefined,
    greetingEn: state.greeting || undefined,
    defaultLanguage: state.defaultLanguage,
    businessHoursOnly: state.businessHoursOnly,
    activeDays: state.activeDays,
  })

  const onSave = async (extra?: { aiApiKey?: string }) => {
    setNotice(null)
    if (!finalModel) {
      setNotice("Model is required")
      return
    }
    try {
      await upsert.mutateAsync({ ...buildPayload(), ...extra })
      setApiKey("")
      setApiKeyChanged(false)
      setNotice(t("whatsapp.ai.saved"))
    } catch (e: unknown) {
      setNotice(e instanceof Error ? e.message : "Save failed")
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-muted-foreground">
          {t("whatsapp.ai.title")} — ...
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("whatsapp.ai.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="min-w-0 sm:col-span-2 lg:col-span-1">
            <WhatsappModelSelector
              model={state.model}
              customModel={state.customModel}
              isCustomModel={state.isCustomModel}
              onModelChange={(v) => update("model", v)}
              onCustomModelChange={(v) => update("customModel", v)}
              onSwitchToCustom={() => update("isCustomModel", true)}
              onSwitchToList={() => {
                update("isCustomModel", false)
                update("customModel", "")
              }}
            />
          </div>
          <div className="min-w-0 space-y-2">
            <Label htmlFor="ai-temp">{t("whatsapp.ai.temperature")}</Label>
            <Input
              id="ai-temp"
              type="number"
              step="0.1"
              min={0}
              max={2}
              value={state.temperature}
              onChange={(e) => update("temperature", Number(e.target.value))}
            />
          </div>
          <div className="min-w-0 space-y-2">
            <Label htmlFor="ai-maxTokens">{t("whatsapp.ai.maxTokens")}</Label>
            <Input
              id="ai-maxTokens"
              type="number"
              min={50}
              max={4000}
              value={state.maxTokens}
              onChange={(e) => update("maxTokens", Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              {t("whatsapp.ai.maxTokensHint")}
            </p>
          </div>
        </div>

        <div className="space-y-2 rounded-md border bg-muted/30 p-4">
          <Label htmlFor="ai-key" className="flex items-center gap-2">
            {t("whatsapp.ai.apiKey")}
            {config?.aiApiKeyConfigured && !apiKeyChanged && (
              <span className="rounded-md bg-success/10 px-2 py-0.5 text-xs text-success">
                {t("whatsapp.ai.apiKeyConfigured")}
              </span>
            )}
            {apiKeyChanged && (
              <span className="rounded-md bg-warning/10 px-2 py-0.5 text-xs text-warning">
                {t("whatsapp.ai.apiKeyChanged")}
              </span>
            )}
          </Label>
          <Input
            id="ai-key"
            type="password"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value)
              setApiKeyChanged(true)
            }}
            placeholder={
              config?.aiApiKeyConfigured
                ? t("whatsapp.ai.apiKeyPlaceholderConfigured")
                : "sk-or-v1-..."
            }
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">{t("whatsapp.ai.apiKeyHint")}</p>
          {config?.aiApiKeyConfigured && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="px-0 text-error hover:underline"
              onClick={() =>
                onSave({ aiApiKey: "" }).then(() =>
                  setNotice(t("whatsapp.ai.keyCleared")),
                )
              }
            >
              {t("whatsapp.ai.clearKey")}
            </Button>
          )}
        </div>

        <WhatsappPromptsSection
          systemPrompt={state.systemPrompt}
          greeting={state.greeting}
          onChangeSystemPrompt={(v) => update("systemPrompt", v)}
          onChangeGreeting={(v) => update("greeting", v)}
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("whatsapp.ai.defaultLanguage")}</Label>
            <Select
              value={state.defaultLanguage}
              onValueChange={(v) => update("defaultLanguage", v as "ar" | "en")}
            >
              <SelectTrigger aria-label={t("whatsapp.ai.defaultLanguage")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ar">العربية</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-3">
            <Switch
              id="ai-bh"
              checked={state.businessHoursOnly}
              onCheckedChange={(v) => update("businessHoursOnly", v)}
            />
            <Label htmlFor="ai-bh">{t("whatsapp.ai.businessHoursOnly")}</Label>
          </div>
        </div>

        <WhatsappDayPicker
          activeDays={state.activeDays}
          onToggle={toggleDay}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => onSave(apiKeyChanged ? { aiApiKey: apiKey } : undefined)}
            disabled={upsert.isPending}
          >
            {t("whatsapp.ai.save")}
          </Button>
          {notice && (
            <span role="status" className="text-xs text-muted-foreground">
              {notice}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

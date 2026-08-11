"use client"

// whatsapp-model-selector — curated list with a "custom" fallback. Only the
// models the operator explicitly chose appear as quick picks; anything else
// is entered as a free-text model id.

import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"

const MODEL_OPTIONS: { provider: string; models: { id: string; label: string }[] }[] = [
  {
    provider: "Anthropic",
    models: [
      { id: "anthropic/claude-sonnet-5", label: "Claude Sonnet 5" },
      { id: "anthropic/claude-haiku-4.5", label: "Claude Haiku 4.5" },
    ],
  },
  {
    provider: "Qwen",
    models: [{ id: "qwen/qwen3.5-plus-02-15", label: "Qwen 3.5 Plus 02-15" }],
  },
  {
    provider: "Google",
    models: [{ id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash" }],
  },
  {
    provider: "Mistral",
    models: [{ id: "mistralai/mistral-saba", label: "Mistral Saba" }],
  },
]

export function isKnownModel(modelId: string): boolean {
  return MODEL_OPTIONS.some((group) =>
    group.models.some((m) => m.id === modelId),
  )
}

interface WhatsappModelSelectorProps {
  model: string
  customModel: string
  isCustomModel: boolean
  onModelChange: (model: string) => void
  onCustomModelChange: (model: string) => void
  onSwitchToCustom: () => void
  onSwitchToList: () => void
}

export function WhatsappModelSelector({
  model,
  customModel,
  isCustomModel,
  onModelChange,
  onCustomModelChange,
  onSwitchToCustom,
  onSwitchToList,
}: WhatsappModelSelectorProps) {
  const { t } = useLocale()

  return (
    <div className="space-y-2">
      <Label htmlFor="ai-model">{t("whatsapp.ai.model")}</Label>
      <Select
        value={isCustomModel ? "__custom__" : model}
        onValueChange={(v) => {
          if (v === "__custom__") {
            onSwitchToCustom()
          } else {
            onSwitchToList()
            onModelChange(v)
          }
        }}
      >
        <SelectTrigger id="ai-model" className="w-full min-w-0">
          <SelectValue className="min-w-0 truncate" />
        </SelectTrigger>
        <SelectContent className="max-h-[320px]">
          {MODEL_OPTIONS.map((group) => (
            <SelectGroup key={group.provider}>
              <SelectLabel>{group.provider}</SelectLabel>
              {group.models.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  <span className="truncate">{m.label}</span>
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
          <SelectSeparator />
          <SelectItem value="__custom__">
            {t("whatsapp.ai.modelCustom")}
          </SelectItem>
        </SelectContent>
      </Select>
      {isCustomModel && (
        <Input
          value={customModel}
          onChange={(e) => onCustomModelChange(e.target.value)}
          placeholder="provider/model-name"
          aria-label={t("whatsapp.ai.modelCustom")}
          autoComplete="off"
        />
      )}
      <p className="text-xs text-muted-foreground">
        {isCustomModel
          ? t("whatsapp.ai.modelCustomHint")
          : t("whatsapp.ai.modelHint")}
      </p>
      {!isCustomModel && (
        <p className="truncate text-[11px] text-muted-foreground/80" dir="ltr">
          {model}
        </p>
      )}
    </div>
  )
}

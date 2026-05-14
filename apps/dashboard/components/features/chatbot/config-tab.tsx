"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@deqah/ui"
import { Input } from "@deqah/ui"
import { Label } from "@deqah/ui"
import { Button } from "@deqah/ui"
import { Skeleton } from "@deqah/ui"
import { useChatbotConfig, useChatbotMutations } from "@/hooks/use-chatbot"
import { useLocale } from "@/components/locale-provider"
import type { ChatbotConfigEntry } from "@/lib/types/chatbot"

const CATEGORIES = ["personality", "rules", "handoff", "sync", "ai", "general"]

/* ─── Category Card ─── */

function ConfigCategoryCard({
  category,
  entries,
  onSave,
  saving,
  t,
}: {
  category: string
  entries: ChatbotConfigEntry[]
  onSave: (
    configs: { key: string; value: unknown; category: string }[],
  ) => Promise<void>
  saving: boolean
  t: (key: string) => string
}) {
  const [values, setValues] = useState<Record<string, string>>({})

  const initValues = useCallback(() => {
    const initial: Record<string, string> = {}
    for (const entry of entries) {
      initial[entry.key] =
        typeof entry.value === "string"
          ? entry.value
          : JSON.stringify(entry.value)
    }
    setValues(initial)
  }, [entries])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    initValues()
  }, [initValues])

  const handleSave = async () => {
    const configs = Object.entries(values).map(([key, val]) => {
      let parsed: unknown = val
      try {
        parsed = JSON.parse(val)
      } catch {
        /* keep as string */
      }
      return { key, value: parsed, category }
    })
    await onSave(configs)
  }

  if (entries.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">
          {t(`chatbot.config.category.${category}`) || category}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {entries.map((entry) => (
          <div key={entry.key} className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">
              {entry.key}
            </Label>
            <Input
              value={values[entry.key] ?? ""}
              onChange={(e) =>
                setValues((prev) => ({
                  ...prev,
                  [entry.key]: e.target.value,
                }))
              }
            />
          </div>
        ))}
        <div className="flex justify-end pt-2">
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? t("chatbot.config.saving") : t("chatbot.config.save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

/* ─── Component ─── */

export function ConfigTab() {
  const { t } = useLocale()
  const { config, loading } = useChatbotConfig()
  const { updateConfigMut } = useChatbotMutations()

  const grouped = CATEGORIES.reduce<Record<string, ChatbotConfigEntry[]>>(
    (acc, cat) => {
      acc[cat] = config.filter((c) => c.category === cat)
      return acc
    },
    {},
  )

  // Include entries with unlisted categories
  const listedKeys = new Set(CATEGORIES)
  const uncategorized = config.filter((c) => !listedKeys.has(c.category))
  if (uncategorized.length > 0) {
    grouped["other"] = uncategorized
  }

  const handleSave = async (
    configs: { key: string; value: unknown; category: string }[],
  ) => {
    try {
      await updateConfigMut.mutateAsync({ configs })
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

  if (config.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-muted-foreground">
          {t("chatbot.config.empty")}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 pt-4">
      {Object.entries(grouped).map(
        ([category, entries]) =>
          entries.length > 0 && (
            <ConfigCategoryCard
              key={category}
              category={category}
              entries={entries}
              onSave={handleSave}
              saving={updateConfigMut.isPending}
              t={t}
            />
          ),
      )}
    </div>
  )
}

"use client"

import { useEffect, useMemo, useState } from "react"
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch } from "@sawaa/ui"
import { HugeiconsIcon } from "@hugeicons/react"
import { Tick01Icon, CancelCircleIcon, AiChat02Icon } from "@hugeicons/core-free-icons"
import { useLocale } from "@/components/locale-provider"
import { useAuth } from "@/components/providers/auth-provider"
import { useSaveSawaaAiSettings, useSawaaAiModels, useSawaaAiSettings, useTestSawaaAiConnection } from "@/hooks/use-sawaa-ai-settings"
import type { AiProvider } from "@/lib/api/sawaa-ai-settings"
import { SawaaAiKnowledgeBase } from "./sawaa-ai-knowledge-base"

export function SawaaAiSettingsContent() {
  const { t } = useLocale()
  const { canDo } = useAuth()
  const canManage = canDo("setting", "manage")
  const { config, loading, error } = useSawaaAiSettings()
  const modelsQuery = useSawaaAiModels()
  const save = useSaveSawaaAiSettings()
  const test = useTestSawaaAiConnection()
  const [provider, setProvider] = useState<AiProvider>("OPENROUTER")
  const [model, setModel] = useState("openai/gpt-4o-mini")
  const [apiKey, setApiKey] = useState("")
  const [temperature, setTemperature] = useState("0.4")
  const [maxTokens, setMaxTokens] = useState("800")
  const [enabled, setEnabled] = useState(false)
  const [testedIdentity, setTestedIdentity] = useState<{ provider: AiProvider; model: string; ok: boolean } | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    if (!config) return
    // Server projection seeds the controlled form once it is available.
    /* eslint-disable react-hooks/set-state-in-effect */
    setProvider(config.provider); setModel(config.model); setTemperature(String(config.temperature)); setMaxTokens(String(config.maxTokens)); setEnabled(config.isEnabled)
    setTestedIdentity(config.lastTestOk ? { provider: config.provider, model: config.model, ok: true } : null)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [config])

  const providerModels = useMemo(() => modelsQuery.data?.find((item) => item.provider === provider)?.models ?? [], [modelsQuery.data, provider])
  const canEnable = Boolean(config?.hasCredential && config.lastTestOk && config.connectionStatus === "CONNECTED" && testedIdentity?.ok && testedIdentity.provider === provider && testedIdentity.model === model)
  const baseInput = { provider, model, temperature: Number(temperature) || 0.4, maxTokens: Number(maxTokens) || 800 }
  const changeProvider = (value: AiProvider) => { setProvider(value); setApiKey(""); const first = modelsQuery.data?.find((item) => item.provider === value)?.models[0]; if (first) setModel(first); setTestedIdentity(null); setEnabled(false); setMessage(null) }
  const changeModel = (value: string) => { setModel(value); setTestedIdentity(null); setEnabled(false); setMessage(null) }

  const onTest = async () => {
    if (!apiKey.trim()) { setMessage({ ok: false, text: t("sawaaAi.keyRequired") }); return }
    setMessage(null)
    try { const result = await test.mutateAsync({ ...baseInput, candidateApiKey: apiKey.trim(), saveCredential: true }); setMessage({ ok: result.ok, text: result.ok ? t("sawaaAi.testSuccess") : t("sawaaAi.testFailed") }); setTestedIdentity(result.ok ? { provider, model, ok: true } : null); if (result.ok) setApiKey("") } catch { setTestedIdentity(null); setMessage({ ok: false, text: t("sawaaAi.testFailed") }) }
  }
  const onSave = async () => {
    const candidateApiKey = apiKey.trim()
    if (candidateApiKey) {
      setMessage(null)
      try {
        const result = await test.mutateAsync({ ...baseInput, candidateApiKey, saveCredential: true })
        if (!result.ok) {
          setTestedIdentity(null)
          setMessage({ ok: false, text: t("sawaaAi.testFailed") })
          return
        }
        setApiKey("")
        setTestedIdentity({ provider, model, ok: true })
        setMessage({ ok: true, text: t("sawaaAi.saved") })
      } catch {
        setTestedIdentity(null)
        setMessage({ ok: false, text: t("sawaaAi.testFailed") })
      }
      return
    }
    if (!config?.hasCredential) { setMessage({ ok: false, text: t("sawaaAi.keyRequired") }); return }
    if (enabled && !canEnable) { setMessage({ ok: false, text: t("sawaaAi.enableRequiresTest") }); return }
    try { await save.mutateAsync({ ...baseInput, isEnabled: enabled }); setMessage({ ok: true, text: t("sawaaAi.saved") }) } catch { setMessage({ ok: false, text: t("sawaaAi.saveFailed") }) }
  }

  if (loading) return <Card><CardContent className="py-8"><p className="text-sm text-muted-foreground">{t("common.loading")}</p></CardContent></Card>
  if (error) return <Card><CardContent className="py-8"><p role="alert" className="text-sm text-destructive">{t("sawaaAi.loadFailed")}</p></CardContent></Card>

  return <div className="space-y-4"><Card data-testid="sawaa-ai-settings" className="overflow-hidden">
    <CardHeader><div className="flex items-center gap-3"><span className="rounded-xl bg-primary/10 p-2 text-primary"><HugeiconsIcon icon={AiChat02Icon} size={22} /></span><div><CardTitle>{t("sawaaAi.title")}</CardTitle><p className="text-sm text-muted-foreground">{t("sawaaAi.description")}</p></div></div></CardHeader>
    <CardContent className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="sawaa-ai-provider">{t("sawaaAi.provider")}</Label><Select value={provider} onValueChange={(value) => changeProvider(value as AiProvider)} disabled={!canManage}><SelectTrigger id="sawaa-ai-provider"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="OPENROUTER">OpenRouter</SelectItem><SelectItem value="OPENAI">OpenAI</SelectItem><SelectItem value="MINIMAX">MiniMax</SelectItem></SelectContent></Select></div>
        <div className="space-y-2"><Label htmlFor="sawaa-ai-model">{t("sawaaAi.model")}</Label><Select value={model} onValueChange={changeModel} disabled={!canManage}><SelectTrigger id="sawaa-ai-model"><SelectValue /></SelectTrigger><SelectContent>{providerModels.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}{!providerModels.includes(model) && <SelectItem value={model}>{model}</SelectItem>}</SelectContent></Select></div>
      </div>
      <div className="space-y-2"><Label htmlFor="sawaa-ai-key">{t("sawaaAi.apiKey")}</Label><Input id="sawaa-ai-key" type="password" autoComplete="new-password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={config?.hasCredential ? t("sawaaAi.keyPreserved") : t("sawaaAi.keyPlaceholder")} disabled={!canManage} dir="ltr" /><p className="text-xs text-muted-foreground">{t("sawaaAi.writeOnly")}</p></div>
      <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="sawaa-ai-temperature">{t("sawaaAi.temperature")}</Label><Input id="sawaa-ai-temperature" type="number" min="0" max="2" step="0.1" value={temperature} onChange={(event) => setTemperature(event.target.value)} disabled={!canManage} dir="ltr" /></div><div className="space-y-2"><Label htmlFor="sawaa-ai-max-tokens">{t("sawaaAi.maxTokens")}</Label><Input id="sawaa-ai-max-tokens" type="number" min="1" value={maxTokens} onChange={(event) => setMaxTokens(event.target.value)} disabled={!canManage} dir="ltr" /></div></div>
      {modelsQuery.isError && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"><span>{t("sawaaAi.modelsFailed")}</span><Button type="button" variant="outline" size="sm" onClick={() => void modelsQuery.refetch()} disabled={modelsQuery.isFetching}>{modelsQuery.isFetching ? t("common.loading") : t("common.retry")}</Button></div>}
      <div className="flex items-center justify-between rounded-lg border border-border/70 p-3"><div><Label htmlFor="sawaa-ai-enabled">{t("sawaaAi.enable")}</Label><p className="text-xs text-muted-foreground">{canEnable ? t("sawaaAi.enableReady") : t("sawaaAi.enableRequiresTest")}</p></div><Switch id="sawaa-ai-enabled" checked={enabled} onCheckedChange={setEnabled} disabled={!canManage || !canEnable} /></div>
      {message && <div role="status" className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${message.ok ? "border-success/30 bg-success/10 text-success" : "border-destructive/30 bg-destructive/10 text-destructive"}`}><HugeiconsIcon icon={message.ok ? Tick01Icon : CancelCircleIcon} size={16} />{message.text}</div>}
      {canManage && <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={onTest} disabled={test.isPending || save.isPending || !apiKey.trim()}>{test.isPending ? t("sawaaAi.testing") : t("sawaaAi.test")}</Button><Button type="button" onClick={onSave} disabled={save.isPending || test.isPending || (enabled && !canEnable)}>{save.isPending || test.isPending ? t("common.saving") : t("settings.save")}</Button></div>}
      {!canManage && <p className="text-sm text-muted-foreground">{t("sawaaAi.readOnly")}</p>}
    </CardContent>
  </Card><SawaaAiKnowledgeBase /></div>
}

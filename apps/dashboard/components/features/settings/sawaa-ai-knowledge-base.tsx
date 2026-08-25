"use client"

import { useEffect, useState } from "react"
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Textarea } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { useAuth } from "@/components/providers/auth-provider"
import { useSawaaAiKnowledge, useSawaaAiKnowledgeDetail, useSawaaAiKnowledgeMutations } from "@/hooks/use-sawaa-ai-knowledge-base"
import type { KnowledgeEntry, KnowledgeInput } from "@/lib/api/sawaa-ai-knowledge-base"

function stateLabel(entry: KnowledgeEntry, t: (key: string) => string) {
  return `${entry.isPublished ? t("sawaaAi.knowledge.published") : t("sawaaAi.knowledge.draft")} · ${t(`sawaaAi.knowledge.index.${entry.status.toLowerCase()}`)}`
}

export function SawaaAiKnowledgeBase() {
  const { t } = useLocale()
  const { canDo } = useAuth()
  const canManage = canDo("setting", "manage")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState<KnowledgeInput>({ title: "", content: "", sourceType: "manual" })
  const [error, setError] = useState<string | null>(null)
  const query = useSawaaAiKnowledge()
  const detail = useSawaaAiKnowledgeDetail(selectedId)
  const mutations = useSawaaAiKnowledgeMutations()
  const entries = query.data?.pages.flatMap((page) => page.data) ?? []
  const selected = detail.data ?? null

  useEffect(() => {
    if (!selected) return
    /* eslint-disable react-hooks/set-state-in-effect */
    setForm({ title: selected.title, content: selected.content ?? "", sourceType: selected.sourceType, sourceRef: selected.sourceRef ?? undefined })
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [selected])

  const edit = (entry: KnowledgeEntry) => setSelectedId(entry.id)
  const reset = () => { setSelectedId(null); setForm({ title: "", content: "", sourceType: "manual" }) }
  const submit = async () => {
    setError(null)
    try {
      if (selectedId) await mutations.update.mutateAsync({ id: selectedId, input: form })
      else await mutations.create.mutateAsync(form)
      reset(); await query.refetch()
    } catch { setError(t("sawaaAi.knowledge.saveFailed")) }
  }
  const action = async (fn: () => Promise<unknown>) => { setError(null); try { await fn(); await query.refetch() } catch { setError(t("sawaaAi.knowledge.actionFailed")) } }

  return <div className="space-y-4" data-testid="sawaa-ai-knowledge-base">
    <Card>
      <CardHeader><CardTitle>{t("sawaaAi.knowledge.title")}</CardTitle><p className="text-sm text-muted-foreground">{t("sawaaAi.knowledge.description")}</p></CardHeader>
      <CardContent className="space-y-4">
        {error && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
        {canManage && <div className="grid gap-3 rounded-lg border border-border/70 p-4">
          <div className="space-y-2"><Label htmlFor="knowledge-title">{t("sawaaAi.knowledge.titleField")}</Label><Input id="knowledge-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="knowledge-content">{t("sawaaAi.knowledge.contentField")}</Label><Textarea id="knowledge-content" rows={4} value={form.content ?? ""} onChange={(e) => setForm({ ...form, content: e.target.value })} /></div>
          <div className="flex gap-2"><Button type="button" onClick={() => void submit()} disabled={mutations.create.isPending || mutations.update.isPending || !form.title.trim() || !form.content?.trim() || (Boolean(selectedId) && detail.isLoading)}>{selectedId ? t("sawaaAi.knowledge.update") : t("sawaaAi.knowledge.create")}</Button>{selectedId && <Button type="button" variant="outline" onClick={reset}>{t("common.cancel")}</Button>}</div>
        </div>}
        {query.isLoading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
        {query.isError && <div role="alert" className="flex items-center justify-between gap-3 text-sm text-destructive"><span>{t("sawaaAi.knowledge.loadFailed")}</span><Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>{t("common.retry")}</Button></div>}
        {!query.isLoading && !query.isError && entries.length === 0 && <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{t("sawaaAi.knowledge.empty")}</p>}
        <div className="space-y-2">{entries.map((entry) => <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 p-3">
          <button type="button" className="min-w-0 text-start" onClick={() => edit(entry)}><span className="block font-medium">{entry.title}</span><span className="text-xs text-muted-foreground">{stateLabel(entry, t)}</span></button>
          <div className="flex flex-wrap gap-2">{canManage && <><Button size="sm" variant="outline" onClick={() => void action(() => entry.isPublished ? mutations.unpublish.mutateAsync(entry.id) : mutations.publish.mutateAsync(entry.id))}>{entry.isPublished ? t("sawaaAi.knowledge.unpublish") : t("sawaaAi.knowledge.publish")}</Button><Button size="sm" variant="outline" onClick={() => void action(() => mutations.reindex.mutateAsync(entry.id))}>{t("sawaaAi.knowledge.reindex")}</Button><Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (window.confirm(t("sawaaAi.knowledge.deleteConfirm"))) void action(() => mutations.remove.mutateAsync(entry.id)) }}>{t("sawaaAi.knowledge.delete")}</Button></>}</div>
        </div>)}</div>
        {query.hasNextPage && <Button type="button" variant="outline" onClick={() => void query.fetchNextPage()} disabled={query.isFetchingNextPage}>{query.isFetchingNextPage ? t("common.loading") : t("sawaaAi.knowledge.loadMore")}</Button>}
        {selectedId && detail.isLoading && <p className="text-sm text-muted-foreground">{t("sawaaAi.knowledge.detailLoading")}</p>}
        {selectedId && detail.isError && <div role="alert" className="flex items-center justify-between gap-3 text-sm text-destructive"><span>{t("sawaaAi.knowledge.detailFailed")}</span><Button type="button" variant="outline" size="sm" onClick={() => void detail.refetch()}>{t("common.retry")}</Button></div>}
        {selected && <div className="rounded-lg bg-muted/40 p-3 text-sm"><p className="font-medium">{t("sawaaAi.knowledge.preview")}</p><p className="mt-2 whitespace-pre-wrap">{(selected.content ?? "").slice(0, 500)}{(selected.content?.length ?? 0) > 500 ? "…" : ""}</p><p className="mt-2 text-xs text-muted-foreground">{t("sawaaAi.knowledge.chunks")}: {selected.chunks?.length ?? 0}</p></div>}
      </CardContent>
    </Card>
  </div>
}

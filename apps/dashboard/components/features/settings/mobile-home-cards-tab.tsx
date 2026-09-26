"use client"

import { useState } from "react"
import Image from "next/image"
import { Button, Card, CardContent, CardHeader, CardTitle } from "@sawaa/ui"
import { Add01Icon, ArrowDown01Icon, ArrowUp01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/locale-provider"
import { useMobileHomeCardMutations } from "@/hooks/use-mobile-home-card-mutations"
import { useMobileHomeCards } from "@/hooks/use-mobile-home-cards"
import { ApiError } from "@/lib/api"
import type { AdminMobileHomeCard } from "@/lib/types/mobile-home-cards"
import { MobileHomeCardEditor } from "./mobile-home-card-editor"

export function MobileHomeCardsTab() {
  const { t, locale } = useLocale()
  const { canDo } = useAuth()
  const canManage = canDo("setting", "update")
  const query = useMobileHomeCards()
  const mutations = useMobileHomeCardMutations()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [reorderConflict, setReorderConflict] = useState(false)
  const [reorderFailed, setReorderFailed] = useState(false)
  const cards = query.data ?? []
  const selectedCard = cards.find((card) => card.id === selectedId) ?? null
  const saving = mutations.create.isPending || mutations.update.isPending || mutations.uploadImage.isPending
  const interactionLocked = saving || mutations.reorder.isPending

  const move = async (index: number, offset: -1 | 1) => {
    const nextIndex = index + offset
    if (!canManage || interactionLocked || nextIndex < 0 || nextIndex >= cards.length) return
    const next = [...cards]
    ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
    try {
      await mutations.reorder.mutateAsync(next.map(({ id, updatedAt }) => ({ id, expectedUpdatedAt: updatedAt })))
      setReorderConflict(false)
      setReorderFailed(false)
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setReorderConflict(true)
        await query.refetch()
      } else {
        setReorderFailed(true)
      }
    }
  }

  const onSaved = (card: AdminMobileHomeCard) => {
    setSelectedId(card.id)
    setCreating(false)
  }

  if (query.isLoading) return <Card><CardContent className="py-8"><p className="text-sm text-muted-foreground">{t("common.loading")}</p></CardContent></Card>
  if (query.isError && !query.data) return <Card><CardContent className="py-8"><div role="alert" className="flex flex-wrap items-center justify-between gap-3 text-sm text-destructive"><span>{t("mobileHomeCards.loadFailed")}</span><Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>{t("common.retry")}</Button></div></CardContent></Card>

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div><CardTitle>{t("mobileHomeCards.title")}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{t("mobileHomeCards.description")}</p></div>
          <Button type="button" onClick={() => { setSelectedId(null); setCreating(true) }} disabled={!canManage || creating || interactionLocked}>
            <HugeiconsIcon icon={Add01Icon} size={16} />{t("mobileHomeCards.add")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {!canManage && <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-muted-foreground">{t("mobileHomeCards.readOnly")}</p>}
          {query.isError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"><span>{t("mobileHomeCards.loadFailed")}</span><Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>{t("common.retry")}</Button></div>}
          {reorderConflict && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{t("mobileHomeCards.conflict")}</p>}
          {reorderFailed && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{t("mobileHomeCards.saveFailed")}</p>}
          {cards.length === 0 ? <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">{t("mobileHomeCards.empty")}</p> : (
            <ol aria-label={t("mobileHomeCards.preview")} className="space-y-2">
              {cards.map((card, index) => {
                const title = locale === "en" ? card.titleEn || card.titleAr : card.titleAr
                const description = locale === "en" ? card.descriptionEn || card.descriptionAr : card.descriptionAr
                const active = selectedId === card.id && !creating
                return (
                  <li key={card.id}>
                    <div className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 ${active ? "border-primary/50 bg-primary/5" : "border-border bg-surface-solid"}`}>
                      <button type="button" onClick={() => { setCreating(false); setSelectedId(card.id) }} disabled={interactionLocked} className="flex min-w-0 flex-1 items-center gap-3 text-start disabled:cursor-not-allowed disabled:opacity-60" aria-pressed={active}>
                        {card.imageUrl && <Image src={card.imageUrl} alt={card.imageAltAr ?? ""} width={112} height={72} unoptimized className="h-16 w-24 shrink-0 rounded-lg object-contain" />}
                        <span className="min-w-0 flex-1"><span className="block truncate font-medium">{title}</span>{description && <span className="mt-1 block truncate text-sm text-muted-foreground">{description}</span>}</span>
                        <span className="rounded-full bg-surface-muted px-2 py-1 text-xs text-muted-foreground">{t(card.isPublished ? "mobileHomeCards.published" : "mobileHomeCards.draft")}</span>
                      </button>
                      <span className="min-w-7 text-center text-sm tabular-nums text-muted-foreground">{index + 1}</span>
                      <div className="flex gap-1">
                        <Button type="button" variant="ghost" size="icon" aria-label={t("mobileHomeCards.moveUp")} onClick={() => void move(index, -1)} disabled={!canManage || index === 0 || interactionLocked}><HugeiconsIcon icon={ArrowUp01Icon} size={16} /></Button>
                        <Button type="button" variant="ghost" size="icon" aria-label={t("mobileHomeCards.moveDown")} onClick={() => void move(index, 1)} disabled={!canManage || index === cards.length - 1 || interactionLocked}><HugeiconsIcon icon={ArrowDown01Icon} size={16} /></Button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      {(creating || selectedCard) && <MobileHomeCardEditor
        key={creating ? "new" : selectedCard?.id}
        card={creating ? null : selectedCard}
        sortOrder={cards.length}
        canManage={canManage}
        saving={saving}
        onCreate={(payload) => mutations.create.mutateAsync(payload)}
        onUpdate={({ id, payload }) => mutations.update.mutateAsync({ id, ...payload })}
        onUpload={(file) => mutations.uploadImage.mutateAsync(file)}
        onConflict={() => query.refetch().then(() => undefined)}
        onSaved={onSaved}
        onCancel={() => { setCreating(false); setSelectedId(null) }}
      />}
    </div>
  )
}

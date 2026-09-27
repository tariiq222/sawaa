"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { Button, Input, Label, Switch, Textarea } from "@sawaa/ui"
import { Image01Icon, Upload01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useLocale } from "@/components/locale-provider"
import type { AdminMobileHomeCard, CreateMobileHomeCardPayload, MobileHomeCardContent, MobileHomeCardDestination, UpdateMobileHomeCardPayload } from "@/lib/types/mobile-home-cards"

interface EditorDraft extends Omit<MobileHomeCardContent, "titleEn" | "descriptionAr" | "descriptionEn" | "imageAltAr" | "imageAltEn"> {
  titleEn: string
  descriptionAr: string
  descriptionEn: string
  imageAltAr: string
  imageAltEn: string
  isPublished: boolean
}

interface Props {
  card: AdminMobileHomeCard | null
  sortOrder: number
  canManage: boolean
  saving: boolean
  onCreate: (payload: CreateMobileHomeCardPayload) => Promise<AdminMobileHomeCard>
  onUpdate: (input: { id: string; payload: UpdateMobileHomeCardPayload }) => Promise<AdminMobileHomeCard>
  onUpload: (file: File) => Promise<{ id: string }>
  onConflict: () => Promise<void>
  onSaved: (card: AdminMobileHomeCard) => void
  onCancel: () => void
}

function draftFrom(card: AdminMobileHomeCard | null): EditorDraft {
  return {
    titleAr: card?.titleAr ?? "",
    titleEn: card?.titleEn ?? "",
    descriptionAr: card?.descriptionAr ?? "",
    descriptionEn: card?.descriptionEn ?? "",
    imageFileId: card?.imageFileId ?? null,
    imageAltAr: card?.imageAltAr ?? "",
    imageAltEn: card?.imageAltEn ?? "",
    destination: card?.destination ?? null,
    isPublished: card?.isPublished ?? false,
  }
}

const destinations: MobileHomeCardDestination[] = ["CLINICS", "SERVICES", "SPECIALISTS", "PACKAGES", "PROGRAMS"]

export function MobileHomeCardEditor({
  card,
  sortOrder,
  canManage,
  saving,
  onCreate,
  onUpdate,
  onUpload,
  onConflict,
  onSaved,
  onCancel,
}: Props) {
  const { t } = useLocale()
  const fileInput = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState(() => draftFrom(card))
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [stagedFileId, setStagedFileId] = useState<string | null>(null)
  const [baseUpdatedAt, setBaseUpdatedAt] = useState(() => card?.updatedAt ?? null)
  const [error, setError] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)

  const set = <K extends keyof EditorDraft>(key: K, value: EditorDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  const removeImage = () => {
    set("imageFileId", null)
    set("imageAltAr", "")
    set("imageAltEn", "")
    setPendingFile(null)
    setStagedFileId(null)
  }

  const save = async () => {
    const titleAr = draft.titleAr.trim()
    if (!titleAr) {
      setError(t("mobileHomeCards.titleRequired"))
      return
    }
    if ((draft.imageFileId || pendingFile || stagedFileId) && !draft.imageAltAr.trim()) {
      setError(t("mobileHomeCards.altRequired"))
      return
    }

    setError(null)
    let imageFileId = draft.imageFileId
    try {
      if (pendingFile) {
        const uploaded = stagedFileId ? { id: stagedFileId } : await onUpload(pendingFile)
        imageFileId = uploaded.id
        setStagedFileId(uploaded.id)
      }
      const content: MobileHomeCardContent = {
        titleAr,
        titleEn: draft.titleEn.trim() || null,
        descriptionAr: draft.descriptionAr.trim() || null,
        descriptionEn: draft.descriptionEn.trim() || null,
        imageFileId,
        imageAltAr: imageFileId ? draft.imageAltAr.trim() || null : null,
        imageAltEn: imageFileId ? draft.imageAltEn.trim() || null : null,
        destination: draft.destination,
      }
      const result = card
        ? await onUpdate({ id: card.id, payload: { ...content, isPublished: draft.isPublished, expectedUpdatedAt: baseUpdatedAt ?? card.updatedAt } })
        : await onCreate({ ...content, isPublished: draft.isPublished, sortOrder })
      setDraft(draftFrom(result))
      setBaseUpdatedAt(result.updatedAt)
      setPendingFile(null)
      setStagedFileId(null)
      onSaved(result)
    } catch (cause) {
      if (cause && typeof cause === "object" && "status" in cause && cause.status === 409 && card) {
        setConflict(true)
        setError(t("mobileHomeCards.conflict"))
        await onConflict()
      } else {
        setError(t("mobileHomeCards.saveFailed"))
      }
    }
  }

  const reloadLatest = () => {
    setDraft(draftFrom(card))
    setBaseUpdatedAt(card?.updatedAt ?? null)
    setPendingFile(null)
    setStagedFileId(null)
    setConflict(false)
    setError(null)
  }

  const imagePresent = Boolean(draft.imageFileId || pendingFile || stagedFileId)

  return (
    <section aria-label={t(card ? "mobileHomeCards.editCard" : "mobileHomeCards.newCard")} className="rounded-xl border border-border bg-surface-solid p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">{t(card ? "mobileHomeCards.editCard" : "mobileHomeCards.newCard")}</h3>
        <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
          <div><Label htmlFor="mobile-card-published">{t("mobileHomeCards.publish")}</Label><p className="text-xs text-muted-foreground">{t(draft.isPublished ? "mobileHomeCards.published" : "mobileHomeCards.draft")}</p></div>
          <Switch id="mobile-card-published" checked={draft.isPublished} onCheckedChange={(value) => set("isPublished", value)} disabled={!canManage || saving} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("mobileHomeCards.titleAr")} id="mobile-card-title-ar" value={draft.titleAr} maxLength={100} disabled={!canManage || saving} onChange={(value) => set("titleAr", value)} />
        <Field label={t("mobileHomeCards.titleEn")} id="mobile-card-title-en" value={draft.titleEn ?? ""} maxLength={100} disabled={!canManage || saving} onChange={(value) => set("titleEn", value)} />
        <TextField label={t("mobileHomeCards.descriptionAr")} id="mobile-card-description-ar" value={draft.descriptionAr ?? ""} maxLength={240} disabled={!canManage || saving} onChange={(value) => set("descriptionAr", value)} />
        <TextField label={t("mobileHomeCards.descriptionEn")} id="mobile-card-description-en" value={draft.descriptionEn ?? ""} maxLength={240} disabled={!canManage || saving} onChange={(value) => set("descriptionEn", value)} />
      </div>

      <div className="mt-4 space-y-3 rounded-lg border border-border/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2"><HugeiconsIcon icon={Image01Icon} size={18} /><span className="text-sm font-medium">{t("mobileHomeCards.image")}</span></div>
          <span className="text-xs text-muted-foreground">{t("mobileHomeCards.imagePublicHint")}</span>
        </div>
        {card?.imageUrl && draft.imageFileId && !pendingFile && <Image src={card.imageUrl} alt={draft.imageAltAr || ""} width={640} height={320} unoptimized className="max-h-40 max-w-full rounded-lg object-contain" />}
        {pendingFile && <p className="text-sm text-muted-foreground">{pendingFile.name}</p>}
        <input ref={fileInput} type="file" accept="image/*" className="sr-only" onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) { setPendingFile(file); setStagedFileId(null); set("imageFileId", null) }
        }} />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()} disabled={!canManage || saving}><HugeiconsIcon icon={Upload01Icon} size={16} />{t("mobileHomeCards.chooseImage")}</Button>
          {imagePresent && <Button type="button" variant="outline" size="sm" onClick={removeImage} disabled={!canManage || saving}>{t("mobileHomeCards.removeImage")}</Button>}
        </div>
        {imagePresent && <div className="grid gap-4 md:grid-cols-2"><Field label={t("mobileHomeCards.imageAltAr")} id="mobile-card-alt-ar" value={draft.imageAltAr ?? ""} maxLength={240} disabled={!canManage || saving} onChange={(value) => set("imageAltAr", value)} /><Field label={t("mobileHomeCards.imageAltEn")} id="mobile-card-alt-en" value={draft.imageAltEn ?? ""} maxLength={240} disabled={!canManage || saving} onChange={(value) => set("imageAltEn", value)} /></div>}
      </div>

      <div className="mt-4 max-w-md space-y-2">
        <Label htmlFor="mobile-card-destination">{t("mobileHomeCards.destination")}</Label>
        <select id="mobile-card-destination" value={draft.destination ?? "none"} disabled={!canManage || saving} onChange={(event) => set("destination", event.target.value === "none" ? null : event.target.value as MobileHomeCardDestination)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
          <option value="none">{t("mobileHomeCards.noDestination")}</option>
          {destinations.map((destination) => <option key={destination} value={destination}>{t(`mobileHomeCards.destination.${destination.toLowerCase()}`)}</option>)}
        </select>
      </div>

      {error && <p role="alert" className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      {conflict && <Button type="button" variant="outline" className="mt-3" onClick={reloadLatest} disabled={!canManage}>{t("mobileHomeCards.reloadLatest")}</Button>}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>{t("mobileHomeCards.cancel")}</Button>
        {canManage && <Button type="button" onClick={() => void save()} disabled={saving || conflict}>{t("mobileHomeCards.save")}</Button>}
      </div>
    </section>
  )
}

function Field({ label, id, value, maxLength, disabled, onChange }: { label: string; id: string; value: string; maxLength: number; disabled: boolean; onChange: (value: string) => void }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} value={value} maxLength={maxLength} disabled={disabled} onChange={(event) => onChange(event.target.value)} /></div>
}

function TextField({ label, id, value, maxLength, disabled, onChange }: { label: string; id: string; value: string; maxLength: number; disabled: boolean; onChange: (value: string) => void }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Textarea id={id} value={value} maxLength={maxLength} disabled={disabled} rows={3} onChange={(event) => onChange(event.target.value)} /></div>
}

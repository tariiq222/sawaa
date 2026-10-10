"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Badge, Button, AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@sawaa/ui"
import { usePackageFamilyMutations } from "@/hooks/use-package-families"
import { formatPrice } from "@/lib/money"
import type { PackageFamily } from "@sawaa/shared/types"

export function PackageFamilyCard({ family, locale, onEdit, canArchive, t }: { family: PackageFamily; locale: "ar" | "en"; onEdit?: () => void; canArchive: boolean; t: (key: string) => string }) {
  const [open, setOpen] = useState(false)
  const { archiveMut } = usePackageFamilyMutations()
  const label = locale === "ar" ? family.nameAr : (family.nameEn || family.nameAr)
  return <article className="flex flex-col gap-3 rounded-xl border border-border bg-surface-solid p-4 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="font-semibold">{label}</h3>
      <div className="flex gap-2"><Badge variant="outline">{t(family.isActive ? "packages.status.active" : "packages.status.inactive")}</Badge><Badge variant="outline">{t(family.isPublic ? "catalog.visible" : "catalog.hidden")}</Badge></div>
    </div>
    <ul className="flex flex-col gap-2 text-sm">
      {family.options.map(option => <li key={option.id} className="flex flex-wrap justify-between gap-2">
        <span>{locale === "ar" ? option.nameAr : (option.nameEn || option.nameAr)} · {option.sessionCount} {t("packages.summary.sessions")}</span>
        <span className="tabular-nums">{formatPrice(option.price.finalPrice, {locale})} {t("catalog.currencySar")} · {t(option.isActive ? "packages.status.active" : "packages.status.inactive")}</span>
      </li>)}
    </ul>
    <div className="flex justify-end gap-2">
      {onEdit && <Button variant="outline" size="sm" onClick={onEdit}>{t("packages.family.list.edit")}</Button>}
      {canArchive && <Button variant="outline" size="sm" onClick={() => setOpen(true)}>{t("catalog.familyArchive")}</Button>}
    </div>
    <AlertDialog open={open} onOpenChange={setOpen}><AlertDialogContent>
      <AlertDialogHeader><AlertDialogTitle>{t("catalog.familyArchive")}</AlertDialogTitle><AlertDialogDescription>{t("catalog.familyArchiveDescription").replace("{name}", label)}</AlertDialogDescription></AlertDialogHeader>
      <AlertDialogFooter><AlertDialogCancel disabled={archiveMut.isPending}>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction disabled={archiveMut.isPending} onClick={async event => {
        event.preventDefault()
        try { await archiveMut.mutateAsync(family.id); toast.success(t("catalog.familyArchived")); setOpen(false) }
        catch { toast.error(t("catalog.familyArchiveError")) }
      }}>{archiveMut.isPending ? t("common.loading") : t("catalog.familyArchive")}</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent></AlertDialog>
  </article>
}

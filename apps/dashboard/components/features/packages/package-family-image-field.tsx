"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { Button, Input, Label } from "@sawaa/ui"
import { toast } from "sonner"
import { useLocale } from "@/components/locale-provider"
import { uploadPackageFamilyImage } from "@/lib/api/package-families"

export function PackageFamilyImageField({ value, onChange, busy, onBusyChange }: { value?: string | null; onChange: (key: string | null) => void; busy: boolean; onBusyChange: (value: boolean) => void }) {
  const { t } = useLocale()
  const uploading = useRef(false)
  const [preview, setPreview] = useState<string | null>(null)
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])
  return <div className="flex flex-col gap-2">
    <Label htmlFor="family-image">{t("catalog.familyImage")}</Label>
    {value && <Image src={preview ?? value} alt={t("catalog.familyImage")} width={96} height={96} unoptimized className="rounded-xl object-cover" />}
    <Input id="family-image" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={async (event) => {
      const file = event.target.files?.[0]
      if (!file || uploading.current) return
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { toast.error(t("catalog.imageInvalid")); event.target.value = ""; return }
      uploading.current = true
      onBusyChange(true)
      try { const key = await uploadPackageFamilyImage(file); setPreview(URL.createObjectURL(file)); onChange(key) }
      catch { toast.error(t("catalog.imageError")) }
      finally { uploading.current = false; onBusyChange(false) }
    }} />
    {busy && <p aria-live="polite" className="text-sm text-muted-foreground">{t("catalog.imageUploading")}</p>}
    {value && <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => { setPreview(null); onChange(null) }}>{t("catalog.imageRemove")}</Button>}
  </div>
}

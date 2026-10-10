"use client"

import { useState, useEffect, useRef, startTransition } from "react"
import { useEmployeeMutations } from "@/hooks/use-employee-mutations"
import { AvatarUpload, Card, CardContent } from "@sawaa/ui"
import { toast } from "sonner"
import { Label } from "@sawaa/ui"
import { Input } from "@sawaa/ui"
import { Textarea } from "@sawaa/ui"
import { Button } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import type { Employee, UpdateEmployeePayload } from "@/lib/types/employee"

interface Props {
  employee: Employee
}

function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function PublicProfileTab({ employee }: Props) {
  const { t } = useLocale()
  const { updateMutation, uploadPublicImageMutation } = useEmployeeMutations()
  const [isSaving, setIsSaving] = useState(false)
  const [image, setImage] = useState({ value: employee.publicImageUrl ?? "", file: undefined as File | undefined, clear: false })
  const previewRef = useRef<string | undefined>(undefined)
  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current) }, [])

  const [form, setForm] = useState({
    slug: employee.slug ?? "",
    publicBioAr: employee.publicBioAr ?? "",
    publicBioEn: employee.publicBioEn ?? "",
  })

  useEffect(() => {
    const seed = `${employee.user.firstName} ${employee.user.lastName}`.trim()
    if (!form.slug && seed) startTransition(() => setForm((f) => ({ ...f, slug: slugify(seed) })))
  }, [employee.user.firstName, employee.user.lastName, form.slug])

  const replacePreview = (value: string, file?: File, clear = false) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = value.startsWith("blob:") ? value : undefined
    setImage({ value, file, clear })
  }

  const save = async () => {
    if (isSaving) return
    setIsSaving(true)
    try {
      if (image.file) {
        const uploaded = await uploadPublicImageMutation.mutateAsync({ id: employee.id, file: image.file })
        replacePreview(uploaded.url)
      }
      const payload: UpdateEmployeePayload = {
        slug: form.slug || null,
        publicBioAr: form.publicBioAr || null,
        publicBioEn: form.publicBioEn || null,
        ...(image.clear ? { publicImageUrl: null } : {}),
      }
      await updateMutation.mutateAsync({ id: employee.id, ...payload })
      toast.success(t("employees.public.saved"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("employees.public.saveError"))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>{t("employees.public.slug")}</Label>
            <Input
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
              placeholder="dr-khalid"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("employees.public.imageUrl")}</Label>
            <AvatarUpload
              key={image.value}
              value={image.value || undefined}
              onChange={(file, preview) => replacePreview(preview, file)}
              onClear={() => replacePreview("", undefined, true)}
              uploadAriaLabel={t("employees.public.imageUrl")}
              addAriaLabel={t("employees.public.imageUrl")}
              clearAriaLabel={t("employees.public.removeImage")}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>{t("employees.public.bioAr")}</Label>
          <Textarea
            rows={4}
            value={form.publicBioAr}
            onChange={(e) => setForm((f) => ({ ...f, publicBioAr: e.target.value }))}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>{t("employees.public.bioEn")}</Label>
          <Textarea
            rows={4}
            value={form.publicBioEn}
            onChange={(e) => setForm((f) => ({ ...f, publicBioEn: e.target.value }))}
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={isSaving || updateMutation.isPending || uploadPublicImageMutation.isPending}>
            {isSaving ? t("employees.public.saving") : t("employees.public.save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

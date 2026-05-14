"use client"

import { useState, useEffect, startTransition } from "react"
import { useEmployeeMutations } from "@/hooks/use-employee-mutations"
import { Card, CardContent } from "@deqah/ui"
import { Label } from "@deqah/ui"
import { Input } from "@deqah/ui"
import { Textarea } from "@deqah/ui"
import { Switch } from "@deqah/ui"
import { Button } from "@deqah/ui"
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
  const { updateMutation } = useEmployeeMutations()

  const [form, setForm] = useState({
    isPublic: employee.isPublic ?? false,
    slug: employee.slug ?? "",
    publicBioAr: employee.publicBioAr ?? "",
    publicBioEn: employee.publicBioEn ?? "",
    publicImageUrl: employee.publicImageUrl ?? "",
  })

  useEffect(() => {
    const seed = `${employee.user.firstName} ${employee.user.lastName}`.trim()
    if (!form.slug && seed) startTransition(() => setForm((f) => ({ ...f, slug: slugify(seed) })))
  }, [employee.user.firstName, employee.user.lastName, form.slug])

  const save = async () => {
    const payload: UpdateEmployeePayload = {
      isPublic: form.isPublic,
      slug: form.slug || null,
      publicBioAr: form.publicBioAr || null,
      publicBioEn: form.publicBioEn || null,
      publicImageUrl: form.publicImageUrl || null,
    }
    await updateMutation.mutateAsync({ id: employee.id, ...payload })
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base font-semibold">
              {t("employees.public.showInDirectory")}
            </Label>
            <p className="text-sm text-muted-foreground">
              {t("employees.public.showDirectoryDesc")}
            </p>
          </div>
          <Switch
            checked={form.isPublic}
            onCheckedChange={(v) => setForm((f) => ({ ...f, isPublic: v }))}
          />
        </div>

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
            <Input
              value={form.publicImageUrl}
              onChange={(e) => setForm((f) => ({ ...f, publicImageUrl: e.target.value }))}
              placeholder="https://..."
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
          <Button onClick={save} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? t("employees.public.saving") : t("employees.public.save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

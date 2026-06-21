"use client"

import { useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { useLocale } from "@/components/locale-provider"
import { useGroupProgramMutations } from "@/hooks/use-group-programs"
import { useDepartmentOptions } from "@/hooks/use-departments"
import { createGroupProgramSchema } from "@/lib/schemas/group-program.schema"
import type { CreateGroupProgramFormData } from "@/lib/schemas/group-program.schema"
import { FormSection, FormField } from "@/components/features/shared/form-section"
import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import {
  Input,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  Switch,
  Label,
} from "@sawaa/ui"

export function GroupProgramFormPage() {
  const { t } = useLocale()
  const router = useRouter()
  const { createMut } = useGroupProgramMutations()
  const { options: departments } = useDepartmentOptions()

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateGroupProgramFormData>({
    resolver: zodResolver(createGroupProgramSchema),
    defaultValues: {
      nameAr: "",
      nameEn: "",
      departmentId: "",
      minParticipants: 1,
      maxParticipants: 30,
      defaultPriceInSar: 0,
      isActive: true,
      descriptionAr: "",
      descriptionEn: "",
    },
  })

  const onSubmit = handleSubmit(async (data: CreateGroupProgramFormData) => {
    const payload = {
      nameAr: data.nameAr,
      nameEn: data.nameEn || undefined,
      departmentId: data.departmentId,
      minParticipants: data.minParticipants,
      maxParticipants: data.maxParticipants,
      defaultPrice: Math.round(data.defaultPriceInSar * 100),
      descriptionAr: data.descriptionAr || undefined,
      descriptionEn: data.descriptionEn || undefined,
    }
    try {
      await createMut.mutateAsync(payload)
      toast.success(t("groupPrograms.create.submit"))
      router.push("/group-programs")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("groupPrograms.create.title"))
    }
  })

  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader
        title={t("groupPrograms.create.title")}
        description={t("groupPrograms.create.pageDescription")}
      />

      <form onSubmit={onSubmit} className="flex flex-col gap-6 pb-24">
        <FormSection title={t("groupPrograms.section.basics")}>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label={t("groupPrograms.form.nameAr")} error={errors.nameAr?.message as string}>
                <Input {...register("nameAr")} />
              </FormField>
              <FormField label={t("groupPrograms.form.nameEn")} error={errors.nameEn?.message as string}>
                <Input {...register("nameEn")} dir="ltr" />
              </FormField>
            </div>
            <FormField label={t("groupPrograms.form.department")} error={errors.departmentId?.message as string}>
              <Controller control={control} name="departmentId" render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue placeholder={t("groupPrograms.form.selectDepartment")} /></SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>{dept.nameAr || dept.nameEn}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )} />
            </FormField>
          </div>
        </FormSection>

        <FormSection title={t("groupPrograms.section.capacityPrice")}>
          <div className="grid grid-cols-3 gap-4">
            <FormField label={t("groupPrograms.form.minParticipants")} error={errors.minParticipants?.message as string}>
              <Input type="number" min={1} className="tabular-nums" {...register("minParticipants")} />
            </FormField>
            <FormField label={t("groupPrograms.form.maxParticipants")} error={errors.maxParticipants?.message as string}>
              <Input type="number" min={1} className="tabular-nums" {...register("maxParticipants")} />
            </FormField>
            <FormField label={t("groupPrograms.form.defaultPrice")} error={errors.defaultPriceInSar?.message as string}>
              <Input type="number" min={0} step="0.01" className="tabular-nums" {...register("defaultPriceInSar")} />
            </FormField>
          </div>
        </FormSection>

        <FormSection title={t("groupPrograms.section.details")}>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label={t("groupPrograms.form.descriptionAr")}><Textarea rows={2} {...register("descriptionAr")} /></FormField>
              <FormField label={t("groupPrograms.form.descriptionEn")}><Textarea rows={2} dir="ltr" {...register("descriptionEn")} /></FormField>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/40 px-4 py-3">
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="gp-active" className="cursor-pointer">{t("groupPrograms.form.isActive")}</Label>
                <p className="text-xs text-muted-foreground">{t("groupPrograms.form.isActiveHint")}</p>
              </div>
              <Controller control={control} name="isActive" render={({ field }) => (
                <Switch id="gp-active" checked={field.value ?? true} onCheckedChange={field.onChange} />
              )} />
            </div>
          </div>
        </FormSection>

        <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-6 border-t border-border bg-background px-4 sm:px-6 py-3 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" size="lg" className="rounded-lg" onClick={() => router.push("/group-programs")}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" size="lg" className="rounded-lg" disabled={createMut.isPending}>
            {createMut.isPending ? t("groupPrograms.create.submitting") : t("groupPrograms.create.submit")}
          </Button>
        </div>
      </form>
    </ListPageShell>
  )
}

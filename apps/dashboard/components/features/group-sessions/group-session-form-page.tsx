"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { useLocale } from "@/components/locale-provider"
import { useGroupSessionMutations } from "@/hooks/use-group-sessions"
import { useEmployees } from "@/hooks/use-employees"
import { useServices } from "@/hooks/use-services"
import { useBranches } from "@/hooks/use-branches"
import { createGroupSessionSchema } from "@/lib/schemas/group-session.schema"
import type { CreateGroupSessionFormData } from "@/lib/schemas/group-session.schema"
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
  DateTimeInput,
} from "@sawaa/ui"

export function GroupSessionFormPage() {
  const { t } = useLocale()
  const router = useRouter()
  const { createMut } = useGroupSessionMutations()
  const { employees } = useEmployees()
  const { services } = useServices()
  const { branches } = useBranches()

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<CreateGroupSessionFormData>({
    resolver: zodResolver(createGroupSessionSchema),
    defaultValues: {
      branchId: "",
      employeeId: "",
      serviceId: "",
      title: "",
      scheduledAt: "",
      durationMins: 60,
      maxCapacity: 10,
      priceInSar: 0,
      deliveryType: "IN_PERSON",
      isPublic: false,
      descriptionAr: "",
      descriptionEn: "",
      publicDescriptionAr: "",
      publicDescriptionEn: "",
    },
  })

  useEffect(() => {
    if (branches && branches.length > 0 && !getValues("branchId")) {
      setValue("branchId", branches[0].id)
    }
  }, [branches, getValues, setValue])

  const isPublic = watch("isPublic")
  const branchReady = !!watch("branchId")

  const onSubmit = handleSubmit(async (data: CreateGroupSessionFormData) => {
    const payload = {
      branchId: data.branchId,
      employeeId: data.employeeId,
      serviceId: data.serviceId,
      title: data.title,
      scheduledAt: new Date(data.scheduledAt).toISOString(),
      durationMins: data.durationMins,
      maxCapacity: data.maxCapacity,
      price: Math.round(data.priceInSar * 100),
      deliveryType: data.deliveryType,
      isPublic: data.isPublic,
      descriptionAr: data.descriptionAr || undefined,
      descriptionEn: data.descriptionEn || undefined,
      publicDescriptionAr: data.publicDescriptionAr || undefined,
      publicDescriptionEn: data.publicDescriptionEn || undefined,
    }
    try {
      await createMut.mutateAsync(payload)
      toast.success(t("groupSessions.create.submit"))
      router.push("/group-sessions")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("groupSessions.create.title"))
    }
  })

  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader
        title={t("groupSessions.create.title")}
        description={t("groupSessions.create.pageDescription")}
      />

      <form onSubmit={onSubmit} className="flex flex-col gap-6 pb-24">
        <FormSection title={t("groupSessions.section.basics")}>
          <div className="flex flex-col gap-4">
            <FormField label={t("groupSessions.form.employee")} error={errors.employeeId?.message as string}>
              <Controller control={control} name="employeeId" render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue placeholder={t("groupSessions.form.selectEmployee")} /></SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.user.firstName} {emp.user.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )} />
            </FormField>
            <FormField label={t("groupSessions.form.service")} error={errors.serviceId?.message as string}>
              <Controller control={control} name="serviceId" render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue placeholder={t("groupSessions.form.selectService")} /></SelectTrigger>
                  <SelectContent>
                    {services.map((svc) => (
                      <SelectItem key={svc.id} value={svc.id}>{svc.nameAr}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )} />
            </FormField>
            <FormField label={t("groupSessions.form.title")} error={errors.title?.message as string}>
              <Input {...register("title")} />
            </FormField>
          </div>
        </FormSection>

        <FormSection title={t("groupSessions.section.schedule")}>
          <div className="grid grid-cols-[1fr_auto] gap-4">
            <FormField label={t("groupSessions.form.scheduledAt")} error={errors.scheduledAt?.message as string}>
              <Controller control={control} name="scheduledAt" render={({ field }) => (
                <DateTimeInput value={field.value ?? ""} onChange={field.onChange} error={!!errors.scheduledAt} />
              )} />
            </FormField>
            <FormField label={t("groupSessions.form.durationMins")} error={errors.durationMins?.message as string}>
              <Input type="number" min={1} className="w-32 tabular-nums" {...register("durationMins")} />
            </FormField>
          </div>
        </FormSection>

        <FormSection title={t("groupSessions.section.capacityPrice")}>
          <div className="grid grid-cols-3 gap-4">
            <FormField label={t("groupSessions.form.maxCapacity")} error={errors.maxCapacity?.message as string}>
              <Input type="number" min={1} className="tabular-nums" {...register("maxCapacity")} />
            </FormField>
            <FormField label={t("groupSessions.form.price")} error={errors.priceInSar?.message as string}>
              <Input type="number" min={0} step="0.01" className="tabular-nums" {...register("priceInSar")} />
            </FormField>
            <FormField label={t("groupSessions.form.deliveryType")}>
              <Controller control={control} name="deliveryType" render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IN_PERSON">{t("groupSessions.deliveryType.inPerson")}</SelectItem>
                    <SelectItem value="ONLINE">{t("groupSessions.deliveryType.online")}</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </FormField>
          </div>
        </FormSection>

        <FormSection title={t("groupSessions.section.details")}>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label={t("groupSessions.form.descriptionAr")}><Textarea rows={2} {...register("descriptionAr")} /></FormField>
              <FormField label={t("groupSessions.form.descriptionEn")}><Textarea rows={2} {...register("descriptionEn")} /></FormField>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/40 px-4 py-3">
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="gs-public" className="cursor-pointer">{t("groupSessions.form.isPublic")}</Label>
                <p className="text-xs text-muted-foreground">{t("groupSessions.form.isPublicHint")}</p>
              </div>
              <Controller control={control} name="isPublic" render={({ field }) => (
                <Switch id="gs-public" checked={field.value ?? false} onCheckedChange={field.onChange} />
              )} />
            </div>
            <div
              className="grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none"
              style={{ gridTemplateRows: isPublic ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden">
                <div className="grid grid-cols-2 gap-4 pt-1">
                  <FormField label={t("groupSessions.form.publicDescriptionAr")}><Textarea rows={2} {...register("publicDescriptionAr")} /></FormField>
                  <FormField label={t("groupSessions.form.publicDescriptionEn")}><Textarea rows={2} {...register("publicDescriptionEn")} /></FormField>
                </div>
              </div>
            </div>
          </div>
        </FormSection>

        <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-6 border-t border-border bg-background px-4 sm:px-6 py-3 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {!branchReady && (
            <p className="text-xs text-muted-foreground sm:me-auto">{t("groupSessions.create.branchLoading")}</p>
          )}
          <Button type="button" variant="ghost" size="lg" className="rounded-lg" onClick={() => router.push("/group-sessions")}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" size="lg" className="rounded-lg" disabled={createMut.isPending || !branchReady}>
            {createMut.isPending ? t("groupSessions.create.submitting") : t("groupSessions.create.submit")}
          </Button>
        </div>
      </form>
    </ListPageShell>
  )
}

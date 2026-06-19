"use client"

import type { ReactNode } from "react"
import { useEffect } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useLocale } from "@/components/locale-provider"
import { useGroupSessionMutations } from "@/hooks/use-group-sessions"
import { useEmployees } from "@/hooks/use-employees"
import { useServices } from "@/hooks/use-services"
import { useBranches } from "@/hooks/use-branches"
import { createGroupSessionSchema } from "@/lib/schemas/group-session.schema"
import type { CreateGroupSessionFormData } from "@/lib/schemas/group-session.schema"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateGroupSessionDialog({ open, onOpenChange }: Props) {
  const { t } = useLocale()
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
    reset,
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

  const onSubmit = async (data: CreateGroupSessionFormData) => {
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
    createMut.mutate(payload, {
      onSuccess: () => {
        reset()
        onOpenChange(false)
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("groupSessions.create.title")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-8">
          <section className="flex flex-col gap-4">
            <SectionHeader>{t("groupSessions.section.basics")}</SectionHeader>

            <Field label={t("groupSessions.form.employee")} error={errors.employeeId?.message as string}>
              <Controller
                control={control}
                name="employeeId"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("groupSessions.form.selectEmployee")} />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.user.firstName} {emp.user.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field label={t("groupSessions.form.service")} error={errors.serviceId?.message as string}>
              <Controller
                control={control}
                name="serviceId"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("groupSessions.form.selectService")} />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map((svc) => (
                        <SelectItem key={svc.id} value={svc.id}>
                          {svc.nameAr}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field label={t("groupSessions.form.title")} error={errors.title?.message as string}>
              <Input {...register("title")} />
            </Field>
          </section>

          <section className="flex flex-col gap-4">
            <SectionHeader>{t("groupSessions.section.schedule")}</SectionHeader>

            <div className="grid grid-cols-[1fr_auto] gap-4">
              <Field label={t("groupSessions.form.scheduledAt")} error={errors.scheduledAt?.message as string}>
                <Controller
                  control={control}
                  name="scheduledAt"
                  render={({ field }) => (
                    <DateTimeInput
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      error={!!errors.scheduledAt}
                    />
                  )}
                />
              </Field>
              <Field label={t("groupSessions.form.durationMins")} error={errors.durationMins?.message as string}>
                <Input type="number" min={1} className="w-32 tabular-nums" {...register("durationMins")} />
              </Field>
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <SectionHeader>{t("groupSessions.section.capacityPrice")}</SectionHeader>

            <div className="grid grid-cols-3 gap-4">
              <Field label={t("groupSessions.form.maxCapacity")} error={errors.maxCapacity?.message as string}>
                <Input type="number" min={1} className="tabular-nums" {...register("maxCapacity")} />
              </Field>
              <Field label={t("groupSessions.form.price")} error={errors.priceInSar?.message as string}>
                <Input type="number" min={0} step="0.01" className="tabular-nums" {...register("priceInSar")} />
              </Field>
              <Field label={t("groupSessions.form.deliveryType")}>
                <Controller
                  control={control}
                  name="deliveryType"
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="IN_PERSON">{t("groupSessions.deliveryType.inPerson")}</SelectItem>
                        <SelectItem value="ONLINE">{t("groupSessions.deliveryType.online")}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <SectionHeader>{t("groupSessions.section.details")}</SectionHeader>

            <div className="grid grid-cols-2 gap-4">
              <Field label={t("groupSessions.form.descriptionAr")}>
                <Textarea rows={2} {...register("descriptionAr")} />
              </Field>
              <Field label={t("groupSessions.form.descriptionEn")}>
                <Textarea rows={2} {...register("descriptionEn")} />
              </Field>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/40 px-4 py-3">
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="gs-public" className="cursor-pointer">
                  {t("groupSessions.form.isPublic")}
                </Label>
                <p className="text-xs text-muted-foreground">{t("groupSessions.form.isPublicHint")}</p>
              </div>
              <Controller
                control={control}
                name="isPublic"
                render={({ field }) => (
                  <Switch id="gs-public" checked={field.value ?? false} onCheckedChange={field.onChange} />
                )}
              />
            </div>

            <div
              className="grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none"
              style={{ gridTemplateRows: isPublic ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden">
                <div className="grid grid-cols-2 gap-4 pt-1">
                  <Field label={t("groupSessions.form.publicDescriptionAr")}>
                    <Textarea rows={2} {...register("publicDescriptionAr")} />
                  </Field>
                  <Field label={t("groupSessions.form.publicDescriptionEn")}>
                    <Textarea rows={2} {...register("publicDescriptionEn")} />
                  </Field>
                </div>
              </div>
            </div>
          </section>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={createMut.isPending}>
              {createMut.isPending ? t("groupSessions.create.submitting") : t("groupSessions.create.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{children}</h3>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

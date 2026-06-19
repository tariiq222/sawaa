"use client"

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
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Employee */}
          <div className="flex flex-col gap-1.5">
            <Label>{t("groupSessions.form.employee")}</Label>
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
            {errors.employeeId && (
              <p className="text-xs text-destructive">{errors.employeeId.message as string}</p>
            )}
          </div>

          {/* Service */}
          <div className="flex flex-col gap-1.5">
            <Label>{t("groupSessions.form.service")}</Label>
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
            {errors.serviceId && (
              <p className="text-xs text-destructive">{errors.serviceId.message as string}</p>
            )}
          </div>

          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <Label>{t("groupSessions.form.title")}</Label>
            <Input {...register("title")} />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title.message as string}</p>
            )}
          </div>

          {/* scheduledAt */}
          <div className="flex flex-col gap-1.5">
            <Label>{t("groupSessions.form.scheduledAt")}</Label>
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
            {errors.scheduledAt && (
              <p className="text-xs text-destructive">{errors.scheduledAt.message as string}</p>
            )}
          </div>

          {/* durationMins + maxCapacity */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>{t("groupSessions.form.durationMins")}</Label>
              <Input type="number" min={1} {...register("durationMins")} />
              {errors.durationMins && (
                <p className="text-xs text-destructive">{errors.durationMins.message as string}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("groupSessions.form.maxCapacity")}</Label>
              <Input type="number" min={1} {...register("maxCapacity")} />
              {errors.maxCapacity && (
                <p className="text-xs text-destructive">{errors.maxCapacity.message as string}</p>
              )}
            </div>
          </div>

          {/* price + deliveryType */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>{t("groupSessions.form.price")}</Label>
              <Input type="number" min={0} step="0.01" {...register("priceInSar")} />
              {errors.priceInSar && (
                <p className="text-xs text-destructive">{errors.priceInSar.message as string}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("groupSessions.form.deliveryType")}</Label>
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
            </div>
          </div>

          {/* isPublic switch */}
          <div className="flex items-center gap-3">
            <Controller
              control={control}
              name="isPublic"
              render={({ field }) => (
                <Switch
                  checked={field.value ?? false}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Label className="cursor-pointer">{t("groupSessions.form.isPublic")}</Label>
          </div>

          {/* Descriptions */}
          <div className="flex flex-col gap-1.5">
            <Label>{t("groupSessions.form.descriptionAr")}</Label>
            <Textarea rows={2} {...register("descriptionAr")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("groupSessions.form.descriptionEn")}</Label>
            <Textarea rows={2} {...register("descriptionEn")} />
          </div>

          {/* Public descriptions (only when isPublic=true) */}
          {isPublic && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label>{t("groupSessions.form.publicDescriptionAr")}</Label>
                <Textarea rows={2} {...register("publicDescriptionAr")} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("groupSessions.form.publicDescriptionEn")}</Label>
                <Textarea rows={2} {...register("publicDescriptionEn")} />
              </div>
            </>
          )}

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

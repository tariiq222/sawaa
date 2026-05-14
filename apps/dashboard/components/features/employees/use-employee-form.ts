import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { UseFormReturn } from "react-hook-form"
import type { CreateEmployeeFormData } from "@/components/features/employees/create/form-schema"
import type { LocalBreak, LocalVacation } from "@/components/features/employees/create/schedule-tab"
import type { DraftService } from "@/components/features/employees/create/services-tab"
import type { AvailabilitySlot, EmployeeService } from "@/lib/types/employee"
import {
  assignService,
} from "@/lib/api/employees"
import {
  useEmployeeMutations,
  useSetAvailability,
  useSetBreaks,
  useVacationMutations,
  useEmployeeServiceMutations,
} from "@/hooks/use-employees"
import { useLocale } from "@/components/locale-provider"
import { z } from "zod"
import { createEmployeeSchemaStatic } from "@/components/features/employees/create/form-schema"

const _editEmployeeSchema = createEmployeeSchemaStatic.partial().extend({
  isActive: z.boolean(),
})
type EditEmployeeFormData = z.infer<typeof _editEmployeeSchema>

const defaultSchedule: AvailabilitySlot[] = Array.from({ length: 7 }, (_, i) => ({
  dayOfWeek: i, startTime: "09:00", endTime: "17:00", isActive: i <= 4,
}))

interface UseEmployeeFormOptions {
  isEdit: boolean
  employeeId: string | undefined
  employee: { user: { firstName: string; lastName: string }; title?: string | null; nameAr?: string | null; specialty?: string | null; specialtyAr?: string | null; bio?: string | null; bioAr?: string | null; experience?: number | null; education?: string | null; educationAr?: string | null; avatarUrl?: string | null; isActive: boolean } | undefined
  availability: AvailabilitySlot[] | undefined
  existingBreaks: { dayOfWeek: number; startTime: string; endTime: string }[] | undefined
  existingServices: EmployeeService[] | undefined
  form: UseFormReturn<CreateEmployeeFormData>
  schedule: AvailabilitySlot[]
  setSchedule: (s: AvailabilitySlot[]) => void
  breaks: LocalBreak[]
  setBreaksState: (b: LocalBreak[]) => void
  draftServices: DraftService[]
  setDraftServices: (ds: DraftService[]) => void
  vacation: LocalVacation
  setIsSubmitting: (v: boolean) => void
}

export function useEmployeeForm({
  isEdit,
  employeeId,
  employee,
  availability,
  existingBreaks,
  existingServices,
  form,
  schedule,
  setSchedule,
  breaks,
  setBreaksState,
  draftServices,
  setDraftServices,
  vacation,
  setIsSubmitting,
}: UseEmployeeFormOptions) {
  const router = useRouter()
  const { t } = useLocale()
  const { onboardMutation, updateMutation } = useEmployeeMutations()
  const setAvailabilityMut = useSetAvailability()
  const setBreaksMut = useSetBreaks()
  // employeeId may be undefined during create — hooks safe with empty string (won't invalidate wrong key)
  const vacationMuts = useVacationMutations(employeeId ?? "")
  const serviceMuts = useEmployeeServiceMutations(employeeId ?? "")

  useEffect(() => {
    if (!employee) return
    const anyEmp = employee as typeof employee & {
      phone?: string | null
      gender?: "MALE" | "FEMALE" | null
      employmentType?: "FULL_TIME" | "PART_TIME" | "CONTRACT" | null
    }
    form.reset({
      title: employee.title ?? "",
      nameEn: `${employee.user.firstName} ${employee.user.lastName}`.trim(),
      nameAr: employee.nameAr ?? "",
      phone: anyEmp.phone ?? "",
      gender: anyEmp.gender ?? undefined,
      employmentType: anyEmp.employmentType ?? "FULL_TIME",
      specialty: employee.specialty ?? "",
      specialtyAr: employee.specialtyAr ?? "",
      bio: employee.bio ?? "",
      bioAr: employee.bioAr ?? "",
      experience: employee.experience ?? undefined,
      education: employee.education ?? "",
      educationAr: employee.educationAr ?? "",
      avatarUrl: employee.avatarUrl ?? "",
      isActive: employee.isActive,
    })
  }, [employee, form])

  useEffect(() => {
    if (!availability?.length) return
    const merged = defaultSchedule.map((def) => {
      const found = availability.find((a: AvailabilitySlot) => a.dayOfWeek === def.dayOfWeek)
      return found ?? { ...def, isActive: false }
    })
    setSchedule(merged)
  }, [availability, setSchedule])

  useEffect(() => {
    if (!existingBreaks?.length) return
    setBreaksState(existingBreaks.map(
      ({ dayOfWeek, startTime, endTime }, i: number) => ({
        key: `brk-existing-${i}`, dayOfWeek, startTime, endTime,
      }),
    ))
  }, [existingBreaks, setBreaksState])

  useEffect(() => {
    if (!existingServices?.length) return
    setDraftServices(existingServices.map((ps: EmployeeService) => ({
      key: ps.id, serviceId: ps.serviceId,
      serviceName: ps.service.nameAr || ps.service.nameEn,
      bufferMinutes: ps.bufferMinutes, isActive: ps.isActive,
      availableTypes: ps.availableTypes,
      types: (ps.serviceTypes ?? []).map((st) => ({
        bookingType: st.bookingType, price: st.price ?? undefined,
        duration: st.duration ?? undefined, isActive: st.isActive,
      })),
    })))
  }, [existingServices, setDraftServices])

  async function submitEdit(data: EditEmployeeFormData) {
    const id = employeeId!
    const stepErrors: string[] = []
    try {
      await updateMutation.mutateAsync({
        id,
        title: data.title || undefined,
        nameEn: data.nameEn || undefined,
        nameAr: data.nameAr || undefined,
        phone: data.phone || undefined,
        gender: data.gender,
        employmentType: data.employmentType,
        specialty: data.specialty || undefined,
        specialtyAr: data.specialtyAr || undefined,
        bio: data.bio || undefined,
        bioAr: data.bioAr || undefined,
        experience: data.experience,
        education: data.education || undefined,
        educationAr: data.educationAr || undefined,
        avatarUrl: data.avatarUrl || undefined,
        isActive: data.isActive,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("employees.edit.error"))
      setIsSubmitting(false)
      return
    }
    const activeSlots = schedule.filter((s) => s.isActive)
    if (activeSlots.length > 0) {
      try { await setAvailabilityMut.mutateAsync({ id, schedule: activeSlots }) }
      catch { stepErrors.push(t("employees.form.stepErrorSchedule")) }
    }
    if (breaks.length > 0) {
      try {
        await setBreaksMut.mutateAsync({
          id,
          breaks: breaks.map(({ dayOfWeek, startTime, endTime }) => ({
            dayOfWeek, startTime, endTime,
          })),
        })
      } catch { stepErrors.push(t("employees.form.stepErrorBreaks")) }
    }
    if (vacation.enabled && vacation.startDate && vacation.endDate) {
      try {
        await vacationMuts.createMut.mutateAsync({
          startDate: vacation.startDate,
          endDate: vacation.endDate,
          reason: vacation.reason || undefined,
        })
      } catch { stepErrors.push(t("employees.form.stepErrorVacation")) }
    }
    const existingIds = new Set((existingServices ?? []).map((ps) => ps.serviceId))
    for (const ds of draftServices) {
      const payload = {
        availableTypes: ds.availableTypes, bufferMinutes: ds.bufferMinutes,
        isActive: ds.isActive, types: ds.types,
      }
      try {
        if (existingIds.has(ds.serviceId)) {
          await serviceMuts.updateMut.mutateAsync({ serviceId: ds.serviceId, payload })
        } else {
          await assignService(id, { serviceId: ds.serviceId, ...payload })
        }
      } catch { stepErrors.push(t("employees.form.stepErrorServices")) }
    }
    if (stepErrors.length > 0) {
      toast.warning(`${t("employees.edit.success")} (${t("common.warnings")}: ${[...new Set(stepErrors)].join(t("common.listSep"))})`)
    } else {
      toast.success(t("employees.edit.success"))
    }
    setIsSubmitting(false)
    router.push("/employees")
  }

  async function submitCreate(data: CreateEmployeeFormData) {
    const stepErrors: string[] = []
    let newId: string
    try {
      const result = await onboardMutation.mutateAsync({
        title: data.title || undefined,
        nameEn: data.nameEn,
        nameAr: data.nameAr,
        email: data.email,
        phone: data.phone || undefined,
        gender: data.gender,
        employmentType: data.employmentType,
        specialty: data.specialty,
        specialtyAr: data.specialtyAr || undefined,
        bio: data.bio || undefined,
        bioAr: data.bioAr || undefined,
        experience: data.experience,
        education: data.education || undefined,
        educationAr: data.educationAr || undefined,
        avatarUrl: data.avatarUrl || undefined,
        isActive: data.isActive,
      })
      newId = result.employee.id
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("employees.create.error"))
      setIsSubmitting(false)
      return
    }
    const activeSlots = schedule.filter((s) => s.isActive)
    if (activeSlots.length > 0) {
      try { await setAvailabilityMut.mutateAsync({ id: newId, schedule: activeSlots }) }
      catch { stepErrors.push(t("employees.form.stepErrorSchedule")) }
    }
    if (breaks.length > 0) {
      try {
        await setBreaksMut.mutateAsync({
          id: newId,
          breaks: breaks.map(({ dayOfWeek, startTime, endTime }) => ({
            dayOfWeek, startTime, endTime,
          })),
        })
      } catch { stepErrors.push(t("employees.form.stepErrorBreaks")) }
    }
    if (vacation.enabled && vacation.startDate && vacation.endDate) {
      try {
        await vacationMuts.createMut.mutateAsync({
          startDate: vacation.startDate, endDate: vacation.endDate,
          reason: vacation.reason || undefined,
        })
      } catch { stepErrors.push(t("employees.form.stepErrorVacation")) }
    }
    if (draftServices.length > 0) {
      try {
        await Promise.all(
          draftServices.map((ds) =>
            assignService(newId, {
              serviceId: ds.serviceId, availableTypes: ds.availableTypes,
              bufferMinutes: ds.bufferMinutes, isActive: ds.isActive, types: ds.types,
            }),
          ),
        )
      } catch { stepErrors.push(t("employees.form.stepErrorServices")) }
    }
    setIsSubmitting(false)
    if (stepErrors.length > 0) {
      toast.warning(t("employees.form.createPartialSuccess").replace("{steps}", stepErrors.join(", ")))
    } else {
      toast.success(t("employees.create.success"))
    }
    router.push("/employees")
  }

  const onSubmit = form.handleSubmit(
    async (data) => {
      if (isEdit) {
        await submitEdit(data as EditEmployeeFormData)
      } else {
        await submitCreate(data as CreateEmployeeFormData)
      }
    },
    (errors) => {
      // Without this, zod validation failures on fields that lack a visible
      // FormMessage (e.g. a select with no error node) would leave the user
      // with a non-responsive submit button and no feedback at all.
      const firstKey = Object.keys(errors)[0]
      const firstMessage = firstKey ? String((errors[firstKey as keyof typeof errors] as { message?: unknown } | undefined)?.message ?? "") : ""
      toast.error(firstMessage || t("employees.form.validationFailed"))
    },
  )

  return { onSubmit }
}

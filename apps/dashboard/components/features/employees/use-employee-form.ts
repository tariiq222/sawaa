import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { UseFormReturn } from "react-hook-form"
import type { CreateEmployeeFormData } from "@/components/features/employees/create/form-schema"
import type {
  LocalBreak,
  LocalVacation,
} from "@/components/features/employees/create/schedule-tab"
import type { DraftService } from "@/components/features/employees/create/services-tab"
import type { AvailabilitySlot, EmployeeService } from "@/lib/types/employee"
import {
  assignService,
  deleteEmployee,
  setEmployeeServiceOptions,
  uploadEmployeeAvatar,
} from "@/lib/api/employees"
import {
  assignEmployeeToBranch,
  unassignEmployeeFromBranch,
  fetchBranches,
} from "@/lib/api/branches"
import {
  useEmployeeMutations,
  useSetAvailability,
  useSetBreaks,
  useVacationMutations,
  useEmployeeServiceMutations,
} from "@/hooks/use-employee-mutations"
import { useLocale } from "@/components/locale-provider"
import { halalasToSarNumber, sarToHalalas } from "@/lib/money"
import { buildEmployeeServiceOptionsPayload } from "./employee-service-option-overrides"
import { z } from "zod"
import { createEmployeeSchemaStatic } from "@/components/features/employees/create/form-schema"

const _editEmployeeSchema = createEmployeeSchemaStatic.partial().extend({
  isActive: z.boolean(),
})
type EditEmployeeFormData = z.infer<typeof _editEmployeeSchema>

function toDisplayTypeConfigs(types: EmployeeService["serviceTypes"] = []) {
  return types.map((st) => ({
    deliveryType: st.deliveryType,
    price: st.price != null ? halalasToSarNumber(st.price) : undefined,
    duration: st.duration ?? undefined,
    isActive: st.isActive,
  }))
}

function toStorageTypeConfigs(types: DraftService["types"] = []) {
  return types.map((tc) => ({
    ...tc,
    price: tc.price != null ? sarToHalalas(tc.price) : tc.price,
  }))
}

const defaultSchedule: AvailabilitySlot[] = Array.from(
  { length: 7 },
  (_, i) => ({
    dayOfWeek: i,
    startTime: "09:00",
    endTime: "17:00",
    isActive: i <= 4,
  })
)

interface UseEmployeeFormOptions {
  isEdit: boolean
  employeeId: string | undefined
  employee:
    | {
        user: { firstName: string; lastName: string }
        title?: string | null
        nameAr?: string | null
        specialty?: string | null
        specialtyAr?: string | null
        bio?: string | null
        bioAr?: string | null
        experience?: number | null
        education?: string | null
        educationAr?: string | null
        avatarUrl?: string | null
        isActive: boolean
        branchIds?: string[]
      }
    | undefined
  availability: AvailabilitySlot[] | undefined
  existingBreaks:
    | { dayOfWeek: number; startTime: string; endTime: string }[]
    | undefined
  existingServices: EmployeeService[] | undefined
  form: UseFormReturn<CreateEmployeeFormData>
  schedule: AvailabilitySlot[]
  setSchedule: (s: AvailabilitySlot[]) => void
  breaks: LocalBreak[]
  setBreaksState: (b: LocalBreak[]) => void
  draftServices: DraftService[]
  setDraftServices: (ds: DraftService[]) => void
  vacation: LocalVacation
  branchIds: string[]
  setBranchIds: (ids: string[]) => void
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
  branchIds,
  setBranchIds,
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

  const hydratedRef = useRef({
    employee: false,
    availability: false,
    breaks: false,
    services: false,
    branches: false,
  })

  useEffect(() => {
    if (!employee || hydratedRef.current.employee) return
    hydratedRef.current.employee = true
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
    if (!availability?.length || hydratedRef.current.availability) return
    hydratedRef.current.availability = true
    const merged = defaultSchedule.map((def) => {
      const found = availability.find(
        (a: AvailabilitySlot) => a.dayOfWeek === def.dayOfWeek
      )
      return found ?? { ...def, isActive: false }
    })
    setSchedule(merged)
  }, [availability, setSchedule])

  useEffect(() => {
    if (!existingBreaks?.length || hydratedRef.current.breaks) return
    hydratedRef.current.breaks = true
    setBreaksState(
      existingBreaks.map(({ dayOfWeek, startTime, endTime }, i: number) => ({
        key: `brk-existing-${i}`,
        dayOfWeek,
        startTime,
        endTime,
      }))
    )
  }, [existingBreaks, setBreaksState])

  useEffect(() => {
    if (!existingServices?.length || hydratedRef.current.services) return
    hydratedRef.current.services = true
    setDraftServices(
      existingServices.map((ps: EmployeeService) => ({
        key: ps.id,
        serviceId: ps.serviceId,
        serviceName: ps.service.nameAr || ps.service.nameEn,
        bufferMinutes: ps.bufferMinutes ?? 0,
        isActive: ps.isActive,
        availableTypes: ps.availableTypes ?? [],
        types: toDisplayTypeConfigs(ps.serviceTypes ?? []),
      }))
    )
  }, [existingServices, setDraftServices])

  useEffect(() => {
    if (!isEdit || hydratedRef.current.branches) return
    if (!employee?.branchIds) return
    hydratedRef.current.branches = true
    setBranchIds(employee.branchIds)
  }, [isEdit, employee, setBranchIds])

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
      toast.error(
        err instanceof Error ? err.message : t("employees.edit.error")
      )
      setIsSubmitting(false)
      return
    }
    if (data.avatarFile) {
      try {
        await uploadEmployeeAvatar(id, data.avatarFile)
      } catch {
        stepErrors.push(t("employees.form.stepErrorAvatar"))
      }
    }
    const activeSlots = schedule.filter((s) => s.isActive)
    if (activeSlots.length > 0) {
      try {
        await setAvailabilityMut.mutateAsync({ id, schedule: activeSlots })
      } catch {
        stepErrors.push(t("employees.form.stepErrorSchedule"))
      }
    }
    if (breaks.length > 0) {
      try {
        await setBreaksMut.mutateAsync({
          id,
          breaks: breaks.map(({ dayOfWeek, startTime, endTime }) => ({
            dayOfWeek,
            startTime,
            endTime,
          })),
        })
      } catch {
        stepErrors.push(t("employees.form.stepErrorBreaks"))
      }
    }
    if (vacation.enabled && vacation.startDate && vacation.endDate) {
      try {
        await vacationMuts.createMut.mutateAsync({
          startDate: vacation.startDate,
          endDate: vacation.endDate,
          reason: vacation.reason || undefined,
        })
      } catch {
        stepErrors.push(t("employees.form.stepErrorVacation"))
      }
    }
    const existingIds = new Set(
      (existingServices ?? []).map((ps) => ps.serviceId)
    )
    for (const ds of draftServices) {
      const payload = {
        availableTypes: ds.availableTypes,
        bufferMinutes: ds.bufferMinutes,
        isActive: ds.isActive,
        types: toStorageTypeConfigs(ds.types),
      }
      try {
        if (existingIds.has(ds.serviceId)) {
          await serviceMuts.updateMut.mutateAsync({
            serviceId: ds.serviceId,
            payload,
          })
        } else {
          // The assign endpoint whitelists only `serviceId` (global
          // forbidNonWhitelisted ValidationPipe); sending the extra option
          // fields 400s. availableTypes/types persist via the
          // setEmployeeServiceOptions call below, matching the create path.
          await assignService(id, { serviceId: ds.serviceId })
        }
        const optionsPayload = buildEmployeeServiceOptionsPayload({
          typeConfigs: ds.types,
        })
        if (optionsPayload) {
          await setEmployeeServiceOptions(id, ds.serviceId, optionsPayload)
        }
      } catch {
        stepErrors.push(t("employees.form.stepErrorServices"))
      }
    }
    try {
      const existing = new Set(employee?.branchIds ?? [])
      const target = new Set(branchIds)
      const toAdd = [...target].filter((id) => !existing.has(id))
      const toRemove = [...existing].filter((id) => !target.has(id))
      await Promise.all([
        ...toAdd.map((branchId) => assignEmployeeToBranch(branchId, id)),
        ...toRemove.map((branchId) => unassignEmployeeFromBranch(branchId, id)),
      ])
    } catch {
      stepErrors.push(t("employees.form.stepErrorBranches"))
    }
    if (stepErrors.length > 0) {
      toast.warning(
        `${t("employees.edit.success")} (${t("common.warnings")}: ${[...new Set(stepErrors)].join(t("common.listSep"))})`
      )
    } else {
      toast.success(t("employees.edit.success"))
    }
    setIsSubmitting(false)
    router.push("/employees")
  }

  async function submitCreate(data: CreateEmployeeFormData) {
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
        isPublic: data.isPublic,
      })
      newId = result.employee.id
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("employees.create.error")
      )
      setIsSubmitting(false)
      return
    }

    try {
      if (data.avatarFile) {
        await uploadEmployeeAvatar(newId, data.avatarFile)
      }

      let targetBranches = branchIds
      if (targetBranches.length === 0) {
        const res = await fetchBranches({ page: 1, perPage: 100 })
        const main = res.items.find((b) => b.isMain) ?? res.items[0]
        if (main) targetBranches = [main.id]
      }
      await Promise.all(
        targetBranches.map((branchId) => assignEmployeeToBranch(branchId, newId)),
      )

      const activeSlots = schedule.filter((s) => s.isActive)
      if (activeSlots.length > 0) {
        await setAvailabilityMut.mutateAsync({
          id: newId,
          schedule: activeSlots,
        })
      }

      if (breaks.length > 0) {
        await setBreaksMut.mutateAsync({
          id: newId,
          breaks: breaks.map(({ dayOfWeek, startTime, endTime }) => ({
            dayOfWeek,
            startTime,
            endTime,
          })),
        })
      }

      if (vacation.enabled && vacation.startDate && vacation.endDate) {
        await vacationMuts.createMut.mutateAsync({
          startDate: vacation.startDate,
          endDate: vacation.endDate,
          reason: vacation.reason || undefined,
        })
      }

      if (draftServices.length > 0) {
        await Promise.all(
          draftServices.map(async (ds) => {
            await assignService(newId, {
              serviceId: ds.serviceId,
            })
            const optionsPayload = buildEmployeeServiceOptionsPayload({
              typeConfigs: ds.types,
            })
            if (optionsPayload) {
              await setEmployeeServiceOptions(newId, ds.serviceId, optionsPayload)
            }
          })
        )
      }
    } catch {
      try {
        await deleteEmployee(newId)
      } catch {
        // The original setup failure is the user-facing error; cleanup failure
        // should not turn a failed create into a partial-success success path.
      }
      setIsSubmitting(false)
      toast.error(t("employees.create.error"))
      return
    }

    setIsSubmitting(false)
    toast.success(t("employees.create.success"))
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
      const firstMessage = firstKey
        ? String(
            (
              errors[firstKey as keyof typeof errors] as
                | { message?: unknown }
                | undefined
            )?.message ?? ""
          )
        : ""
      toast.error(firstMessage || t("employees.form.validationFailed"))
    }
  )

  return { onSubmit }
}

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { Button } from "@deqah/ui"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@deqah/ui"
import { Skeleton } from "@deqah/ui"
import { BasicInfoTab } from "@/components/features/employees/basic-info-tab"
import {
  ScheduleTab,
  type LocalBreak,
  type LocalVacation,
} from "@/components/features/employees/create/schedule-tab"
import {
  ServicesTab,
  type DraftService,
} from "@/components/features/employees/create/services-tab"
import {
  createEmployeeSchema,
  createEmployeeSchemaStatic,
  createEmployeeDefaults,
  type CreateEmployeeFormData,
} from "@/components/features/employees/create/form-schema"
import {
  useEmployee,
  useEmployeeAvailability,
  useEmployeeBreaks,
  useEmployeeServices,
} from "@/hooks/use-employees"
import type { AvailabilitySlot } from "@/lib/types/employee"
import { useLocale } from "@/components/locale-provider"
import { useEmployeeForm } from "@/components/features/employees/use-employee-form"

/* ─── Edit Schema ─── */

const editEmployeeSchema = createEmployeeSchemaStatic.partial().extend({
  isActive: z.boolean(),
})

/* ─── Types ─── */

type Props =
  | { mode: "create" }
  | { mode: "edit"; employeeId: string }

const defaultSchedule: AvailabilitySlot[] = Array.from({ length: 7 }, (_, i) => ({
  dayOfWeek: i, startTime: "09:00", endTime: "17:00", isActive: i <= 4,
}))

/* ─── Component ─── */

export function EmployeeFormPage(props: Props) {
  const isEdit = props.mode === "edit"
  const employeeId = isEdit ? props.employeeId : undefined

  const router = useRouter()
  const { t } = useLocale()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data: employee, isLoading } = useEmployee(employeeId ?? null)
  const { data: availability } = useEmployeeAvailability(employeeId ?? null)
  const { data: existingBreaks } = useEmployeeBreaks(employeeId ?? null)
  const { data: existingServices } = useEmployeeServices(employeeId ?? null)

  const [schedule, setSchedule] = useState<AvailabilitySlot[]>(defaultSchedule)
  const [breaks, setBreaksState] = useState<LocalBreak[]>([])
  const [draftServices, setDraftServices] = useState<DraftService[]>([])
  const [vacation, setVacation] = useState<LocalVacation>({ enabled: false, startDate: "", endDate: "", reason: "" })

  const translatedSchema = createEmployeeSchema(t)
  const form = useForm<CreateEmployeeFormData>({
      resolver: zodResolver(isEdit ? (editEmployeeSchema as unknown as ReturnType<typeof createEmployeeSchema>) : translatedSchema) as never,
    defaultValues: isEdit ? undefined : createEmployeeDefaults,
  })

  /* ─── Form logic (effects + submit) ─── */

  const { onSubmit } = useEmployeeForm({
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
  })

  /* ─── Loading skeleton (edit only) ─── */

  if (isEdit && isLoading) {
    return (
      <ListPageShell>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
        <div className="mt-6 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={`skeleton-${i}`} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      </ListPageShell>
    )
  }

  /* ─── Render ─── */

  const title = isEdit ? t("employees.edit.pageTitle") : t("employees.create.pageTitle")
  const employeeDisplayName = employee
    ? (employee.nameAr ?? `${employee.user.firstName} ${employee.user.lastName}`)
    : ""
  const description = isEdit ? employeeDisplayName : t("employees.create.pageDesc")

  const breadcrumbItems = isEdit
    ? [
        { label: t("nav.dashboard"), href: "/" },
        { label: t("nav.employees"), href: "/employees" },
        { label: employeeDisplayName, href: employeeId ? `/employees/${employeeId}` : undefined },
        { label: t("nav.edit") },
      ]
    : [
        { label: t("nav.dashboard"), href: "/" },
        { label: t("nav.employees"), href: "/employees" },
        { label: t("nav.create") },
      ]

  return (
    <ListPageShell>
      <Breadcrumbs items={breadcrumbItems} />
      <PageHeader title={title} description={description} />

      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <Tabs defaultValue="basic">
          <TabsList>
            <TabsTrigger value="basic">{t("employees.create.tabs.basic")}</TabsTrigger>
            <TabsTrigger value="schedule">{t("employees.create.tabs.schedule")}</TabsTrigger>
            <TabsTrigger value="services">{t("employees.create.tabs.services")}</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="pt-4 space-y-4">
            <BasicInfoTab
              form={form}
              showEmail={!isEdit}
              employeeName={isEdit ? employeeDisplayName : undefined}
              readOnlyEmail={isEdit ? employee?.user.email ?? null : null}
            />
          </TabsContent>

          <TabsContent value="schedule" className="pt-4 space-y-4">
            <ScheduleTab
              schedule={schedule}
              onScheduleChange={setSchedule}
              breaks={breaks}
              onBreaksChange={setBreaksState}
              vacation={vacation}
              onVacationChange={setVacation}
            />
          </TabsContent>

          <TabsContent value="services" className="pt-4">
            <ServicesTab draftServices={draftServices} onDraftServicesChange={setDraftServices} />
          </TabsContent>
        </Tabs>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => router.push("/employees")}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? t(isEdit ? "employees.edit.submitting" : "employees.create.submitting")
              : t(isEdit ? "employees.edit.submit" : "employees.create.submit")}
          </Button>
        </div>
      </form>
    </ListPageShell>
  )
}

"use client"

import { useFieldArray, type UseFormReturn } from "react-hook-form"
import { Button, Input, Label } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { useAllServices, useServiceEmployees } from "@/hooks/use-services"
import { serviceOptionLabel } from "./service-option-label"
import { packageEmployeeLabel } from "@/lib/package-editor-labels"
import { applyFirstSessionToAll, dependencyOptions, emptyGroup, emptySession } from "@/lib/package-groups-form"
import type { GroupedPackageFormData } from "@/lib/schemas/package-groups.schema"
import type { PractitionerDurationItem, Service } from "@/lib/types/service"

interface Props {
  form: UseFormReturn<GroupedPackageFormData>
  translateError: (message?: string) => string | undefined
  /** Optional DOM-id namespace for editors that render several group forms. */
  idPrefix?: string
}

const MAX_SESSION_COUNT = 1000

export function GroupedPackageGroups({ form, translateError, idPrefix }: Props) {
  const { t } = useLocale()
  const { data: services = [] } = useAllServices()
  const groups = useFieldArray({ control: form.control, name: "groups" })
  const values = form.watch("groups")
  const removeGroup = (index: number) => {
    const key = values[index]?.key
    const dependents = values.filter((group, groupIndex) => groupIndex !== index && group.dependsOnGroupKey === key)
    if (dependents.length && typeof window !== "undefined" && !window.confirm(t("packages.grouped.groups.removeDependencyConfirm"))) return
    groups.remove(index)
    if (!key) return
    values.forEach((group, groupIndex) => {
      if (groupIndex !== index && group.dependsOnGroupKey === key) {
        const nextIndex = groupIndex < index ? groupIndex : groupIndex - 1
        form.setValue(`groups.${nextIndex}.dependsOnGroupKey`, null, { shouldDirty: true })
      }
    })
  }
  return (
    <section data-package-section="groups" className="flex flex-col gap-4" aria-label={t("packages.grouped.groups.title")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-lg font-semibold">{t("packages.grouped.groups.title")}</h2><p className="text-sm text-muted-foreground">{t("packages.grouped.groups.description")}</p></div>
        <Button type="button" variant="outline" onClick={() => groups.append(emptyGroup())}>{t("packages.grouped.groups.add")}</Button>
      </div>
      {groups.fields.map((field, index) => <GroupedPackageGroup key={field.id} form={form} index={index} services={services} groups={values} onRemove={() => removeGroup(index)} translateError={translateError} idPrefix={idPrefix} />)}
      {groups.fields.length === 0 && <p role="alert" className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">{t("packages.grouped.errors.groupCount")}</p>}
    </section>
  )
}

interface GroupProps extends Props {
  index: number
  services: Service[]
  groups: GroupedPackageFormData["groups"]
  onRemove: () => void
}

function GroupedPackageGroup({ form, index, services, groups, onRemove, translateError, idPrefix }: GroupProps) {
  const { t, locale } = useLocale()
  const path = `groups.${index}` as const
  const domPath = idPrefix ? `${idPrefix}-${path}` : path
  const group = form.watch(`groups.${index}`)
  const sessions = useFieldArray({ control: form.control, name: `${path}.sessions` })
  const { data: employees = [], isLoading: employeesLoading } = useServiceEmployees(group?.serviceId ?? "")
  const selectedService = services.find((service) => service.id === group?.serviceId)
  const serviceTitle = selectedService ? serviceOptionLabel(selectedService, locale) : t("packages.grouped.groups.unnamed")
  const employee = employees.find((entry) => entry.employee.id === group?.employeeId)
  const durationChoices = (employee?.effectiveDurations ?? []).flatMap((durationGroup) => durationGroup.durations)
  const serviceRegistration = form.register(`${path}.serviceId`)
  const employeeRegistration = form.register(`${path}.employeeId`)
  const dependencyRegistration = form.register(`${path}.dependsOnGroupKey`)
  const resetSessions = () => sessions.replace((group?.sessions ?? []).map((session, position) => ({ ...emptySession(position), key: session.key })))
  const onServiceChange = (serviceId: string) => {
    form.setValue(`${path}.serviceId`, serviceId, { shouldDirty: true })
    form.setValue(`${path}.employeeId`, "", { shouldDirty: true })
    form.setValue(`${path}.sameApplied`, false, { shouldDirty: true })
    form.clearErrors(`${path}.serviceId`)
    form.clearErrors(`${path}.employeeId`)
    form.clearErrors(`${path}.sessions`)
    resetSessions()
  }
  const onEmployeeChange = (employeeId: string) => {
    form.setValue(`${path}.employeeId`, employeeId, { shouldDirty: true })
    form.setValue(`${path}.sameApplied`, false, { shouldDirty: true })
    form.clearErrors(`${path}.employeeId`)
    form.clearErrors(`${path}.sessions`)
    resetSessions()
  }
  const setSessionCount = (count: number) => {
    const safeCount = Math.max(1, Math.floor(Number.isFinite(count) ? count : 1))
    if (safeCount > MAX_SESSION_COUNT) {
      form.setError(`${path}.sessions`, { type: "manual", message: "packages.grouped.errors.sessionCountTooLarge" })
      return
    }
    const current = form.getValues(`${path}.sessions`)
    if (safeCount > current.length) {
      const next = current.concat(Array.from({ length: safeCount - current.length }, (_, offset) => emptySession(current.length + offset)))
      sessions.replace(group?.sameApplied ? applyFirstSessionToAll(next) : next)
    }
    if (safeCount < current.length) sessions.remove(Array.from({ length: current.length - safeCount }, (_, offset) => current.length - offset - 1))
  }
  const applyFirst = () => {
    sessions.replace(applyFirstSessionToAll(form.getValues(`${path}.sessions`)))
    form.setValue(`${path}.sameApplied`, true, { shouldDirty: true })
  }
  const updateSession = (sessionIndex: number, values: Partial<GroupedPackageFormData["groups"][number]["sessions"][number]>) => {
    const current = form.getValues(`${path}.sessions`)
    if (group?.sessionMode === "SAME" && group.sameApplied && sessionIndex === 0) {
      sessions.replace(applyFirstSessionToAll(current.map((session) => ({ ...session, ...values }))))
      return
    }
    Object.entries(values).forEach(([key, value]) => form.setValue(`${path}.sessions.${sessionIndex}.${key}` as never, value as never, { shouldDirty: true }))
  }
  const error = form.formState.errors.groups?.[index]
  return (
    <article className="rounded-2xl border border-border bg-surface-solid p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-muted-foreground">{t("packages.grouped.groups.groupNumber")} {index + 1}</p><h3 className="mt-1 text-base font-semibold">{group?.label?.trim() || serviceTitle}</h3></div><Button type="button" variant="ghost" onClick={onRemove} disabled={groups.length === 1}>{t("packages.grouped.groups.remove")}</Button></div>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label={t("packages.grouped.groups.label")} htmlFor={`${domPath}.label`}><Input id={`${domPath}.label`} {...form.register(`${path}.label`)} placeholder={t("packages.grouped.groups.labelPlaceholder")} /></Field>
        <Field label={t("packages.grouped.groups.service")} htmlFor={`${domPath}.serviceId`} error={translateError(error?.serviceId?.message)}>
          <select {...serviceRegistration} id={`${domPath}.serviceId`} className="h-10 rounded-md border border-border bg-background px-3 text-sm" value={group?.serviceId ?? ""} onChange={(event) => { void serviceRegistration.onChange(event); onServiceChange(event.target.value) }} aria-label={t("packages.grouped.groups.service")}>
            <option value="">{t("packages.items.servicePlaceholder")}</option>{services.map((service) => <option key={service.id} value={service.id}>{serviceOptionLabel(service, locale)}</option>)}
          </select>
        </Field>
        <Field label={t("packages.grouped.groups.practitioner")} htmlFor={`${domPath}.employeeId`} error={translateError(error?.employeeId?.message)}>
          <select {...employeeRegistration} id={`${domPath}.employeeId`} className="h-10 rounded-md border border-border bg-background px-3 text-sm" value={group?.employeeId ?? ""} onChange={(event) => { void employeeRegistration.onChange(event); onEmployeeChange(event.target.value) }} disabled={!group?.serviceId || employeesLoading} aria-label={t("packages.grouped.groups.practitioner")}>
            <option value="">{employeesLoading ? t("packages.grouped.loading") : t("packages.items.employeePlaceholder")}</option>{employees.filter((entry) => entry.employee.isActive).map((entry) => <option key={entry.employee.id} value={entry.employee.id}>{packageEmployeeLabel(entry.employee, t("packages.review.unavailable"))}</option>)}
          </select>
        </Field>
        <Field label={t("packages.grouped.groups.sequence")} htmlFor={`${domPath}.sequenceMode`}>
          <select id={`${domPath}.sequenceMode`} className="h-10 rounded-md border border-border bg-background px-3 text-sm" {...form.register(`${path}.sequenceMode`)}><option value="ORDERED">{t("packages.grouped.sequence.ORDERED")}</option><option value="UNORDERED">{t("packages.grouped.sequence.UNORDERED")}</option></select>
          <p className="text-xs text-muted-foreground">{t(`packages.grouped.sequence.help.${group?.sequenceMode ?? "ORDERED"}`)}</p>
        </Field>
        <Field label={t("packages.grouped.groups.dependency")} htmlFor={`${domPath}.dependsOnGroupKey`} error={translateError(error?.dependsOnGroupKey?.message)}>
          <select {...dependencyRegistration} id={`${domPath}.dependsOnGroupKey`} className="h-10 rounded-md border border-border bg-background px-3 text-sm" value={group?.dependsOnGroupKey ?? ""} onChange={(event) => { void dependencyRegistration.onChange(event); form.setValue(`${path}.dependsOnGroupKey`, event.target.value || null, { shouldDirty: true }); form.clearErrors(`${path}.dependsOnGroupKey`) }}>
            <option value="">{t("packages.grouped.groups.noDependency")}</option>{dependencyOptions(groups, group?.key ?? "").map((key) => { const candidate = groups.find((item) => item.key === key); const candidateIndex = groups.findIndex((item) => item.key === key); const service = services.find((item) => item.id === candidate?.serviceId); const label = candidate?.label?.trim() || `${t("packages.grouped.groups.groupNumber")} ${candidateIndex + 1}`; return <option key={key} value={key}>{label}{service ? ` · ${serviceOptionLabel(service, locale)}` : ""}</option> })}
          </select>
          <p className="text-xs text-muted-foreground">{t("packages.grouped.groups.dependencyHint")}</p>
        </Field>
      </div>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-t border-border pt-4">
        <Field label={t("packages.grouped.groups.sessionCount")} htmlFor={`${domPath}.sessionCount`} error={translateError(error?.sessions?.message)}><Input id={`${domPath}.sessionCount`} name={`${path}.sessionCount`} type="number" min={1} value={group?.sessions.length ?? 1} onChange={(event) => setSessionCount(Number(event.target.value))} inputMode="numeric" /></Field>
        <div className="flex rounded-md border border-border p-1" role="group" aria-label={t("packages.grouped.groups.sessionMode")}>
          {(["DETAIL", "SAME"] as const).map((mode) => <button key={mode} type="button" aria-pressed={group?.sessionMode === mode} onClick={() => { form.setValue(`${path}.sessionMode`, mode, { shouldDirty: true }); form.setValue(`${path}.sameApplied`, false, { shouldDirty: true }) }} className={`rounded px-3 py-1.5 text-sm ${group?.sessionMode === mode ? "bg-primary/10 font-medium" : "text-muted-foreground"}`}>{t(`packages.grouped.sessionMode.${mode}`)}</button>)}
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{t(`packages.grouped.sessionMode.help.${group?.sessionMode ?? "DETAIL"}`)}</p>
      {group?.sessionMode === "SAME" && !group.sameApplied && <Button type="button" variant="outline" className="mt-3" onClick={applyFirst}>{t("packages.grouped.sessionMode.applyFirst")}</Button>}
      <p className="mt-3 text-xs text-muted-foreground">{t("packages.grouped.groups.priceHint")}</p>
      <div className="mt-4 flex flex-col gap-3">{sessions.fields.map((field, sessionIndex) => <GroupedSessionRow key={field.id} form={form} path={`${path}.sessions.${sessionIndex}` as const} idPrefix={idPrefix} index={sessionIndex} durationChoices={durationChoices} error={error?.sessions?.[sessionIndex]} translateError={translateError} onRemove={() => sessions.remove(sessionIndex)} canRemove={sessions.fields.length > 1} disabled={Boolean(group?.sessionMode === "SAME" && group.sameApplied && sessionIndex > 0)} onChange={(values) => updateSession(sessionIndex, values)} />)}</div>
    </article>
  )
}

function GroupedSessionRow({ form, path, idPrefix, index, durationChoices, error, translateError, onRemove, canRemove, disabled, onChange }: { form: UseFormReturn<GroupedPackageFormData>; path: `groups.${number}.sessions.${number}`; idPrefix?: string; index: number; durationChoices: PractitionerDurationItem[]; error?: { durationOptionId?: { message?: string }; unitPriceSar?: { message?: string } }; translateError: Props["translateError"]; onRemove: () => void; canRemove: boolean; disabled: boolean; onChange: (values: Partial<GroupedPackageFormData["groups"][number]["sessions"][number]>) => void }) {
  const { t } = useLocale()
  const session = form.watch(path)
  const domPath = idPrefix ? `${idPrefix}-${path}` : path
  const selected = durationChoices.find((choice) => choice.id === session?.durationOptionId)
  const durationRegistration = form.register(`${path}.durationOptionId`)
  const chooseDuration = (durationOptionId: string) => {
    const duration = durationChoices.find((choice) => choice.id === durationOptionId)
    onChange({ durationOptionId, ...(duration ? { deliveryType: duration.deliveryType, unitPriceSar: duration.price / 100, hasUnitPriceOverride: false } : {}) })
  }
  const selectedLabel = selected ? (selected.labelAr || selected.label) : ""
  const selectedSummary = selected && selectedLabel.includes(String(selected.durationMins)) ? selectedLabel : selected ? `${selectedLabel} · ${selected.durationMins} ${t("common.min")}` : ""
  return <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-surface-muted p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_10rem_auto] md:items-end"><span className="text-xs font-medium text-muted-foreground">{t("packages.grouped.session")} {index + 1}</span><Field label={t("packages.grouped.duration")} htmlFor={`${domPath}.durationOptionId`} error={translateError(error?.durationOptionId?.message)}><select {...durationRegistration} id={`${domPath}.durationOptionId`} disabled={disabled} className="h-10 rounded-md border border-border bg-background px-3 text-sm" value={session?.durationOptionId ?? ""} onChange={(event) => { void durationRegistration.onChange(event); chooseDuration(event.target.value) }}><option value="">{t("packages.items.durationPlaceholder")}</option>{durationChoices.map((duration) => <option key={duration.id} value={duration.id}>{t(`packages.items.deliveryType.${duration.deliveryType}`)} · {duration.durationMins} {t("common.min")}</option>)}</select></Field><Field label={t("packages.grouped.priceSar")} htmlFor={`${domPath}.unitPriceSar`} error={translateError(error?.unitPriceSar?.message)}><Input id={`${domPath}.unitPriceSar`} name={`${path}.unitPriceSar`} disabled={disabled} type="number" min={0} step="0.01" value={session?.unitPriceSar ?? 0} onChange={(event) => onChange({ unitPriceSar: Number(event.target.value) || 0, hasUnitPriceOverride: true })} inputMode="decimal" /></Field><Button type="button" variant="ghost" onClick={onRemove} disabled={!canRemove || disabled} aria-label={`${t("packages.grouped.session")} ${index + 1}`}>{t("packages.grouped.removeSession")}</Button>{selected && <p className="text-xs text-muted-foreground md:col-span-2">{selectedSummary}</p>}</div>
}

function Field({ label, error, children, htmlFor }: { label: string; error?: string; children: React.ReactNode; htmlFor: string }) { return <div className="flex min-w-0 flex-col gap-1.5"><Label htmlFor={htmlFor}>{label}</Label>{children}{error && <p role="alert" className="text-xs text-destructive">{error}</p>}</div> }

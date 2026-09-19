"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useFormContext } from "react-hook-form"
import { useServiceEmployees, useAllServices } from "@/hooks/use-services"
import { useEmployeeServices, useAllEmployees } from "@/hooks/use-employees"
import { useLocale } from "@/components/locale-provider"
import { isSingleSpecificItem } from "@/lib/package-scope"
import type { ScopeFormData } from "@/lib/schemas/package.schema"
import { packageEmployeeLabel, packageServiceLabel, type PackageEditorOption } from "@/lib/package-editor-labels"
import { derivedPriceState, shouldResetHistoricalUnitPrice } from "@/lib/package-editor-pricing"

const emptyScope: ScopeFormData = { mode: "INCLUDE", ids: [] }
interface DurationChoice { id: string; deliveryType: "IN_PERSON" | "ONLINE"; durationMins: number; price: number }
interface PackageItemError { service?: { ids?: { message?: string } }; practitioner?: { ids?: { message?: string } }; duration?: { ids?: { message?: string }; mode?: { message?: string } }; delivery?: { ids?: { message?: string } } }
type ItemError = PackageItemError & { unitPriceSar?: { message?: string }; paidQuantity?: { message?: string }; freeQuantity?: { message?: string }; discountValue?: { message?: string } }

export function usePackageEditorItem(index: number, fieldArrayName: string, ownerEmployeeId?: string | null) {
  const { t, locale } = useLocale()
  const { control, watch, setValue, getValues, formState } = useFormContext()
  const base = `${fieldArrayName}.${index}`
  const p = useMemo(() => ({ service: `${base}.service`, practitioner: `${base}.practitioner`, duration: `${base}.duration`, delivery: `${base}.delivery`, unitPrice: `${base}.unitPriceSar`, paid: `${base}.paidQuantity`, free: `${base}.freeQuantity`, discountType: `${base}.discountType`, discountValue: `${base}.discountValue`, selectionMode: `${base}.selectionMode`, hasUnitPriceOverride: `${base}.hasUnitPriceOverride`, priceUnavailable: `${base}.priceUnavailable`, priceResetNotice: `${base}.priceResetNotice` }), [base])
  const setPath = useCallback((path: string, value: unknown, options?: { shouldDirty?: boolean }) => setValue(path as never, value as never, options as never), [setValue])
  const service = (watch(p.service) as ScopeFormData) ?? emptyScope
  const practitioner = (watch(p.practitioner) as ScopeFormData) ?? emptyScope
  const duration = (watch(p.duration) as ScopeFormData) ?? emptyScope
  const delivery = (watch(p.delivery) as ScopeFormData) ?? { mode: "ANY", ids: [] }
  const { data: services = [], isLoading: servicesLoading } = useAllServices()
  const { employees: allEmployees, isLoading: employeesLoading } = useAllEmployees()
  const { data: ownerServices = [], isLoading: ownerServicesLoading, isError: ownerServicesError } = useEmployeeServices(ownerEmployeeId ?? null)
  const singleServiceId = service.mode === "INCLUDE" && service.ids.length === 1 ? service.ids[0] : ""
  const { data: serviceEmployees = [], isLoading: serviceEmployeesLoading } = useServiceEmployees(singleServiceId)
  const ownerOfferingIds = useMemo(() => ownerEmployeeId && !ownerServicesLoading && !ownerServicesError ? new Set(ownerServices.filter((entry) => entry.isActive && entry.service).map((entry) => entry.serviceId)) : null, [ownerEmployeeId, ownerServices, ownerServicesLoading, ownerServicesError])
  const availableServices = ownerOfferingIds ? services.filter((entry) => ownerOfferingIds.has(entry.id)) : services
  const serviceOptions: PackageEditorOption[] = availableServices.map((entry) => ({ value: entry.id, label: packageServiceLabel(entry, locale) }))
  const practitionerOptions: PackageEditorOption[] = singleServiceId ? serviceEmployees.map((entry) => ({ value: entry.employee.id, label: packageEmployeeLabel(entry.employee, t("packages.review.unavailable")) })) : allEmployees.map((entry) => ({ value: entry.id, label: packageEmployeeLabel(entry, t("packages.review.unavailable")) }))
  const practitionerId = practitioner.ids[0]
  const durationChoices: DurationChoice[] = (serviceEmployees.find((entry) => entry.employee.id === practitionerId)?.effectiveDurations ?? []).flatMap((group) => group.durations.map((item) => ({ id: item.id, deliveryType: item.deliveryType, durationMins: item.durationMins, price: item.price })))
  const selectedDuration = durationChoices.find((choice) => choice.id === duration.ids[0])
  const scopeSingleSpecific = isSingleSpecificItem({ service, practitioner, duration })
  const selectionMode = (watch(p.selectionMode) as "FIXED" | "FLEXIBLE" | undefined) ?? (scopeSingleSpecific ? "FIXED" : "FLEXIBLE")
  const singleSpecific = selectionMode === "FIXED" && scopeSingleSpecific
  const hasSavedUnitPrice = watch(p.hasUnitPriceOverride) === true
  const ownerChangeRevision = Number(watch("ownerChangeRevision") ?? 0)
  const [advancedRules, setAdvancedRules] = useState(() => service.mode === "EXCLUDE" || practitioner.mode === "EXCLUDE" || duration.mode === "EXCLUDE" || delivery.mode === "EXCLUDE" || service.ids.length > 1 || practitioner.ids.length > 1 || duration.ids.length > 1)
  const priceState = derivedPriceState({ singleSpecific: singleSpecific && duration.ids.length > 0, hasHistoricalOverride: hasSavedUnitPrice, loading: serviceEmployeesLoading, selected: !!selectedDuration })
  const pricePending = priceState === "pending"
  useEffect(() => {
    setPath(p.priceUnavailable, (priceState !== "available") as never, { shouldDirty: false })
  }, [p.priceUnavailable, priceState, setPath])
  const previous = useRef({ owner: ownerEmployeeId ?? null, ownerRevision: ownerChangeRevision, ownerReady: !ownerEmployeeId, service: JSON.stringify(service), serviceReady: true, practitioner: JSON.stringify(practitioner), duration: JSON.stringify(duration), durationId: duration.ids[0] })
  const clearDimension = useCallback((dimension: "service" | "practitioner" | "duration") => {
    const path = p[dimension]
    setPath(path, emptyScope as never, { shouldDirty: true })
    const constraints = getValues(`${base}.originalConstraints`) as Array<{ dimension: string; mode: string; targetIds?: string[] }> | undefined
    if (constraints) setPath(`${base}.originalConstraints`, constraints.filter((constraint) => constraint.dimension !== dimension.toUpperCase()) as never, { shouldDirty: true })
  }, [base, getValues, p, setPath])
  useEffect(() => {
    const nowService = JSON.stringify(service)
    const nowPractitioner = JSON.stringify(practitioner)
    const nowDuration = JSON.stringify(duration)
    const ownerReady = !ownerEmployeeId || (!!ownerOfferingIds && !ownerServicesLoading && !ownerServicesError)
    const serviceReady = !singleServiceId || !serviceEmployeesLoading
    const dirtyItems = (formState.dirtyFields?.items as Array<Record<string, unknown>> | undefined) ?? []
    const dirtyItem = dirtyItems[index] ?? {}
    const ownerExplicit = formState.isDirty && (Boolean(formState.dirtyFields?.ownerEmployeeId) || Boolean(formState.dirtyFields?.ownerChangeRevision) || previous.current.owner !== (ownerEmployeeId ?? null) || previous.current.ownerRevision !== ownerChangeRevision)
    const changedService = Boolean(dirtyItem.service) && previous.current.service !== nowService && (previous.current.serviceReady || serviceReady)
    const changedPractitioner = Boolean(dirtyItem.practitioner) && previous.current.practitioner !== nowPractitioner && serviceReady
    const changedOwner = ownerExplicit && previous.current.owner !== (ownerEmployeeId ?? null) && (previous.current.ownerReady || ownerReady)
    // The item rows are not mounted on the details step. A user can change the
    // owner before this hook mounts, so the previous-owner comparison alone
    // cannot observe that transition. Revision 0 is the untouched hydration
    // state; later revisions are explicit owner changes from the form.
    const ownerRevisionReady = !!ownerEmployeeId && ownerChangeRevision > 0 && ownerReady
    const ownerServiceMismatch = ownerRevisionReady && service.mode === "INCLUDE" && service.ids.some((id) => !ownerOfferingIds?.has(id))
    const ownerReconciliationRequested = changedOwner || (ownerRevisionReady && ownerServiceMismatch)
    if ((ownerReconciliationRequested || (ownerExplicit && ownerReady && !previous.current.ownerReady)) && ownerEmployeeId && ownerOfferingIds) {
      if (service.mode === "INCLUDE" && service.ids.some((id) => !ownerOfferingIds.has(id))) {
        clearDimension("service")
        if (duration.mode !== "ANY" || hasSavedUnitPrice) {
          clearDimension("duration")
          setPath(p.hasUnitPriceOverride, false as never, { shouldDirty: true })
          setPath(p.unitPrice, undefined as never, { shouldDirty: true })
          setPath(p.priceResetNotice, true, { shouldDirty: false })
        }
      }
      if (practitioner.mode === "INCLUDE" && practitioner.ids.some((id) => id !== ownerEmployeeId)) clearDimension("practitioner")
    }
    if (changedService && singleServiceId && !serviceEmployeesLoading && !ownerEmployeeId) {
      const valid = new Set(serviceEmployees.map((entry) => entry.employee.id))
      if (practitioner.mode === "INCLUDE" && practitioner.ids.some((id) => !valid.has(id))) clearDimension("practitioner")
    }
    const ownerDurationChanged = ownerExplicit && !!ownerEmployeeId
    const ownerDurationReconciliation = ownerRevisionReady
    if ((ownerDurationChanged || ownerDurationReconciliation || shouldResetHistoricalUnitPrice(previous.current.durationId, duration.ids[0], hasSavedUnitPrice, !!selectedDuration)) && singleServiceId && !serviceEmployeesLoading && duration.mode === "INCLUDE" && duration.ids.length > 0 && durationChoices.length > 0 && selectedDuration && hasSavedUnitPrice) {
      setPath(p.hasUnitPriceOverride, false as never, { shouldDirty: true })
      setPath(p.unitPrice, undefined as never, { shouldDirty: true })
      setPath(p.priceResetNotice, true, { shouldDirty: false })
    }
    if ((changedService || changedPractitioner || changedOwner || ownerDurationChanged || ownerDurationReconciliation) && singleServiceId && !serviceEmployeesLoading && duration.mode === "INCLUDE" && duration.ids.length > 0 && durationChoices.length === 0) {
      clearDimension("duration")
      setPath(p.hasUnitPriceOverride, false as never, { shouldDirty: true })
      setPath(p.unitPrice, undefined as never, { shouldDirty: true })
      setPath(p.priceResetNotice, true, { shouldDirty: false })
    }
    if ((changedService || changedPractitioner || ownerDurationChanged || ownerDurationReconciliation) && duration.mode === "INCLUDE" && duration.ids.length > 0 && !serviceEmployeesLoading && durationChoices.length > 0 && duration.ids.some((id) => !durationChoices.some((choice) => choice.id === id))) {
      clearDimension("duration")
      setPath(p.hasUnitPriceOverride, false as never, { shouldDirty: true })
      setPath(p.unitPrice, undefined as never, { shouldDirty: true })
      setPath(p.priceResetNotice, true, { shouldDirty: false })
    }
    previous.current = { owner: ownerReady ? ownerEmployeeId ?? null : previous.current.owner, ownerRevision: ownerReady ? ownerChangeRevision : previous.current.ownerRevision, ownerReady: ownerReady || previous.current.ownerReady, service: serviceReady ? nowService : previous.current.service, serviceReady, practitioner: nowPractitioner, duration: nowDuration, durationId: duration.ids[0] }
  }, [clearDimension, duration, durationChoices, formState.dirtyFields, formState.isDirty, hasSavedUnitPrice, index, ownerChangeRevision, ownerEmployeeId, ownerOfferingIds, ownerServicesError, ownerServicesLoading, p, practitioner, priceState, selectedDuration, service, serviceEmployees, serviceEmployeesLoading, setPath, singleServiceId])
  const errors = formState.errors
  const itemErr = (Array.isArray(errors?.[fieldArrayName]) ? (errors[fieldArrayName] as Array<ItemError>)[index] : undefined) as ItemError | undefined
  const setScope = useCallback((path: string) => (next: ScopeFormData) => {
    setPath(path, next as never, { shouldDirty: true })
    const dimension = path.endsWith(".service") ? "SERVICE" : path.endsWith(".practitioner") ? "PRACTITIONER" : path.endsWith(".duration") ? "DURATION" : "DELIVERY_TYPE"
    const original = getValues(`${base}.originalConstraints`) as Array<{ dimension: string; mode: string; targetIds?: string[] }> | undefined
    if (original) {
      const nextConstraint = { dimension, mode: next.mode, ...(next.mode === "ANY" ? {} : { targetIds: next.ids }) }
      setPath(`${base}.originalConstraints`, original.some((entry) => entry.dimension === dimension) ? original.map((entry) => entry.dimension === dimension ? nextConstraint : entry) : [...original, nextConstraint] as never, { shouldDirty: true })
    }
  }, [base, getValues, setPath])
  const resetNotice = watch(p.priceResetNotice) === true
  return { t, control, formState, p, base, service, practitioner, duration, delivery, servicesLoading, employeesLoading, serviceEmployeesLoading, serviceOptions, practitionerOptions, durationChoices, selectedDuration, singleServiceId, singleSpecific, selectionMode, advancedRules, setAdvancedRules, setScope, itemErr, resetNotice, pricePending, clearDimension }
}

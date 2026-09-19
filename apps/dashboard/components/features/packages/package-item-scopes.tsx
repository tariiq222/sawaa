"use client"

import { Controller, type Control } from "react-hook-form"
import { useLocale } from "@/components/locale-provider"
import type { ScopeFormData } from "@/lib/schemas/package.schema"
import type { MultiSelectOption } from "./multi-select"
import { ScopeControl } from "./scope-control"
import { DeliveryControl } from "./delivery-control"
import { DurationSelect, type DurationChoice } from "./duration-select"
import { MultiSelect } from "./multi-select"

export interface PackageItemError {
  service?: { ids?: { message?: string } }
  practitioner?: { ids?: { message?: string } }
  duration?: { ids?: { message?: string }; mode?: { message?: string } }
  delivery?: { ids?: { message?: string } }
}

interface Props {
  control: Control
  paths: { service: string; practitioner: string; duration: string; delivery: string }
  service: ScopeFormData
  practitioner: ScopeFormData
  duration: ScopeFormData
  delivery: ScopeFormData
  serviceOptions: MultiSelectOption[]
  practitionerOptions: MultiSelectOption[]
  durationChoices: DurationChoice[]
  showDuration: boolean
  ownerEmployeeId?: string | null
  selectionMode: "FIXED" | "FLEXIBLE"
  itemError?: PackageItemError
  advancedRules: boolean
  onToggleAdvanced: () => void
  setScope: (path: string) => (next: ScopeFormData) => void
}

export function PackageItemScopes({
  control, paths, service, practitioner, duration, delivery,
  serviceOptions, practitionerOptions, durationChoices, showDuration,
  ownerEmployeeId, selectionMode, itemError, advancedRules, onToggleAdvanced, setScope,
}: Props) {
  const { t } = useLocale()
  const fixed = selectionMode === "FIXED"
  const serviceIsComplex = service.mode === "EXCLUDE" || service.ids.length > 1
  const practitionerIsComplex = practitioner.mode === "EXCLUDE" || practitioner.ids.length > 1
  const durationIsComplex = duration.mode === "EXCLUDE" || duration.ids.length > 1
  const deliveryIsComplex = delivery.mode === "EXCLUDE" || delivery.ids.length > 1
  const serviceOptionsForFixed = serviceOptions
  const practitionerOptionsForFixed = practitionerOptions
  const durationOptions = durationChoices.map((choice) => ({
    value: choice.id,
    label: `${t(`packages.items.deliveryType.${choice.deliveryType}`)} · ${choice.durationMins} ${t("common.min")}`,
  }))
  const deliveryOptions = [
    { value: "IN_PERSON", label: t("packages.items.deliveryType.IN_PERSON") },
    { value: "ONLINE", label: t("packages.items.deliveryType.ONLINE") },
  ]
  const fixedSelector = (props: {
    id: string
    label: string
    scope: ScopeFormData
    options: MultiSelectOption[]
    placeholder: string
    searchPlaceholder: string
    emptyLabel: string
    error?: string
    onChange: (next: string[]) => void
  }) => (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{props.label}</span>
      <MultiSelect
        id={props.id}
        options={props.options}
        value={props.scope.mode === "INCLUDE" ? props.scope.ids.slice(0, 1) : []}
        onChange={(next) => props.onChange(next.slice(-1))}
        placeholder={props.placeholder}
        searchPlaceholder={props.searchPlaceholder}
        emptyLabel={props.emptyLabel}
        ariaInvalid={!!props.error}
      />
      {props.error && <p role="alert" className="text-xs text-destructive">{props.error}</p>}
    </div>
  )
  return (
    <>
      <button type="button" className="self-start text-xs font-medium text-muted-foreground underline-offset-4 hover:underline" onClick={onToggleAdvanced} aria-expanded={advancedRules}>
        {advancedRules ? t("packages.items.hideAdvanced") : t("packages.items.showAdvanced")}
      </button>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Controller control={control} name={paths.service} render={() => fixed && !serviceIsComplex && !advancedRules ? fixedSelector({
          id: paths.service,
          label: t("packages.items.service"),
          scope: service,
          options: serviceOptionsForFixed,
          placeholder: t("packages.items.servicePlaceholder"),
          searchPlaceholder: t("packages.scope.searchServices"),
          emptyLabel: t("packages.scope.noServices"),
          error: itemError?.service?.ids?.message ? t(itemError.service.ids.message) : undefined,
          onChange: (next) => setScope(paths.service)({ mode: "INCLUDE", ids: next }),
        }) : <ScopeControl id={paths.service} label={t("packages.items.service")} mode={service.mode} ids={service.ids} onChange={setScope(paths.service)} options={serviceOptions} selectPlaceholder={t("packages.items.servicePlaceholder")} searchPlaceholder={t("packages.scope.searchServices")} emptyLabel={t("packages.scope.noServices")} allowExclude={advancedRules} error={itemError?.service?.ids?.message ? t(itemError.service.ids.message) : undefined} />} />
        {ownerEmployeeId && !(advancedRules && practitionerIsComplex) ? (
          <div className="flex flex-col gap-1.5"><span className="text-sm font-medium">{t("packages.owner.inheritedLabel")}</span><div className="rounded-md border border-border bg-surface-muted px-3 py-2 text-sm text-muted-foreground">{t("packages.owner.inheritedHint")}</div></div>
        ) : (
          <Controller control={control} name={paths.practitioner} render={() => fixed && !practitionerIsComplex && !advancedRules ? fixedSelector({
            id: paths.practitioner,
            label: t("packages.items.employee"),
            scope: practitioner,
            options: practitionerOptionsForFixed,
            placeholder: t("packages.items.employeePlaceholder"),
            searchPlaceholder: t("packages.scope.searchPractitioners"),
            emptyLabel: t("packages.scope.noPractitioners"),
            error: itemError?.practitioner?.ids?.message ? t(itemError.practitioner.ids.message) : undefined,
            onChange: (next) => setScope(paths.practitioner)({ mode: "INCLUDE", ids: next }),
          }) : <ScopeControl id={paths.practitioner} label={t("packages.items.employee")} mode={practitioner.mode} ids={practitioner.ids} onChange={setScope(paths.practitioner)} options={practitionerOptions} selectPlaceholder={t("packages.items.employeePlaceholder")} searchPlaceholder={t("packages.scope.searchPractitioners")} emptyLabel={t("packages.scope.noPractitioners")} allowExclude={advancedRules} error={itemError?.practitioner?.ids?.message ? t(itemError.practitioner.ids.message) : undefined} />} />
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {(showDuration || advancedRules) && <Controller control={control} name={paths.duration} render={() => fixed && !durationIsComplex && !advancedRules ? (
          <DurationSelect id={paths.duration} selectedId={duration.ids[0]} choices={durationChoices} onChange={setScope(paths.duration)} error={itemError?.duration?.ids?.message ? t(itemError.duration.ids.message) : undefined} />
        ) : <ScopeControl id={paths.duration} label={t("packages.items.duration")} mode={duration.mode} ids={duration.ids} onChange={setScope(paths.duration)} options={durationOptions} selectPlaceholder={t("packages.items.durationPlaceholder")} searchPlaceholder={t("packages.scope.searchDurations")} emptyLabel={t("packages.items.durationUnavailable")} allowExclude={advancedRules} error={itemError?.duration?.ids?.message ? t(itemError.duration.ids.message) : undefined} />} />}
        <Controller control={control} name={paths.delivery} render={() => advancedRules && deliveryIsComplex ? <ScopeControl id={paths.delivery} label={t("packages.items.deliveryLabel")} mode={delivery.mode} ids={delivery.ids} onChange={setScope(paths.delivery)} options={deliveryOptions} selectPlaceholder={t("packages.scope.include")} searchPlaceholder={t("packages.scope.searchServices")} emptyLabel={t("packages.scope.noServices")} allowExclude error={itemError?.delivery?.ids?.message ? t(itemError.delivery.ids.message) : undefined} /> : <DeliveryControl scope={delivery} onChange={setScope(paths.delivery)} error={itemError?.delivery?.ids?.message ? t(itemError.delivery.ids.message) : undefined} />} />
      </div>
    </>
  )
}

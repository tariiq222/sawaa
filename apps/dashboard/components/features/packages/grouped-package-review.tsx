"use client"

import type { UseFormReturn } from "react-hook-form"
import { FormSection } from "@/components/features/shared/form-section"
import { useLocale } from "@/components/locale-provider"
import { useAllServices, useServiceEmployees } from "@/hooks/use-services"
import { serviceOptionLabel } from "./service-option-label"
import { packageEmployeeLabel } from "@/lib/package-editor-labels"
import { formatPrice } from "@/lib/money"
import type { GroupedPackageFormData } from "@/lib/schemas/package-groups.schema"

type Preview = { subtotal: number; discountAmount: number; amountPaid: number; prices: number[]; sessionNet: number[]; valid: boolean }

export function GroupedPackageReview({ form, preview }: { form: UseFormReturn<GroupedPackageFormData>; preview: Preview }) {
  const { t, locale } = useLocale()
  const value = form.watch()
  return <FormSection title={t("packages.grouped.review.title")} description={t("packages.grouped.review.description")}>
    <div className="flex flex-col gap-4">
      <div><h3 className="font-semibold">{value.nameAr}</h3>{value.nameEn && <p className="text-sm text-muted-foreground" dir="ltr">{value.nameEn}</p>}{value.descriptionAr && <p className="mt-2 text-sm text-muted-foreground">{value.descriptionAr}</p>}</div>
      {value.groups.map((group, groupIndex) => {
        const start = value.groups.slice(0, groupIndex).reduce((total, previous) => total + previous.sessions.length, 0)
        return <ReviewGroup key={group.key} group={group} groupIndex={groupIndex} allGroups={value.groups} preview={preview} startPriceIndex={start} locale={locale} t={t} />
      })}
      <div className="flex flex-wrap justify-end gap-6 border-t border-border pt-4 text-sm"><span>{t("packages.summary.subtotal")}: <strong>{formatPrice(preview.subtotal, { locale })}</strong></span><span>{t("packages.summary.discount")}: <strong>{formatPrice(preview.discountAmount, { locale })}</strong></span><span>{t("packages.summary.finalPrice")}: <strong>{formatPrice(preview.amountPaid, { locale })}</strong></span></div>
    </div>
  </FormSection>
}

function ReviewGroup({ group, groupIndex, allGroups, preview, startPriceIndex, locale, t }: { group: GroupedPackageFormData["groups"][number]; groupIndex: number; allGroups: GroupedPackageFormData["groups"]; preview: Preview; startPriceIndex: number; locale: "ar" | "en"; t: (key: string) => string }) {
  const { data: services = [] } = useAllServices()
  const { data: employees = [] } = useServiceEmployees(group.serviceId)
  const service = services.find((item) => item.id === group.serviceId)
  const practitioner = employees.find((entry) => entry.employee.id === group.employeeId)?.employee
  const durationChoices = employees.find((entry) => entry.employee.id === group.employeeId)?.effectiveDurations?.flatMap((durationGroup) => durationGroup.durations) ?? []
  const dependency = allGroups.find((candidate) => candidate.key === group.dependsOnGroupKey)
  return <div className="rounded-xl border border-border p-4"><div className="flex flex-wrap items-baseline justify-between gap-2"><h4 className="font-medium">{group.label || `${t("packages.grouped.groups.groupNumber")} ${groupIndex + 1}`}</h4><span className="text-xs text-muted-foreground">{group.sequenceMode === "ORDERED" ? t("packages.grouped.sequence.ORDERED") : t("packages.grouped.sequence.UNORDERED")}{dependency ? ` · ${t("packages.grouped.review.after")} ${dependency.label || `${t("packages.grouped.groups.groupNumber")} ${allGroups.indexOf(dependency) + 1}`}` : ""}</span></div><p className="mt-2 text-sm text-muted-foreground">{service ? serviceOptionLabel(service, locale) : t("packages.grouped.groups.service")} · {practitioner ? packageEmployeeLabel(practitioner, t("packages.review.unavailable")) : t("packages.grouped.groups.practitioner")}</p><div className="mt-3 flex flex-col gap-2">{group.sessions.map((session, sessionIndex) => { const duration = durationChoices.find((choice) => choice.id === session.durationOptionId); const durationLabel = duration ? locale === "ar" ? duration.labelAr : duration.label : t("packages.grouped.duration"); const durationSummary = duration && durationLabel.includes(String(duration.durationMins)) ? durationLabel : `${durationLabel} · ${duration?.durationMins ?? "—"} ${t("common.min")}`; const net = preview.sessionNet[startPriceIndex + sessionIndex] ?? 0; return <div key={session.key} className="flex flex-wrap justify-between gap-2 text-sm"><span>{t("packages.grouped.session")} {sessionIndex + 1} · {durationSummary} · {t(`packages.items.deliveryType.${session.deliveryType}`)}</span><span className="tabular-nums">{formatPrice(net, { locale })} {locale === "ar" ? "ر.س" : "SAR"}</span></div> })}</div></div>
}

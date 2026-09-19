"use client"

import type { UseFormReturn } from "react-hook-form"
import { FormSection } from "@/components/features/shared/form-section"
import { useLocale } from "@/components/locale-provider"
import { useAllEmployees } from "@/hooks/use-employees"
import { useAllServices } from "@/hooks/use-services"
import { formatPrice } from "@/lib/money"
import type { PackageFormData } from "@/lib/schemas/package.schema"
import type { PackagePriceBreakdown } from "@/lib/types/package"
import type { PackageLineDetail } from "./package-item-builder"
import { serviceOptionLabel } from "./service-option-label"
import { packageEmployeeLabel } from "@/lib/package-editor-labels"

interface Props {
  form: UseFormReturn<PackageFormData>
  breakdown: PackagePriceBreakdown
  lineItems: PackageLineDetail[]
}

export function PackageReview({ form, breakdown, lineItems }: Props) {
  const { t, locale } = useLocale()
  const { employees } = useAllEmployees()
  const { data: services = [] } = useAllServices()
  const values = form.getValues()
  const items = values.items ?? []
  const owner = employees.find(
    (employee) => employee.id === values.ownerEmployeeId
  )
  const unavailable = t("packages.review.unavailable")
  const ownerName = owner
    ? packageEmployeeLabel(owner, unavailable)
    : values.ownerEmployeeId
      ? unavailable
      : t("packages.owner.general")
  return (
    <div className="flex flex-col gap-4">
      <FormSection
        title={t("packages.review.title")}
        description={t("packages.review.description")}
      >
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">
              {t("packages.create.nameAr")}
            </dt>
            <dd className="font-medium" dir="rtl">
              {values.nameAr || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              {t("packages.owner.label")}
            </dt>
            <dd className="font-medium">{ownerName}</dd>
          </div>
        </dl>
      </FormSection>
      <FormSection title={t("packages.section.items")}>
        <div className="flex flex-col gap-2">
          {items.map((item, index) => {
            const detail = lineItems[index]
            const fixed =
              item.selectionMode === "FIXED" ||
              (item.selectionMode == null &&
                item.service.mode === "INCLUDE" &&
                item.service.ids.length === 1 &&
                item.practitioner.mode === "INCLUDE" &&
                item.practitioner.ids.length === 1 &&
                item.duration.mode === "INCLUDE" &&
                item.duration.ids.length === 1)
            const mode = fixed
              ? t("packages.items.selectionMode.FIXED")
              : t("packages.items.selectionMode.FLEXIBLE")
            const total = item.paidQuantity + item.freeQuantity
            const serviceNames = item.service.ids
              .map((id) => {
                const service = services.find((entry) => entry.id === id)
                return service
                  ? serviceOptionLabel(service, locale)
                  : unavailable
              })
              .join("، ")
            const practitionerNames = item.practitioner.ids
              .map((id) => {
                const employee = employees.find((entry) => entry.id === id)
                return employee
                  ? packageEmployeeLabel(employee, unavailable)
                  : unavailable
              })
              .join("، ")
            const durationNames = item.duration.ids.map((id) => {
              const choice = detail?.durations?.find((entry) => entry.id === id)
              return choice
                ? `${t(`packages.items.deliveryType.${choice.deliveryType}`)} · ${choice.durationMins} ${t("common.min")}`
                : unavailable
            }).join("، ")
            const deliveryNames = item.delivery.ids
              .map((id) => t(`packages.items.deliveryType.${id}`))
              .join("، ")
            const service = formatScope(
              item.service,
              serviceNames,
              t("packages.summary.anyService"),
              t("packages.review.only"),
              t("packages.review.except"),
              unavailable
            )
            const practitioner = formatScope(
              item.practitioner,
              practitionerNames,
              t("packages.summary.anyPractitioner"),
              t("packages.review.only"),
              t("packages.review.except"),
              unavailable
            )
            const duration = formatScope(
              item.duration,
              durationNames,
              t("packages.scope.any"),
              t("packages.review.only"),
              t("packages.review.except"),
              unavailable
            )
            const delivery = formatScope(
              item.delivery,
              deliveryNames,
              t("packages.scope.any"),
              t("packages.review.only"),
              t("packages.review.except"),
              unavailable
            )
            return (
              <div
                key={index}
                className="rounded-md border border-border bg-surface p-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {t("packages.items.itemNumber")} {index + 1} · {mode}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {total} {t("packages.summary.sessions")}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("packages.items.service")}: {service} ·{" "}
                  {t("packages.items.employee")}: {practitioner} ·{" "}
                  {t("packages.items.duration")}: {duration} ·{" "}
                  {t("packages.items.deliveryLabel")}: {delivery}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("packages.items.paidQuantity")}: {item.paidQuantity} ·{" "}
                  {t("packages.items.freeQuantity")}: {item.freeQuantity} ·{" "}
                  {t("packages.items.unitPrice")}:{" "}
                  {detail?.pricePending
                    ? t("common.loading")
                    : detail?.priceAvailable === false
                      ? unavailable
                      : formatPrice(detail?.unitPrice ?? 0)}{" "}
                  · {t("packages.summary.discount")}:{" "}
                  {formatPrice(detail?.discountAmount ?? 0)} ·{" "}
                  {t("packages.summary.finalPrice")}:{" "}
                  {detail?.pricePending
                    ? t("common.loading")
                    : detail?.priceAvailable === false
                      ? unavailable
                      : formatPrice(detail?.net ?? 0)}
                </p>
              </div>
            )
          })}
        </div>
      </FormSection>
      <FormSection title={t("packages.summary.finalPrice")}>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Summary
            label={t("packages.summary.sessions")}
            value={String(
              items.reduce(
                (sum, item) => sum + item.paidQuantity + item.freeQuantity,
                0
              )
            )}
          />
          <Summary
            label={t("packages.summary.freeTotal")}
            value={formatPrice(breakdown.freeValue)}
          />
          <Summary
            label={t("packages.summary.discount")}
            value={formatPrice(breakdown.discountAmount)}
          />
          <Summary
            label={t("packages.summary.finalPrice")}
            value={formatPrice(breakdown.finalPrice)}
            strong
          />
        </div>
      </FormSection>
    </div>
  )
}

function formatScope(
  scope: { mode: "ANY" | "INCLUDE" | "EXCLUDE"; ids: string[] },
  names: string,
  anyLabel: string,
  only: string,
  except: string,
  unavailable: string
) {
  if (scope.mode === "ANY") return anyLabel
  return `${scope.mode === "EXCLUDE" ? except : only}: ${names || unavailable}`
}
function Summary({
  label,
  value,
  strong = false,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={strong ? "font-semibold tabular-nums" : "tabular-nums"}>
        {value}
      </p>
    </div>
  )
}

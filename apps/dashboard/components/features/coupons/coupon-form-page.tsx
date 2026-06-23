"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { showApiError } from "@/lib/mutation-helpers"
import { useQuery } from "@tanstack/react-query"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { Button } from "@sawaa/ui"
import { Skeleton } from "@sawaa/ui"
import { useCouponMutations } from "@/hooks/use-coupons"
import { useLocale } from "@/components/locale-provider"
import { fetchCoupon } from "@/lib/api/coupons"
import { queryKeys } from "@/lib/query-keys"
import { formatDateTimeLocalValue } from "@/lib/date"
import { CouponFormFields } from "./coupon-form-fields"
import { sarToHalalas, halalasToSarNumber } from "@/lib/money"
import { couponSchema, type CouponFormData } from "@/lib/schemas/coupon.schema"

/* ─── Types ─── */

type Props =
  | { mode: "create" }
  | { mode: "edit"; couponId: string }

const DEFAULT_VALUES: CouponFormData = {
  code: "", descriptionEn: "", descriptionAr: "",
  discountType: "PERCENTAGE", discountValue: 10,
  minOrderAmt: "", maxUses: "", maxUsesPerUser: "", expiresAt: "", isActive: true,
}

/* ─── Helpers ─── */

// FIXED coupons store discountValue in halalas; PERCENTAGE stores a raw
// percent (0-100) and must never be converted.
function toDisplayValue(value: number, type: "PERCENTAGE" | "FIXED") {
  return type === "FIXED" ? halalasToSarNumber(value) : value
}

function toStorageValue(value: number, type: "PERCENTAGE" | "FIXED") {
  return type === "FIXED" ? sarToHalalas(value) : value
}

// minOrderAmt is stored in halalas; the form collects SAR.
export function toDisplayMinOrderAmt(value: number | null | undefined): number | "" {
  if (value == null) return ""
  return halalasToSarNumber(value)
}

export function toStorageMinOrderAmt(value: number | "" | undefined): number | undefined {
  if (value === "" || value == null) return undefined
  return sarToHalalas(value)
}

/* ─── Coupon Form Page ─── */

export function CouponFormPage(props: Props) {
  const isEdit = props.mode === "edit"
  const couponId = isEdit ? props.couponId : undefined

  const router = useRouter()
  const { t } = useLocale()
  const { createMut, updateMut } = useCouponMutations()
  const isPending = isEdit ? updateMut.isPending : createMut.isPending

  const { data: coupon, isLoading } = useQuery({
    queryKey: queryKeys.coupons.detail(couponId ?? ""),
    queryFn: () => fetchCoupon(couponId!),
    enabled: isEdit,
  })

  const form = useForm<CouponFormData>({
    resolver: zodResolver(couponSchema),
    defaultValues: DEFAULT_VALUES,
  })

  useEffect(() => {
    if (!coupon) return
    form.reset({
      code: coupon.code,
      descriptionEn: coupon.descriptionEn ?? "",
      descriptionAr: coupon.descriptionAr ?? "",
      discountType: coupon.discountType as "PERCENTAGE" | "FIXED",
      discountValue: toDisplayValue(coupon.discountValue, coupon.discountType as "PERCENTAGE" | "FIXED"),
      minOrderAmt: toDisplayMinOrderAmt(coupon.minOrderAmt),
      maxUses: coupon.maxUses ?? "",
      maxUsesPerUser: coupon.maxUsesPerUser ?? "",
      expiresAt: formatDateTimeLocalValue(coupon.expiresAt),
      isActive: coupon.isActive,
    })
  }, [coupon, form])

  const onSubmit = form.handleSubmit(async (data) => {
    const payload = {
      descriptionEn: data.descriptionEn || undefined,
      descriptionAr: data.descriptionAr || undefined,
      discountType: data.discountType,
      discountValue: toStorageValue(data.discountValue, data.discountType),
      minOrderAmt: toStorageMinOrderAmt(data.minOrderAmt),
      maxUses: data.maxUses !== "" && data.maxUses !== undefined ? Number(data.maxUses) : undefined,
      maxUsesPerUser: data.maxUsesPerUser !== "" && data.maxUsesPerUser !== undefined ? Number(data.maxUsesPerUser) : undefined,
      expiresAt: data.expiresAt || undefined,
      isActive: data.isActive,
    }
    try {
      if (isEdit) {
        // code is immutable on update — omit it from the payload.
        await updateMut.mutateAsync({ id: coupon!.id, ...payload })
        toast.success(t("coupons.edit.success"))
      } else {
        await createMut.mutateAsync({ code: data.code.toUpperCase(), ...payload })
        toast.success(t("coupons.create.success"))
      }
      router.push("/coupons")
    } catch (err) {
      showApiError(err, { fallback: t(isEdit ? "coupons.edit.error" : "coupons.create.error"), t })
    }
  })

  if (isEdit && isLoading) {
    return (
      <ListPageShell>
        <Skeleton className="h-8 w-48" />
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={`skeleton-${i}`} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      </ListPageShell>
    )
  }

  const title = isEdit ? t("coupons.edit.title") : t("coupons.create.title")
  const description = isEdit ? (coupon?.code ?? "") : t("coupons.create.description")
  const submitLabel = isPending
    ? t(isEdit ? "coupons.edit.submitting" : "coupons.create.submitting")
    : t(isEdit ? "coupons.edit.submit" : "coupons.create.submit")

  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader title={title} description={description} />
      <form onSubmit={onSubmit} className="flex flex-col gap-6 pb-24">
        <CouponFormFields form={form} isEdit={isEdit} mode={props.mode} />
        <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-6 border-t border-border bg-background px-4 sm:px-6 py-3 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" size="lg" className="rounded-lg" onClick={() => router.push("/coupons")}>
            {t(isEdit ? "coupons.edit.cancel" : "coupons.create.cancel")}
          </Button>
          <Button type="submit" size="lg" className="rounded-lg" disabled={isPending}>{submitLabel}</Button>
        </div>
      </form>
    </ListPageShell>
  )
}

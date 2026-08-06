"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { fetchCoupon } from "@/lib/api/coupons"
import { PermissionGuard } from "@/components/features/permission-guard"
import { useLocale } from "@/components/locale-provider"

export default function CouponDetailRoute() {
  return (
    <PermissionGuard module="coupon" action="read">
      <CouponDetailInner />
    </PermissionGuard>
  )
}

function CouponDetailInner() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { t } = useLocale()
  const { data: coupon, isLoading, error } = useQuery({
    queryKey: queryKeys.coupons.detail(id ?? ""),
    queryFn: () => fetchCoupon(id!),
    enabled: !!id,
  })

  useEffect(() => {
    if (!isLoading && !error && coupon) {
      router.replace(`/coupons/${id}/edit`)
    }
  }, [coupon, isLoading, error, id, router])

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">{t("common.loading")}…</div>
  }

  return (
    <div className="p-6">
      <p className="text-muted-foreground">{t("common.redirectingToEdit")}</p>
    </div>
  )
}

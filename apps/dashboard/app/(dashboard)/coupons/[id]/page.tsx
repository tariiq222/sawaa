"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { fetchCoupon } from "@/lib/api/coupons"

export default function CouponDetailRoute() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
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
    return <div className="p-6 text-muted-foreground">Loading…</div>
  }

  return (
    <div className="p-6">
      <p className="text-muted-foreground">
        Detail view not yet implemented for coupons. Redirecting to edit…
      </p>
    </div>
  )
}
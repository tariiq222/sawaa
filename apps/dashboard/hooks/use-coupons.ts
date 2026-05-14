"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState, useCallback } from "react"
import { queryKeys } from "@/lib/query-keys"
import {
  fetchCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} from "@/lib/api/coupons"
import type { CouponListQuery } from "@/lib/types/coupon"

/* ─── Coupons List ─── */

export function useCoupons() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<string | undefined>()

  const query: CouponListQuery = {
    page,
    perPage: 20,
    search: search || undefined,
    status: status as CouponListQuery["status"],
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.coupons.list(query),
    queryFn: () => fetchCoupons(query),
  })

  const resetFilters = useCallback(() => {
    setSearch("")
    setStatus(undefined)
    setPage(1)
  }, [])

  return {
    coupons: data?.items ?? [],
    meta: data?.meta ?? null,
    isLoading,
    error: error?.message ?? null,
    page,
    setPage,
    search,
    setSearch: (s: string) => { setSearch(s); setPage(1) },
    status,
    setStatus: (s: string | undefined) => { setStatus(s); setPage(1) },
    resetFilters,
    refetch,
  }
}

/* ─── Coupon Mutations ─── */

export function useCouponMutations() {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.coupons.all })

  const createMut = useMutation({
    mutationFn: createCoupon,
    onSuccess: invalidate,
  })

  const updateMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof updateCoupon>[1]) =>
      updateCoupon(id, payload),
    onSuccess: invalidate,
  })

  const deleteMut = useMutation({
    mutationFn: deleteCoupon,
    onSuccess: invalidate,
  })

  return { createMut, updateMut, deleteMut }
}

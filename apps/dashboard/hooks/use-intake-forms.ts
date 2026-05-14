"use client"

import { useState, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { queryKeys } from "@/lib/query-keys"
import {
  fetchIntakeForms,
  fetchIntakeForm,
  createIntakeForm,
  updateIntakeForm,
  deleteIntakeForm,
  setIntakeFields,
} from "@/lib/api/intake-forms"
import type {
  IntakeFormListQuery,
  CreateIntakeFormApiPayload,
  UpdateIntakeFormApiPayload,
  SetFieldsApiPayload,
} from "@/lib/types/intake-form-api"

/* ─── List Hook ─── */

/* ─── URL-driven filter helpers ─── */

function parseBool(value: string | null): boolean | undefined {
  if (value === "true") return true
  if (value === "false") return false
  return undefined
}

function updateParams(
  router: ReturnType<typeof useRouter>,
  pathname: string,
  searchParams: ReturnType<typeof useSearchParams>,
  updates: Record<string, string | null>
) {
  const params = new URLSearchParams(searchParams.toString())
  for (const [key, val] of Object.entries(updates)) {
    if (val == null || val === "") params.delete(key)
    else params.set(key, val)
  }
  router.push(`${pathname}?${params.toString()}`)
}

export function useIntakeForms(initialQuery?: IntakeFormListQuery) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const urlSearch = searchParams.get("search") ?? ""
  const urlIsActive = parseBool(searchParams.get("isActive"))
  const urlPage = Number(searchParams.get("page") ?? "1") || 1

  const setSearch = useCallback(
    (value: string) =>
      updateParams(router, pathname, searchParams, {
        search: value || null,
        page: value ? "1" : null,
      }),
    [router, pathname, searchParams]
  )

  const setIsActive = useCallback(
    (value: boolean | undefined) =>
      updateParams(router, pathname, searchParams, {
        isActive: value == null ? null : String(value),
        page: "1",
      }),
    [router, pathname, searchParams]
  )

  const setPage = useCallback(
    (page: number) =>
      updateParams(router, pathname, searchParams, { page: String(page) }),
    [router, pathname, searchParams]
  )

  const resetFilters = useCallback(() => {
    updateParams(router, pathname, searchParams, {
      search: null,
      isActive: null,
      page: null,
    })
  }, [router, pathname, searchParams])

  const query: IntakeFormListQuery = {
    ...(initialQuery ?? {}),
    ...(urlIsActive !== undefined ? { isActive: urlIsActive } : {}),
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.intakeForms.list(query),
    queryFn: () => fetchIntakeForms(query),
    placeholderData: (prev) => prev,
    staleTime: 5 * 60 * 1000,
  })

  return {
    forms: data ?? [],
    meta: null,
    isLoading,
    error: error?.message ?? null,
    search: urlSearch,
    setSearch,
    isActive: urlIsActive,
    setIsActive,
    page: urlPage,
    setPage,
    hasFilters: !!(urlSearch || urlIsActive !== undefined),
    resetFilters,
    // Backward compat — no-op since migration to URL-driven state
    setQuery: (_q: IntakeFormListQuery) => {
      console.warn(
        "[useIntakeForms] setQuery is deprecated — state is now URL-driven"
      )
    },
  }
}

/* ─── Detail Hook ─── */

export function useIntakeForm(formId: string | null) {
  return useQuery({
    queryKey: queryKeys.intakeForms.detail(formId ?? ""),
    queryFn: () => fetchIntakeForm(formId!),
    enabled: !!formId,
  })
}

/* ─── Mutations Hook ─── */

export function useIntakeFormMutations() {
  const queryClient = useQueryClient()

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.intakeForms.all })

  const createMut = useMutation({
    mutationFn: (payload: CreateIntakeFormApiPayload) =>
      createIntakeForm(payload),
    onSuccess: invalidate,
  })

  const updateMut = useMutation({
    mutationFn: ({
      formId,
      payload,
    }: {
      formId: string
      payload: UpdateIntakeFormApiPayload
    }) => updateIntakeForm(formId, payload),
    onSuccess: invalidate,
  })

  const deleteMut = useMutation({
    mutationFn: (formId: string) => deleteIntakeForm(formId),
    onSuccess: invalidate,
  })

  const setFieldsMut = useMutation({
    mutationFn: ({
      formId,
      payload,
    }: {
      formId: string
      payload: SetFieldsApiPayload
    }) => setIntakeFields(formId, payload),
    onSuccess: (_, { formId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.intakeForms.detail(formId),
      })
      invalidate()
    },
  })

  return {
    create: createMut.mutate,
    createAsync: createMut.mutateAsync,
    createLoading: createMut.isPending,

    update: updateMut.mutate,
    updateAsync: updateMut.mutateAsync,
    updateLoading: updateMut.isPending,

    delete: deleteMut.mutate,
    deleteLoading: deleteMut.isPending,

    setFields: setFieldsMut.mutate,
    setFieldsAsync: setFieldsMut.mutateAsync,
    setFieldsLoading: setFieldsMut.isPending,
  }
}

"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useForm, type UseFormReturn } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { usePackage } from "@/hooks/use-packages"
import { useLocale } from "@/components/locale-provider"
import { groupedPackageSchema, type GroupedPackageFormData } from "@/lib/schemas/package-groups.schema"
import { groupedFormDefaults, groupedPricePreview } from "@/lib/package-groups-form"
import type { SessionPackage } from "@/lib/types/package"

export function usePackageGroupsEditor(
  packageId: string | null,
  initialPackage?: SessionPackage | null,
) {
  const { t } = useLocale()
  const query = usePackage(initialPackage ? null : packageId)
  const pkg = initialPackage ?? query.data
  const form = useForm<GroupedPackageFormData>({
    resolver: zodResolver(groupedPackageSchema),
    defaultValues: groupedFormDefaults(),
    mode: "onBlur",
  })
  const pendingAvatarFile = useRef<File | null>(null)
  const hydratedPackageId = useRef<string | null>(null)
  // Create mode only: the package this form already persisted (t8). A retry
  // after a failed image step must update it, never create a second package.
  const [createdId, setCreatedId] = useState<string | null>(null)

  useEffect(() => {
    if (!pkg || pkg.modelVersion !== "GROUPED_V2" || hydratedPackageId.current === pkg.id) return
    form.reset(groupedFormDefaults(pkg))
    hydratedPackageId.current = pkg.id
  }, [form, pkg])

  const onImageSelect = useCallback((file: File) => {
    pendingAvatarFile.current = file
  }, [])

  /** Clear/icon selection drops the staged file so it can never be uploaded (t12). */
  const onImageClear = useCallback(() => {
    pendingAvatarFile.current = null
  }, [])

  /** Remembers a freshly created package so a resubmit updates it (t8). */
  const markCreated = useCallback((id: string) => setCreatedId(id), [])

  const previewInput = form.watch(["groups", "globalDiscount"])
  const preview = useMemo(
    () => groupedPricePreview({ groups: previewInput[0] ?? [], globalDiscount: previewInput[1] ?? { type: "NONE", value: 0 } }),
    [previewInput],
  )

  return {
    t,
    pkg,
    createdId,
    isLoading: initialPackage ? false : query.isLoading,
    error: query.error,
    form,
    pendingAvatarFile,
    onImageSelect,
    onImageClear,
    markCreated,
    preview,
    translateError: (message?: string) => (message ? t(message) : undefined),
  }
}

export type PackageGroupsEditorState = ReturnType<typeof usePackageGroupsEditor>
export type PackageGroupsEditorForm = UseFormReturn<GroupedPackageFormData>

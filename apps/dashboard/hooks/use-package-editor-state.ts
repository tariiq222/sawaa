"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useForm, type UseFormReturn } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { usePackage } from "@/hooks/use-packages"
import { useLocale } from "@/components/locale-provider"
import { computePackagePrice } from "@/lib/package-price"
import {
  isSingleSpecificItem,
  itemToScopes,
  responseConstraintsToInputs,
} from "@/lib/package-scope"
import {
  editPackageSchema,
  type PackageFormData,
} from "@/lib/schemas/package.schema"
import { DEFAULT_PACKAGE_EDITOR_VALUES } from "@/lib/package-editor-defaults"
import type { PackageEditorLineDetail as PackageLineDetail } from "@/lib/package-editor-lines"
import type { PackagePriceBreakdown } from "@/lib/types/package"
import { prunePackageLineDetails } from "@/lib/package-editor-lines"

export function usePackageEditorState(packageId: string | null) {
  const { t } = useLocale()
  const { data: pkg, isLoading } = usePackage(packageId)
  const form = useForm<PackageFormData>({
    resolver: zodResolver(editPackageSchema),
    defaultValues: DEFAULT_PACKAGE_EDITOR_VALUES,
    mode: "onBlur",
  })
  const pendingAvatarFile = useRef<File | null>(null)
  const onImageSelect = useCallback((file: File) => {
    pendingAvatarFile.current = file
  }, [])
  const [lineDetails, setLineDetails] = useState<
    Record<number, PackageLineDetail>
  >({})

  useEffect(() => {
    if (!pkg) return
    form.reset({
      nameAr: pkg.nameAr,
      nameEn: pkg.nameEn ?? "",
      descriptionAr: pkg.descriptionAr ?? "",
      descriptionEn: pkg.descriptionEn ?? "",
      imageUrl: pkg.imageUrl ?? null,
      iconName: pkg.iconName ?? null,
      iconBgColor: pkg.iconBgColor ?? null,
      sortOrder: pkg.sortOrder,
      isActive: pkg.isActive,
      isPublic: pkg.isPublic,
      ownerEmployeeId: pkg.ownerEmployeeId ?? null,
      ownerChangeRevision: 0,
      items: pkg.items.map((it) => {
        const scopes = itemToScopes(it)
        return {
          ...scopes,
          selectionMode: isSingleSpecificItem(scopes) ? "FIXED" : "FLEXIBLE",
          unitPriceSar:
            it.unitPrice != null ? Number(it.unitPrice) / 100 : undefined,
          hasUnitPriceOverride: it.unitPrice != null,
          originalConstraints: responseConstraintsToInputs(it.constraints),
          label: it.label ?? "",
          paidQuantity: it.paidQuantity,
          freeQuantity: it.freeQuantity,
          discountType: it.discountType ?? null,
          discountValue:
            it.discountType === "FIXED"
              ? Number(it.discountValue) / 100
              : Number(it.discountValue ?? 0),
          sortOrder: it.sortOrder,
        }
      }),
    })
  }, [pkg, form])

  const onLineChange = useCallback(
    (index: number, detail: PackageLineDetail) => {
      setLineDetails((previous) => {
        const current = previous[index]
        if (current && JSON.stringify(current) === JSON.stringify(detail))
          return previous
        return { ...previous, [index]: detail }
      })
    },
    []
  )
  const itemCount = (form.watch("items") ?? []).length
  useEffect(() => {
    setLineDetails((previous) => {
      const next = prunePackageLineDetails(previous, itemCount)
      return Object.keys(next).length === Object.keys(previous).length
        ? previous
        : next
    })
  }, [itemCount])
  const lineItems = Object.keys(lineDetails)
    .map(Number)
    .sort((a, b) => a - b)
    .map((index) => lineDetails[index])
  const breakdown = computePackagePrice(lineItems)

  return {
    t,
    pkg,
    isLoading,
    form,
    pendingAvatarFile,
    onImageSelect,
    onLineChange,
    lineItems,
    breakdown,
    translateError: (message?: string) => (message ? t(message) : undefined),
  }
}

export type PackageEditorState = ReturnType<typeof usePackageEditorState>
export type PackageEditorForm = UseFormReturn<PackageFormData>
export type PackageEditorBreakdown = PackagePriceBreakdown

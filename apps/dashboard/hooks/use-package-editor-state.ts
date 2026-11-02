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
  /** Clear/icon selection drops the staged file so it can never be uploaded (t12). */
  const onImageClear = useCallback(() => {
    pendingAvatarFile.current = null
  }, [])
  const [lineDetails, setLineDetails] = useState<
    Record<number, PackageLineDetail>
  >({})
  // Which package the form has already been hydrated from. The signed-image
  // policy refetches the detail query every ~4 minutes and each response is a
  // brand-new object, so an identity-based reset would wipe unsaved edits.
  const hydratedPackageId = useRef<string | null>(null)

  useEffect(() => {
    if (!pkg) return
    if (hydratedPackageId.current === pkg.id) {
      // Same package, fresh response (presigned URL rotation): refresh only
      // the image link and leave every edited field and lineDetails intact —
      // but never overwrite an image the user owns (t14). A staged file, a
      // local blob preview, or an explicit removal must survive the rotation,
      // otherwise the submit handler sees a server URL and uploads nothing,
      // silently saving the package without the picture the user picked.
      const formImageUrl = form.getValues("imageUrl")
      const userOwnsImage =
        pendingAvatarFile.current !== null ||
        formImageUrl === null ||
        !!formImageUrl?.startsWith("blob:")
      if (!userOwnsImage) {
        form.setValue("imageUrl", pkg.imageUrl ?? null, {
          shouldDirty: false,
          shouldTouch: false,
          shouldValidate: false,
        })
      }
      return
    }
    hydratedPackageId.current = pkg.id
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
    onImageClear,
    onLineChange,
    lineItems,
    breakdown,
    translateError: (message?: string) => (message ? t(message) : undefined),
  }
}

export type PackageEditorState = ReturnType<typeof usePackageEditorState>
export type PackageEditorForm = UseFormReturn<PackageFormData>
export type PackageEditorBreakdown = PackagePriceBreakdown

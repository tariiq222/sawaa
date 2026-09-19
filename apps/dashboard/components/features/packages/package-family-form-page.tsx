"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { ErrorBanner } from "@/components/features/error-banner"
import { useLocale } from "@/components/locale-provider"
import { usePackageFamily, usePackageFamilyMutations } from "@/hooks/use-package-families"
import type { PackageFamily, PackageFamilyInput } from "@sawaa/shared/types"
import { PackageFamilyEditor } from "./package-family-editor"

type Props = { mode: "create" } | { mode: "edit"; familyId: string }

export function PackageFamilyFormPage(props: Props) {
  const { t } = useLocale()
  const router = useRouter()
  const isEdit = props.mode === "edit"
  const familyQuery = usePackageFamily(isEdit ? props.familyId : null)
  const { createMut, updateMut } = usePackageFamilyMutations()
  const family = isEdit ? familyQuery.data : undefined
  const pending = createMut.isPending || updateMut.isPending

  if (isEdit && familyQuery.isError) return <ErrorBanner message={t("common.errorLoading")} onRetry={() => familyQuery.refetch()} />
  if (isEdit && (familyQuery.isLoading || !family)) return <div className="p-6 text-muted-foreground">{t("common.loading")}</div>

  const initialValue = family ? toInput(family) : emptyFamily()
  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader title={t(isEdit ? "packages.family.editTitle" : "packages.family.createTitle")} description={t(isEdit ? "packages.family.editDescription" : "packages.family.createDescription")} />
      <PackageFamilyEditor
        initialValue={initialValue}
        onCancel={() => router.push("/packages")}
        onSubmit={async (input) => {
          try {
            if (isEdit) await updateMut.mutateAsync({ id: props.familyId, input })
            else await createMut.mutateAsync(input)
            toast.success(t(isEdit ? "packages.family.editSuccess" : "packages.family.createSuccess"))
            router.push("/packages")
          } catch {
            toast.error(t("packages.family.saveError"))
          }
        }}
      />
      {pending && <p className="sr-only" aria-live="polite">{t("packages.family.saving")}</p>}
    </ListPageShell>
  )
}

function emptyFamily(): PackageFamilyInput {
  return { nameAr: "", nameEn: "", descriptionAr: "", descriptionEn: "", imageUrl: null, isActive: true, isPublic: false, sortOrder: 0, options: [] }
}

function toInput(family: PackageFamily): PackageFamilyInput {
  return {
    nameAr: family.nameAr,
    nameEn: family.nameEn,
    descriptionAr: family.descriptionAr,
    descriptionEn: family.descriptionEn,
    imageUrl: family.imageUrl,
    isActive: family.isActive,
    isPublic: family.isPublic,
    sortOrder: family.sortOrder,
    options: family.options.map((option) => ({
      id: option.id,
      nameAr: option.nameAr,
      nameEn: option.nameEn,
      isActive: option.isActive,
      isPublic: option.isPublic,
      groups: option.groups ?? [],
      globalDiscount: option.globalDiscount ?? { type: "NONE", value: 0 },
    })),
  }
}

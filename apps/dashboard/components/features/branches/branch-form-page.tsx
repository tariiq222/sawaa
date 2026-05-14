"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { useQuery } from "@tanstack/react-query"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { Button } from "@deqah/ui"
import { Skeleton } from "@deqah/ui"
import { useBranchMutations } from "@/hooks/use-branches"
import { useLocale } from "@/components/locale-provider"
import { fetchBranch } from "@/lib/api/branches"
import { queryKeys } from "@/lib/query-keys"
import { BranchFormFields } from "./branch-form-fields"
import { branchSchema, type BranchFormData } from "@/lib/schemas/branch.schema"

/* ─── Types ─── */

type Props =
  | { mode: "create" }
  | { mode: "edit"; branchId: string }

const DEFAULT_VALUES: BranchFormData = {
  nameAr: "", nameEn: "", address: "", phone: "",
  isMain: false, isActive: true, timezone: "Asia/Riyadh",
}

/* ─── Branch Form Page ─── */

export function BranchFormPage(props: Props) {
  const isEdit = props.mode === "edit"
  const branchId = isEdit ? props.branchId : undefined

  const router = useRouter()
  const { t } = useLocale()
  const { createMut, updateMut } = useBranchMutations()
  const isPending = isEdit ? updateMut.isPending : createMut.isPending

  const { data: branch, isLoading } = useQuery({
    queryKey: queryKeys.branches.detail(branchId ?? ""),
    queryFn: () => fetchBranch(branchId!),
    enabled: isEdit,
  })

  const form = useForm<BranchFormData>({
    resolver: zodResolver(branchSchema),
    defaultValues: DEFAULT_VALUES,
  })

  useEffect(() => {
    if (!branch) return
    form.reset({
      nameAr: branch.nameAr,
      nameEn: branch.nameEn,
      address: branch.addressAr ?? branch.addressEn ?? "",
      phone: branch.phone ?? "",
      isMain: branch.isMain ?? false,
      isActive: branch.isActive ?? true,
      timezone: branch.timezone ?? "Asia/Riyadh",
    })
  }, [branch, form])

  const onSubmit = form.handleSubmit(async (data) => {
    const payload = {
      nameAr: data.nameAr,
      nameEn: data.nameEn,
      // Single address field maps to both locale columns so they stay in sync
      addressAr: data.address || undefined,
      addressEn: data.address || undefined,
      phone: data.phone || undefined,
      isMain: data.isMain,
      isActive: data.isActive,
      timezone: data.timezone,
    }
    const createPayload = payload
    const updatePayload = payload
    try {
      if (isEdit) {
        await updateMut.mutateAsync({ id: branchId!, ...updatePayload })
        toast.success(t("branches.edit.success"))
      } else {
        await createMut.mutateAsync(createPayload)
        toast.success(t("branches.create.success"))
      }
      router.push("/branches")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t(isEdit ? "branches.edit.error" : "branches.create.error"))
    }
  })

  if (isEdit && isLoading) {
    return (
      <ListPageShell>
        <Skeleton className="h-8 w-48" />
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={`skeleton-${i}`} className="h-48 w-full rounded-xl" />)}
        </div>
      </ListPageShell>
    )
  }

  const title = isEdit ? t("branches.edit.title") : t("branches.create.title")
  const description = isEdit ? (branch ? `${branch.nameEn} / ${branch.nameAr}` : "") : t("branches.create.description")
  const submitLabel = isPending
    ? t(isEdit ? "branches.edit.submitting" : "branches.create.submitting")
    : t(isEdit ? "branches.edit.submit" : "branches.create.submit")

  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader title={title} description={description} />
      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <BranchFormFields form={form} isEdit={isEdit} mode={props.mode} />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.push("/branches")}>
            {t(isEdit ? "branches.edit.cancel" : "branches.create.cancel")}
          </Button>
          <Button type="submit" disabled={isPending}>{submitLabel}</Button>
        </div>
      </form>
    </ListPageShell>
  )
}

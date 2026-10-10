"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { FormProvider, type FieldErrors } from "react-hook-form"
import { toast } from "sonner"
import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { PackageEditorNavigation, PackageStepProgress } from "./package-editor-navigation"
import { GroupedPackageDetails } from "./grouped-package-details"
import { GroupedPackageGroups } from "./grouped-package-groups"
import { GroupedPackagePricing } from "./grouped-package-pricing"
import { GroupedPackageReview } from "./grouped-package-review"
import { usePackageGroupsEditor } from "@/hooks/use-package-groups-editor"
import { usePackageMutations } from "@/hooks/use-packages"
import { uploadPackageImage } from "@/lib/api/packages"
import { queryKeys } from "@/lib/query-keys"
import { groupedPackageSchema } from "@/lib/schemas/package-groups.schema"
import type { GroupedPackageFormData } from "@/lib/schemas/package-groups.schema"
import { buildGroupedPackagePayload, packageSubmitIssues } from "@/lib/package-groups-form"
import { collectPackageErrorPaths, focusPackageError } from "@/lib/package-validation"
import type { SessionPackage } from "@/lib/types/package"

type Props = { mode: "create"; packageId?: never; initialPackage?: null } | { mode: "edit"; packageId: string; initialPackage?: SessionPackage | null }
type Step = 1 | 2 | 3 | 4
const GROUPED_STEP_LABELS = ["packages.grouped.details.title", "packages.grouped.steps.groups", "packages.grouped.pricing.title", "packages.steps.review"] as const

export function GroupedPackageFormPage({ mode, packageId, initialPackage }: Props) {
  const isEdit = mode === "edit"
  const router = useRouter()
  const queryClient = useQueryClient()
  const state = usePackageGroupsEditor(isEdit ? packageId : null, initialPackage)
  const { createMut, updateMut } = usePackageMutations()
  const [step, setStep] = useState<Step>(1)
  const isPending = isEdit ? updateMut.isPending : createMut.isPending
  const focusLater = (path: string) => { if (typeof window !== "undefined") window.setTimeout(() => focusPackageError(path), 0) }
  const reportErrors = (paths: string[]) => { if (paths[0]) focusLater(paths[0]); toast.error(state.t("packages.errors.submitSummary")) }
  const onInvalid = (errors: FieldErrors<GroupedPackageFormData>) => reportErrors(collectPackageErrorPaths(errors))
  const nextStep = () => {
    const result = groupedPackageSchema.safeParse(state.form.getValues())
    if (!result.success) {
      const relevant = result.error.issues.filter((issue) => {
        const root = issue.path[0]
        if (step === 1) return root !== "groups" && root !== "globalDiscount"
        if (step === 2) return root === "groups"
        if (step === 3) return root === "groups" || root === "globalDiscount"
        return true
      }).sort((left, right) => validationIssueOrder(left.path) - validationIssueOrder(right.path))
      if (relevant.length) {
        state.form.clearErrors()
        relevant.forEach((issue) => {
          const path = issue.path.join(".") as never
          if (path) state.form.setError(path, { type: "manual", message: issue.message })
        })
        const first = relevant.map((issue) => issue.path.join(".")).find(Boolean) ?? ""
        if (first) {
          setStep(first.startsWith("name") || first.startsWith("description") ? 1 : first.startsWith("globalDiscount") ? 3 : 2)
          focusLater(first)
        }
        toast.error(state.t("packages.errors.stepSummary"))
        return
      }
    }
    if (step < 4) setStep((step + 1) as Step)
  }
  const onSubmit = state.form.handleSubmit(async (data) => {
    try {
      const payload = buildGroupedPackagePayload(data)
      if (isEdit && data.imageUrl === state.pkg?.imageUrl) delete payload.imageUrl
      let id: string
      if (isEdit) {
        if (!state.pkg) throw new Error("Package is unavailable")
        await updateMut.mutateAsync({ id: state.pkg.id, ...payload })
        id = state.pkg.id
        toast.success(state.t("packages.edit.success"))
      } else {
        const created = await createMut.mutateAsync(payload)
        id = created.id
        toast.success(state.t("packages.create.success"))
      }
      if (state.pendingAvatarFile.current) {
        try { await uploadPackageImage(id, state.pendingAvatarFile.current) } catch { toast.warning(state.t("packages.errors.uploadWarning")) } finally { state.pendingAvatarFile.current = null }
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.packages.all })
      router.push("/packages")
    } catch (error) {
      const issues = packageSubmitIssues(error)
      if (issues) {
        state.form.clearErrors()
        issues.forEach((issue) => { if (issue.path) state.form.setError(issue.path as never, { type: "manual", message: issue.message }) })
        const firstPath = issues.map((issue) => issue.path).find(Boolean) ?? ""
        if (firstPath) {
          setStep(firstPath.startsWith("name") || firstPath.startsWith("description") ? 1 : firstPath.startsWith("globalDiscount") ? 3 : 2)
          focusLater(firstPath)
        }
        toast.error(state.t("packages.errors.submitSummary"))
        return
      }
      const first = error instanceof Error ? error.message : ""
      toast.error(first || state.t(isEdit ? "packages.edit.error" : "packages.create.error"))
    }
  }, onInvalid)

  if (isEdit && (state.isLoading || !state.pkg)) return <div className="p-6 text-muted-foreground">{state.t("common.loading")}</div>
  const title = isEdit ? state.t("packages.edit.title") : state.t("packages.create.title")
  return <FormProvider {...state.form}><ListPageShell><Breadcrumbs /><PageHeader title={title} description={isEdit ? (state.pkg?.nameAr ?? "") : state.t("packages.grouped.createDescription")} /><PackageStepProgress step={step} labels={GROUPED_STEP_LABELS} /><form onSubmit={(event) => { if (step < 4) { event.preventDefault(); nextStep(); return }; void onSubmit(event) }} className="flex flex-col gap-6 pb-24">{step === 1 && <GroupedPackageDetails form={state.form} onImageSelect={state.onImageSelect} translateError={state.translateError} />}{step === 2 && <GroupedPackageGroups form={state.form} translateError={state.translateError} />}{step === 3 && <GroupedPackagePricing form={state.form} preview={state.preview} translateError={state.translateError} />}{step === 4 && <GroupedPackageReview form={state.form} preview={state.preview} />}<PackageEditorNavigation step={step} stepLabels={GROUPED_STEP_LABELS} isPending={isPending} submitLabel={isPending ? state.t(isEdit ? "packages.edit.submitting" : "packages.create.submitting") : state.t(isEdit ? "packages.edit.submit" : "packages.create.submit")} onBack={() => setStep((current) => current > 1 ? (current - 1) as Step : current)} onNext={nextStep} onCancel={() => router.push("/packages")} /></form></ListPageShell></FormProvider>
}

function validationIssueOrder(path: (string | number)[]): number {
  if (path[0] !== "groups") return path[0] === "globalDiscount" ? 100 : 0
  const field = path[2]
  const rank: Record<string, number> = { key: 0, label: 1, serviceId: 2, employeeId: 3, sequenceMode: 4, dependsOnGroupKey: 5, sessionMode: 6, sessions: 20 }
  return (typeof path[1] === "number" ? path[1] : 0) * 100 + (typeof field === "string" ? rank[field] ?? 10 : 10)
}

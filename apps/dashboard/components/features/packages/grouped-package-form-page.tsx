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
import { usePackageImageSave } from "@/hooks/use-package-image-save"
import { useSubmitLock } from "@/hooks/use-submit-lock"
import { queryKeys } from "@/lib/query-keys"
import { groupedPackageSchema } from "@/lib/schemas/package-groups.schema"
import type { GroupedPackageFormData } from "@/lib/schemas/package-groups.schema"
import { buildGroupedPackagePayload, packageSubmitIssues } from "@/lib/package-groups-form"
import { collectPackageErrorPaths, focusPackageError } from "@/lib/package-validation"
import { packageEditPath } from "@/lib/package-editor-navigation"
import { packageErrorTranslationKey, showPackageApiError } from "@/lib/package-errors"
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
  const imageSave = usePackageImageSave(state.t)
  // A submit lock covering the whole flow — save, upload and attach (t12) —
  // not just the create/update mutation: the double-click guard must also hold
  // while the image upload is in flight.
  const { isSubmitting, start: startSubmit, end: endSubmit, isLocked: isSubmitLocked } = useSubmitLock()
  const isPending = isSubmitting || (isEdit ? updateMut.isPending : createMut.isPending)
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
    if (!startSubmit()) return
    try {
      const payload = buildGroupedPackagePayload(data)
      if (isEdit && data.imageUrl === state.pkg?.imageUrl) delete payload.imageUrl
      if (isEdit && !state.pkg) throw new Error("Package is unavailable")
      // The staged file is uploaded only while the form still points at its
      // blob URL (t12): after a clear or an icon pick the avatar is gone, so
      // the removed file must never be resurrected by a save.
      const stagedFile =
        typeof data.imageUrl === "string" && data.imageUrl.startsWith("blob:")
          ? state.pendingAvatarFile.current
          : null
      // One shared flow for both forms (audit T11-F1/F2): save without the
      // image blob, then upload + attach the storage key; only a fully
      // successful image step reaches `finish` (toast + /packages), and the
      // pending file stays staged for a retry when it does not.
      let savedId: string | null = null
      const saved = await imageSave.saveWithImage({
        save: async () => {
          if (isEdit) {
            await updateMut.mutateAsync({ id: state.pkg!.id, ...payload })
            savedId = state.pkg!.id
            return state.pkg!.id
          }
          // Back from the edit screen (or any blocked/failed navigation) can
          // restore this create form with its editor state — `createdId`
          // included (t17) — so the package from the first attempt is updated
          // here, never created a second time.
          const alreadyCreated = state.createdId
          if (alreadyCreated) {
            if (!stagedFile) delete payload.imageUrl
            await updateMut.mutateAsync({ id: alreadyCreated, ...payload })
            savedId = alreadyCreated
            return alreadyCreated
          }
          const created = (await createMut.mutateAsync(payload)).id
          state.markCreated(created)
          savedId = created
          return created
        },
        file: stagedFile,
        finish: () => {
          toast.success(state.t(isEdit ? "packages.edit.success" : "packages.create.success"))
          queryClient.invalidateQueries({ queryKey: queryKeys.packages.all })
          router.push("/packages")
        },
      })
      // The image step failed after the package was already persisted (t15):
      // the edit screen confirms there is something to save and offers the
      // image field directly, so leaving the create form survives a refresh.
      // Already saved by the image stage's error toast above — no second toast.
      // The guard is asked through the hook (t15): a form that was left while
      // the request was in flight must never be pushed to another screen.
      if (!saved && !isEdit && savedId && imageSave.canNavigate()) {
        router.push(packageEditPath(savedId))
        return
      }
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
      // Save-stage failures arrive here from saveWithImage (t10): map the known
      // API message to its translation key and return to the owning step.
      const key = error instanceof Error ? packageErrorTranslationKey(error.message) : undefined
      const isPricing =
        !!key &&
        /globalDiscount|unitPrice|discount|Quantity/.test(key)
      if (key) setStep(key === "packages.errors.ownerInvalid" ? 1 : isPricing ? 3 : 2)
      showPackageApiError(error, {
        fallback: state.t(isEdit ? "packages.edit.error" : "packages.create.error"),
        t: state.t,
      })
    } finally {
      // Released on every exit path — success, mapped API failure and throw —
      // so a failed attempt can always be retried.
      endSubmit()
    }
  }, onInvalid)

  if (isEdit && (state.isLoading || !state.pkg)) return <div className="p-6 text-muted-foreground">{state.t("common.loading")}</div>
  const title = isEdit ? state.t("packages.edit.title") : state.t("packages.create.title")
  return <FormProvider {...state.form}><ListPageShell><Breadcrumbs /><PageHeader title={title} description={isEdit ? (state.pkg?.nameAr ?? "") : state.t("packages.grouped.createDescription")} /><PackageStepProgress step={step} labels={GROUPED_STEP_LABELS} /><form onSubmit={(event) => { if (step < 4) { event.preventDefault(); nextStep(); return }; if (isSubmitLocked()) { event.preventDefault(); return }; void onSubmit(event) }} className="flex flex-col gap-6 pb-24">{step === 1 && <GroupedPackageDetails form={state.form} onImageSelect={state.onImageSelect} onImageClear={state.onImageClear} translateError={state.translateError} />}{step === 2 && <GroupedPackageGroups form={state.form} translateError={state.translateError} />}{step === 3 && <GroupedPackagePricing form={state.form} preview={state.preview} translateError={state.translateError} />}{step === 4 && <GroupedPackageReview form={state.form} preview={state.preview} />}<PackageEditorNavigation step={step} stepLabels={GROUPED_STEP_LABELS} isPending={isPending} submitLabel={isPending ? state.t(isEdit ? "packages.edit.submitting" : "packages.create.submitting") : state.t(isEdit ? "packages.edit.submit" : "packages.create.submit")} onBack={() => setStep((current) => current > 1 ? (current - 1) as Step : current)} onNext={nextStep} onCancel={() => router.push("/packages")} /></form></ListPageShell></FormProvider>
}

function validationIssueOrder(path: (string | number)[]): number {
  if (path[0] !== "groups") return path[0] === "globalDiscount" ? 100 : 0
  const field = path[2]
  const rank: Record<string, number> = { key: 0, label: 1, serviceId: 2, employeeId: 3, sequenceMode: 4, dependsOnGroupKey: 5, sessionMode: 6, sessions: 20 }
  return (typeof path[1] === "number" ? path[1] : 0) * 100 + (typeof field === "string" ? rank[field] ?? 10 : 10)
}

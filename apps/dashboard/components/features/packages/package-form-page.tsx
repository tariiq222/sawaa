"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { FormProvider } from "react-hook-form"
import type { FieldErrors } from "react-hook-form"
import { toast } from "sonner"
import {
  packageErrorTranslationKey,
  showPackageApiError,
} from "@/lib/package-errors"
import {
  collectPackageErrorPaths,
  focusPackageError,
  packageIssuePaths,
} from "@/lib/package-validation"
import {
  firstPackageStep,
  packageStepForPath,
} from "@/lib/package-editor-navigation"
import {
  validatePackageStep,
  type PackageStep,
  type PackageStepIssue,
} from "@/lib/package-editor-step-validation"
import {
  createPackageSchema,
  type PackageFormData,
} from "@/lib/schemas/package.schema"
import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { usePackageMutations } from "@/hooks/use-packages"
import { uploadPackageImage } from "@/lib/api/packages"
import { queryKeys } from "@/lib/query-keys"
import { buildItemPayload } from "./package-form-helpers"
import { PackageFormFields } from "./package-form-fields"
import {
  PackageEditorNavigation,
  PackageStepProgress,
} from "./package-editor-navigation"
import { PackageFormState } from "./package-form-state"
import { usePackageEditorState } from "@/hooks/use-package-editor-state"
import type {
  CreateSessionPackagePayload,
  UpdateSessionPackagePayload,
} from "@/lib/types/package"
import { GroupedPackageFormPage } from "./grouped-package-form-page"

type Props = { mode: "create" } | { mode: "edit"; packageId: string }

export function PackageFormPage(props: Props) {
  const isEdit = props.mode === "edit"
  const packageId = isEdit ? props.packageId : null
  const router = useRouter()
  const qc = useQueryClient()
  const { createMut, updateMut } = usePackageMutations()
  const state = usePackageEditorState(packageId)
  const { form, t } = state
  const [step, setStep] = useState<PackageStep>(1)
  const isPending = isEdit ? updateMut.isPending : createMut.isPending

  const focusLater = (path: string) => {
    if (typeof window !== "undefined")
      window.setTimeout(() => focusPackageError(path), 0)
  }
  const reportValidationFailure = (paths: string[]) => {
    if (paths.length > 0) setStep(firstPackageStep(paths))
    toast.error(t("packages.errors.submitSummary"))
    if (paths[0]) focusLater(paths[0])
  }
  const onInvalid = (errors: FieldErrors<PackageFormData>) =>
    reportValidationFailure(collectPackageErrorPaths(errors))
  const applyStepIssues = (issues: PackageStepIssue[]) => {
    form.clearErrors()
    for (const issue of issues)
      form.setError(issue.path.join(".") as never, {
        type: "validate",
        message: issue.message,
      })
    if (issues[0]) {
      const path = issues[0].path.join(".")
      setStep(packageStepForPath(path))
      focusLater(path)
    }
    toast.error(t("packages.errors.stepSummary"))
  }
  const nextStep = () => {
    const data = form.getValues()
    for (
      let candidate = 1 as PackageStep;
      candidate <= step;
      candidate = (candidate + 1) as PackageStep
    ) {
      const result = validatePackageStep(data, candidate)
      if (!result.success) return applyStepIssues(result.issues)
    }
    if (step < 4) setStep((step + 1) as PackageStep)
  }

  const onSubmit = form.handleSubmit(async (data) => {
    const strictResult = createPackageSchema.safeParse(data)
    if (!strictResult.success) {
      for (const issue of strictResult.error.issues)
        form.setError(issue.path.join(".") as never, {
          type: "validate",
          message: issue.message,
        })
      return reportValidationFailure(
        packageIssuePaths(strictResult.error.issues)
      )
    }
    try {
      const strictData = strictResult.data
      const items = (strictData.items ?? []).map((item, index) =>
        buildItemPayload(item, index)
      )
      const common = {
        nameAr: strictData.nameAr ?? "",
        nameEn: strictData.nameEn || undefined,
        descriptionAr: strictData.descriptionAr || undefined,
        descriptionEn: strictData.descriptionEn || undefined,
        imageUrl: strictData.imageUrl?.startsWith("blob:")
          ? undefined
          : (strictData.imageUrl ?? null),
        iconName: strictData.iconName ?? null,
        iconBgColor: strictData.iconBgColor ?? null,
        sortOrder: Number(strictData.sortOrder ?? 0),
        isActive: strictData.isActive,
        isPublic: strictData.isPublic,
        ownerEmployeeId: strictData.ownerEmployeeId ?? null,
        items,
      }
      let id: string
      if (isEdit) {
        await updateMut.mutateAsync({ id: state.pkg!.id, ...common } satisfies {
          id: string
        } & UpdateSessionPackagePayload)
        id = state.pkg!.id
        toast.success(t("packages.edit.success"))
      } else {
        const created = await createMut.mutateAsync(
          common satisfies CreateSessionPackagePayload
        )
        id = created.id
        toast.success(t("packages.create.success"))
      }
      if (state.pendingAvatarFile.current) {
        try {
          await uploadPackageImage(id, state.pendingAvatarFile.current)
        } catch {
          toast.warning(t("packages.errors.uploadWarning"))
        } finally {
          state.pendingAvatarFile.current = null
        }
      }
      qc.invalidateQueries({ queryKey: queryKeys.packages.all })
      router.push("/packages")
    } catch (err) {
      const key =
        err instanceof Error
          ? packageErrorTranslationKey(err.message)
          : undefined
      if (key) {
        const apiStep =
          key === "packages.errors.ownerInvalid"
            ? 1
            : key.includes("unitPrice") ||
                key.includes("discount") ||
                key.includes("Quantity")
              ? 3
              : 2
        setStep(apiStep)
      }
      showPackageApiError(err, {
        fallback: t(isEdit ? "packages.edit.error" : "packages.create.error"),
        t,
      })
    }
  }, onInvalid)

  if (isEdit && (state.isLoading || !state.pkg))
    return (
      <PackageFormState
        loading={state.isLoading}
        t={t}
        onBack={() => router.push("/packages")}
      />
    )

  if (props.mode === "create") return <GroupedPackageFormPage mode="create" />
  if (state.pkg?.modelVersion === "GROUPED_V2")
    return <GroupedPackageFormPage mode="edit" packageId={props.packageId} initialPackage={state.pkg} />
  const title = isEdit ? t("packages.edit.title") : t("packages.create.title")
  const description = isEdit
    ? (state.pkg?.nameAr ?? "")
    : t("packages.create.description")
  const submitLabel = isPending
    ? t(isEdit ? "packages.edit.submitting" : "packages.create.submitting")
    : t(isEdit ? "packages.edit.submit" : "packages.create.submit")

  return (
    <FormProvider {...form}>
      <ListPageShell>
        <Breadcrumbs />
        <PageHeader title={title} description={description} />
        <PackageStepProgress step={step} />
        <form
          onSubmit={(event) => {
            if (step < 4) {
              event.preventDefault()
              return
            }
            void onSubmit(event)
          }}
          className="flex flex-col gap-6 pb-24"
        >
          <PackageFormFields
            form={form}
            onLineChange={state.onLineChange}
            onImageSelect={state.onImageSelect}
            lineItems={state.lineItems}
            breakdown={state.breakdown}
            translateError={state.translateError}
            step={step}
          />
          <PackageEditorNavigation
            step={step}
            isPending={isPending}
            submitLabel={submitLabel}
            onBack={() =>
              setStep((current) =>
                current > 1 ? ((current - 1) as PackageStep) : current
              )
            }
            onNext={nextStep}
            onCancel={() => router.push("/packages")}
          />
        </form>
      </ListPageShell>
    </FormProvider>
  )
}

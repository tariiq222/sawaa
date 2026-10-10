"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { showApiError } from "@/lib/mutation-helpers"
import { useAuth } from "@/components/providers/auth-provider"
import { ErrorBanner } from "@/components/features/error-banner"
import { ApiError } from "@/lib/api"
import { UserRoleEditor } from "./user-role-editor"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { Button, Skeleton } from "@sawaa/ui"
import { useUserMutations, useRoles, useUser } from "@/hooks/use-users"
import { useLocale } from "@/components/locale-provider"
import { UserFormFields } from "./user-form-fields"
import {
  userCreateSchema,
  userEditSchema,
  parseRoleSelection,
  type UserCreateFormData,
  type UserEditFormData,
} from "@/lib/schemas/user.schema"

/* ─── Types ─── */

type Props =
  | { mode: "create" }
  | { mode: "edit"; userId: string }

type FormData = UserCreateFormData | UserEditFormData

/* ─── User Form Page ─── */

export function UserFormPage(props: Props) {
  const isEdit = props.mode === "edit"
  const userId = isEdit ? props.userId : undefined

  const router = useRouter()
  const { t } = useLocale()
  const { canDo } = useAuth()
  const canManageRole = canDo("role", "manage")
  const { createMut, updateMut } = useUserMutations()
  const { data: roles = [], isLoading: rolesLoading } = useRoles({ enabled: canManageRole && canDo("role", "read") })

  const isPending = isEdit
    ? updateMut.isPending
    : createMut.isPending

  const { data: user, isLoading, error, refetch } = useUser(userId ?? null)
  const initializedUser = useRef<string | null>(null)

  const form = useForm<FormData>({
    resolver: zodResolver(isEdit ? userEditSchema : userCreateSchema) as never,
    defaultValues: { email: "", password: "", name: "", phone: "", roleSelection: "RECEPTIONIST" },
  })

  useEffect(() => {
    if (!user || initializedUser.current === user.id) return
    initializedUser.current = user.id
    form.reset({
      email: user.email,
      name: user.name,
      phone: user.phone ?? "",
      gender: user.gender || undefined,
    })
  }, [user, form])

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      if (isEdit) {
        const editData = data as UserEditFormData
        if (!user) return
        await updateMut.mutateAsync({
          id: user.id,
          email: editData.email,
          name: editData.name,
          gender: editData.gender,
          phone: editData.phone || null,
        })
        form.reset(editData)
        toast.success(t("auditStaff.profileSaved"))
      } else {
        const createData = data as UserCreateFormData
        const { roleSelection, ...rest } = createData
        const parsed = parseRoleSelection(roleSelection)
        const rolePayload =
          parsed.kind === "system"
            ? { role: parsed.role }
            : { role: "EMPLOYEE" as const, customRoleId: parsed.customRoleId }
        await createMut.mutateAsync({
          ...rest,
          phone: rest.phone || undefined,
          ...rolePayload,
        })
        toast.success(t("users.create.success"))
      }
      if (!isEdit) router.push("/users")
    } catch (err) {
      showApiError(err, { fallback: t(isEdit ? "users.edit.error" : "users.create.error"), t })
    }
  })

  if (isEdit && isLoading) {
    return (
      <ListPageShell>
        <Skeleton className="h-8 w-48" />
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={`skeleton-${i}`} className="h-64 w-full rounded-xl" />)}
        </div>
      </ListPageShell>
    )
  }

  if (isEdit && (error || !user)) {
    const notFound = !error || (error instanceof ApiError && error.status === 404)
    return <ListPageShell>
      <Breadcrumbs />
      <ErrorBanner message={t(notFound ? "users.detail.notFound" : "error.server")} onRetry={notFound ? undefined : () => { void refetch() }} />
      <Button variant="outline" onClick={() => router.push("/users")}>{t("users.detail.backToUsers")}</Button>
    </ListPageShell>
  }

  const title = isEdit ? t("users.edit.title") : t("users.create.title")
  const description = isEdit ? (user?.name ?? "") : t("users.create.description")
  const submitLabel = isPending
    ? t(isEdit ? "auditStaff.savingProfile" : "users.create.submitting")
    : t(isEdit ? "auditStaff.saveProfile" : "users.create.submit")

  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader title={title} description={description} />
      <form onSubmit={onSubmit} className="flex flex-col gap-6 pb-24">
        <UserFormFields form={form} isEdit={isEdit} roles={roles} rolesLoading={rolesLoading} showRole={!isEdit && canManageRole} />
        {!isEdit && !canManageRole && <p className="text-sm text-muted-foreground">{t("auditStaff.defaultRole")}: {t("users.role.RECEPTIONIST")}</p>}
        <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-6 border-t border-border bg-background px-4 sm:px-6 py-3 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" size="lg" className="rounded-lg" onClick={() => router.push("/users")}>
            {t(isEdit ? "users.edit.cancel" : "users.create.cancel")}
          </Button>
          <Button type="submit" size="lg" className="rounded-lg" disabled={isPending}>{submitLabel}</Button>
        </div>
      </form>
      {isEdit && user && canManageRole && <UserRoleEditor key={`${user.id}:${user.role}:${user.customRoleId ?? ""}`} user={user} roles={roles} loading={rolesLoading} />}
    </ListPageShell>
  )
}

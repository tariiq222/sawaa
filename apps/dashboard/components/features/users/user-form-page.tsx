"use client"

import { useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { showApiError } from "@/lib/mutation-helpers"
import { useQuery } from "@tanstack/react-query"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { Button, Skeleton } from "@sawaa/ui"
import { useUserMutations, useRoles } from "@/hooks/use-users"
import { useLocale } from "@/components/locale-provider"
import { fetchUser } from "@/lib/api/users"
import { queryKeys } from "@/lib/query-keys"
import { UserFormFields } from "./user-form-fields"
import {
  userCreateSchema,
  userEditSchema,
  parseRoleSelection,
  type UserCreateFormData,
  type UserEditFormData,
} from "@/lib/schemas/user.schema"
import type { UserRole } from "@/lib/types/user"

/* ─── Types ─── */

type Props =
  | { mode: "create" }
  | { mode: "edit"; userId: string }

type FormData = UserCreateFormData | UserEditFormData

const TENANT_ROLES = new Set<UserRole>(["ADMIN", "RECEPTIONIST", "ACCOUNTANT", "EMPLOYEE"])

function computeInitialRoleSelection(role: UserRole, customRoleId: string | null): string {
  if (customRoleId) return `custom:${customRoleId}`
  if (TENANT_ROLES.has(role)) return role
  return "EMPLOYEE"
}

/* ─── User Form Page ─── */

export function UserFormPage(props: Props) {
  const isEdit = props.mode === "edit"
  const userId = isEdit ? props.userId : undefined

  const router = useRouter()
  const { t } = useLocale()
  const { createMut, updateMut, updateUserRoleMut } = useUserMutations()
  const { data: roles = [], isLoading: rolesLoading } = useRoles()

  const isPending = isEdit
    ? updateMut.isPending || updateUserRoleMut.isPending
    : createMut.isPending

  const { data: user, isLoading } = useQuery({
    queryKey: queryKeys.users.detail(userId ?? ""),
    queryFn: () => fetchUser(userId!),
    enabled: isEdit,
  })

  const initialRoleSelection = useMemo(
    () => (user ? computeInitialRoleSelection(user.role, user.customRoleId) : ""),
    [user],
  )

  const form = useForm<FormData>({
    resolver: zodResolver(isEdit ? userEditSchema : userCreateSchema) as never,
    defaultValues: { email: "", password: "", name: "", phone: "", roleSelection: "RECEPTIONIST" },
  })

  useEffect(() => {
    if (!user) return
    form.reset({
      email: user.email,
      name: user.name,
      phone: user.phone ?? "",
      gender: user.gender || undefined,
      roleSelection: initialRoleSelection,
    })
  }, [user, form, initialRoleSelection])

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      if (isEdit) {
        const editData = data as UserEditFormData
        const { roleSelection, ...profileFields } = editData
        await updateMut.mutateAsync({
          id: user!.id,
          ...profileFields,
          phone: profileFields.phone || undefined,
        })
        if (roleSelection && roleSelection !== initialRoleSelection) {
          const parsed = parseRoleSelection(roleSelection)
          const rolePayload =
            parsed.kind === "system"
              ? { role: parsed.role, customRoleId: null }
              : { customRoleId: parsed.customRoleId }
          await updateUserRoleMut.mutateAsync({ id: user!.id, ...rolePayload })
        }
        toast.success(t("users.edit.success"))
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
      router.push("/users")
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

  const title = isEdit ? t("users.edit.title") : t("users.create.title")
  const description = isEdit ? (user?.name ?? "") : t("users.create.description")
  const submitLabel = isPending
    ? t(isEdit ? "users.edit.submitting" : "users.create.submitting")
    : t(isEdit ? "users.edit.submit" : "users.create.submit")

  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader title={title} description={description} />
      <form onSubmit={onSubmit} className="flex flex-col gap-6 pb-24">
        <UserFormFields form={form} isEdit={isEdit} roles={roles} rolesLoading={rolesLoading} />
        <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-6 border-t border-border bg-background px-4 sm:px-6 py-3 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" size="lg" className="rounded-lg" onClick={() => router.push("/users")}>
            {t(isEdit ? "users.edit.cancel" : "users.create.cancel")}
          </Button>
          <Button type="submit" size="lg" className="rounded-lg" disabled={isPending}>{submitLabel}</Button>
        </div>
      </form>
    </ListPageShell>
  )
}

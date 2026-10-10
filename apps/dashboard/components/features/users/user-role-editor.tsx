"use client"

import { useState } from "react"
import { Button, Label } from "@sawaa/ui"
import { toast } from "sonner"
import { useLocale } from "@/components/locale-provider"
import { useUserMutations } from "@/hooks/use-users"
import { showApiError } from "@/lib/mutation-helpers"
import { parseRoleSelection } from "@/lib/schemas/user.schema"
import type { Role, User } from "@/lib/types/user"
import { FormSection } from "@/components/features/shared/form-section"

export function UserRoleEditor({ user, roles, loading }: { user: User; roles: Role[]; loading: boolean }) {
  const { t } = useLocale()
  const { updateUserRoleMut } = useUserMutations()
  const initial = user.customRoleId ? `custom:${user.customRoleId}` : user.role
  const [selection, setSelection] = useState(initial)
  const save = async () => {
    try {
      const parsed = parseRoleSelection(selection)
      const payload = parsed.kind === "system"
        ? { role: parsed.role, customRoleId: null }
        : { customRoleId: parsed.customRoleId }
      await updateUserRoleMut.mutateAsync({ id: user.id, ...payload })
      toast.success(t("auditStaff.roleSaved"))
    } catch (err) {
      showApiError(err, { fallback: t("auditStaff.roleSaveError"), t })
    }
  }
  const customRoles = roles.filter((role) => !role.isSystem)
  if (user.customRole && !customRoles.some((role) => role.id === user.customRole!.id)) {
    customRoles.push({ ...user.customRole, isSystem: false, systemKey: null, permissions: [] })
  }
  return (
    <FormSection title={t("users.section.role")}>
      <div className="flex flex-col gap-3 sm:items-start">
        <p className="text-sm text-muted-foreground">{t("auditStaff.roleSaveDescription")}</p>
        <Label htmlFor="user-role-selection">{t("auditStaff.role")}</Label>
        <select id="user-role-selection" className="h-10 w-full rounded-md border border-input bg-background px-3 sm:w-80" value={selection} onChange={(event) => setSelection(event.target.value)} disabled={loading || updateUserRoleMut.isPending}>
          {(["ADMIN", "RECEPTIONIST", "ACCOUNTANT", "EMPLOYEE"] as const).map((role) => <option key={role} value={role}>{t(`users.role.${role}`)}</option>)}
          {!["ADMIN", "RECEPTIONIST", "ACCOUNTANT", "EMPLOYEE"].includes(user.role) && !user.customRoleId && <option value={user.role} disabled>{t(`users.role.${user.role}`)}</option>}
          {customRoles.map((role) => <option key={role.id} value={`custom:${role.id}`}>{role.name}</option>)}
        </select>
        <Button type="button" onClick={save} disabled={loading || updateUserRoleMut.isPending || selection === initial}>{t("auditStaff.saveRole")}</Button>
      </div>
    </FormSection>
  )
}

"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Card, CardContent } from "@sawaa/ui"
import { Button } from "@sawaa/ui"
import { Input } from "@sawaa/ui"
import { Label } from "@sawaa/ui"
import { Switch } from "@sawaa/ui"
import { Skeleton } from "@sawaa/ui"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { useEmployeeAccount } from "@/hooks/use-employees"
import { useEmployeeAccountMutations } from "@/hooks/use-employee-mutations"
import { showApiError } from "@/lib/mutation-helpers"
import type { EmployeeAccountRole } from "@/lib/api/employees"

const STAFF_ROLES: EmployeeAccountRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "RECEPTIONIST",
  "ACCOUNTANT",
  "EMPLOYEE",
]

interface Props {
  employeeId: string
}

function RoleSelect({
  value,
  onChange,
  disabled,
  t,
}: {
  value: EmployeeAccountRole
  onChange: (role: EmployeeAccountRole) => void
  disabled?: boolean
  t: (key: string) => string
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as EmployeeAccountRole)}
      disabled={disabled}
    >
      <SelectTrigger className="w-full sm:w-64">
        <SelectValue placeholder={t("employees.detail.account.roleLabel")} />
      </SelectTrigger>
      <SelectContent>
        {STAFF_ROLES.map((role) => (
          <SelectItem key={role} value={role}>
            {t(`employees.detail.account.role.${role}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function EmployeeAccountTab({ employeeId }: Props) {
  const { t } = useLocale()
  const { data, isLoading } = useEmployeeAccount(employeeId)
  const { createMut, updateMut } = useEmployeeAccountMutations(employeeId)

  /* ── Create-account form state ── */
  const [newRole, setNewRole] = useState<EmployeeAccountRole>("RECEPTIONIST")
  const [password, setPassword] = useState("")

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-3">
            <Skeleton className="h-4 w-48 rounded" />
            <Skeleton className="h-4 w-64 rounded" />
            <Skeleton className="h-8 w-32 rounded" />
          </div>
        </CardContent>
      </Card>
    )
  }

  /* ── No email on employee ── */
  if (!data?.employeeEmail && !data?.hasAccount) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">
            {t("employees.detail.account.needEmail")}
          </p>
        </CardContent>
      </Card>
    )
  }

  /* ── Has existing account ── */
  if (data?.hasAccount && data.account) {
    const { account } = data

    const handleRoleChange = (role: EmployeeAccountRole) => {
      updateMut.mutate(
        { role },
        {
          onSuccess: () => toast.success(t("employees.detail.account.updated")),
          onError: (err) => showApiError(err, { fallback: t("error.unexpected"), t }),
        },
      )
    }

    const handleActiveToggle = (isActive: boolean) => {
      updateMut.mutate(
        { isActive },
        {
          onSuccess: () => toast.success(t("employees.detail.account.updated")),
          onError: (err) => showApiError(err, { fallback: t("error.unexpected"), t }),
        },
      )
    }

    return (
      <Card>
        <CardContent className="space-y-6 p-6">
          <h3 className="text-base font-semibold text-foreground">
            {t("employees.detail.account.title")}
          </h3>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              {t("employees.detail.account.currentRole")}
            </Label>
            <RoleSelect
              value={account.role as EmployeeAccountRole}
              onChange={handleRoleChange}
              disabled={updateMut.isPending}
              t={t}
            />
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="account-active"
              checked={account.isActive}
              onCheckedChange={handleActiveToggle}
              disabled={updateMut.isPending}
            />
            <Label htmlFor="account-active" className="cursor-pointer">
              {t("employees.detail.account.accountActive")}
            </Label>
          </div>

          <p className="text-xs text-muted-foreground">{account.email}</p>
        </CardContent>
      </Card>
    )
  }

  /* ── No account yet, but email exists ── */
  const handleCreate = () => {
    createMut.mutate(
      { role: newRole, password: password || undefined },
      {
        onSuccess: () => {
          toast.success(t("employees.detail.account.created"))
          setPassword("")
        },
        onError: (err) => showApiError(err, { fallback: t("error.unexpected"), t }),
      },
    )
  }

  return (
    <Card>
      <CardContent className="space-y-6 p-6">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">
            {t("employees.detail.account.noAccountTitle")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t("employees.detail.account.noAccountDesc")}
          </p>
        </div>

        <div className="space-y-1">
          <Label>{t("employees.detail.account.roleLabel")}</Label>
          <RoleSelect
            value={newRole}
            onChange={setNewRole}
            disabled={createMut.isPending}
            t={t}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="account-password">
            {t("employees.detail.account.password")}
          </Label>
          <Input
            id="account-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={createMut.isPending}
            minLength={8}
          />
          <p className="text-xs text-muted-foreground">
            {t("employees.detail.account.passwordHint")}
          </p>
        </div>

        <Button
          onClick={handleCreate}
          disabled={createMut.isPending}
        >
          {t("employees.detail.account.create")}
        </Button>
      </CardContent>
    </Card>
  )
}

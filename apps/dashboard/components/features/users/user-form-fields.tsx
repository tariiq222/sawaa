"use client"

import { Controller } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import {
  UserIcon,
  LockIcon,
  SmartPhone01Icon,
  UserCheck01Icon,
} from "@hugeicons/core-free-icons"
import { Input } from "@deqah/ui"
import { PhoneInput } from "@deqah/ui"
import { Label } from "@deqah/ui"
import { Card, CardContent } from "@deqah/ui"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deqah/ui"
import { SectionHeader } from "@/components/features/section-header"
import { useLocale } from "@/components/locale-provider"

const USER_ROLES = [
  "ADMIN",
  "RECEPTIONIST",
  "ACCOUNTANT",
  "EMPLOYEE",
] as const

interface UserFormFieldsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>
  isEdit: boolean
}

export function UserFormFields({ form, isEdit }: UserFormFieldsProps) {
  const { t } = useLocale()

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* ── Personal Info ── */}
      <Card>
        <CardContent className="pt-6">
          <SectionHeader
            icon={UserIcon}
            title={t("users.create.fullName")}
            description={t("users.create.description")}
          />
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <Label>{t("users.create.fullName")} *</Label>
              <Input placeholder={t("users.create.fullNamePlaceholder")} {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message as string}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("users.create.gender")}</Label>
              <Controller
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v as "MALE" | "FEMALE")}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("users.create.genderPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MALE">{t("users.create.male")}</SelectItem>
                      <SelectItem value="FEMALE">{t("users.create.female")}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Account Info ── */}
      <Card>
        <CardContent className="pt-6">
          <SectionHeader
            icon={isEdit ? SmartPhone01Icon : LockIcon}
            title={t("users.create.email")}
            description={t("users.create.emailPlaceholder")}
          />
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <Label>{t("users.create.email")} *</Label>
              <Input type="email" placeholder={t("users.create.emailPlaceholder")} {...form.register("email")} />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">{form.formState.errors.email.message as string}</p>
              )}
            </div>
            {!isEdit && (
              <div className="flex flex-col gap-1.5">
                <Label>{t("users.create.password")} *</Label>
                <Input type="password" placeholder={t("users.create.passwordPlaceholder")} {...form.register("password")} />
                {(form.formState.errors as { password?: { message?: string } }).password && (
                  <p className="text-xs text-destructive">
                    {(form.formState.errors as { password?: { message?: string } }).password?.message}
                  </p>
                )}
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label>{t("users.create.phone")}</Label>
              <Controller
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <PhoneInput
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Role (create required / edit optional) ── */}
      <Card className="lg:col-span-2">
        <CardContent className="pt-6">
          <SectionHeader
            icon={UserCheck01Icon}
            title={t("users.create.role")}
            description={t("users.create.rolePlaceholder")}
          />
          <Controller
            control={form.control}
            name="role"
            render={({ field }) => (
              <Select value={field.value ?? ""} onValueChange={field.onChange}>
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue placeholder={t("users.create.rolePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {USER_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{t(`users.role.${r}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {(form.formState.errors as { role?: { message?: string } }).role && (
            <p className="text-xs text-destructive mt-1.5">
              {(form.formState.errors as { role?: { message?: string } }).role?.message}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

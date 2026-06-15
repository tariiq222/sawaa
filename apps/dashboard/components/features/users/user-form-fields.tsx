"use client"

import { Controller } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import {
  UserIcon,
  LockIcon,
  SmartPhone01Icon,
  UserCheck01Icon,
} from "@hugeicons/core-free-icons"
import {
  Input,
  PhoneInput,
  Label,
  Card,
  CardContent,
  Skeleton,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@sawaa/ui"
import { SectionHeader } from "@/components/features/section-header"
import { useLocale } from "@/components/locale-provider"
import type { Role } from "@/lib/types/user"

interface UserFormFieldsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>
  isEdit: boolean
  roles: Role[]
  rolesLoading: boolean
}

export function UserFormFields({ form, isEdit, roles, rolesLoading }: UserFormFieldsProps) {
  const { t } = useLocale()

  const systemRoles = roles.filter((r) => r.isSystem && r.systemKey)
  const customRoles = roles.filter((r) => !r.isSystem)

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
          {rolesLoading ? (
            <Skeleton className="h-10 w-full sm:w-80" />
          ) : (
            <Controller
              control={form.control}
              name="roleSelection"
              render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full sm:w-80">
                    <SelectValue placeholder={t("users.create.rolePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {systemRoles.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>{t("users.create.roleGroupSystem")}</SelectLabel>
                        {systemRoles.map((r) => (
                          <SelectItem key={r.id} value={r.systemKey!}>
                            {t(`users.role.${r.systemKey}` as Parameters<typeof t>[0])}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                    {systemRoles.length > 0 && customRoles.length > 0 && <SelectSeparator />}
                    {customRoles.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>{t("users.create.roleGroupCustom")}</SelectLabel>
                        {customRoles.map((r) => (
                          <SelectItem key={r.id} value={`custom:${r.id}`}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
              )}
            />
          )}
          {(form.formState.errors as { roleSelection?: { message?: string } }).roleSelection && (
            <p className="text-xs text-destructive mt-1.5">
              {(form.formState.errors as { roleSelection?: { message?: string } }).roleSelection?.message}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

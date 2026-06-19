"use client"

import { Controller } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import {
  Input,
  PhoneInput,
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
import { FormSection, FormField } from "@/components/features/shared/form-section"
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
      <FormSection title={t("users.section.personal")}>
        <div className="space-y-4">
          <FormField
            label={t("users.create.fullName")}
            required
            error={form.formState.errors.name?.message as string | undefined}
          >
            <Input placeholder={t("users.create.fullNamePlaceholder")} {...form.register("name")} />
          </FormField>
          <FormField label={t("users.create.gender")}>
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
          </FormField>
        </div>
      </FormSection>

      {/* ── Account Info ── */}
      <FormSection title={t("users.section.account")}>
        <div className="space-y-4">
          <FormField
            label={t("users.create.email")}
            required
            error={form.formState.errors.email?.message as string | undefined}
          >
            <Input type="email" placeholder={t("users.create.emailPlaceholder")} {...form.register("email")} />
          </FormField>
          {!isEdit && (
            <FormField
              label={t("users.create.password")}
              required
              error={(form.formState.errors as { password?: { message?: string } }).password?.message}
            >
              <Input type="password" placeholder={t("users.create.passwordPlaceholder")} {...form.register("password")} />
            </FormField>
          )}
          <FormField label={t("users.create.phone")}>
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
          </FormField>
        </div>
      </FormSection>

      {/* ── Role (create required / edit optional) ── */}
      <FormSection title={t("users.section.role")} className="lg:col-span-2">
        <FormField
          error={(form.formState.errors as { roleSelection?: { message?: string } }).roleSelection?.message}
        >
          {rolesLoading ? (
            <Skeleton className="h-10 w-full rounded-2xl sm:w-80" />
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
        </FormField>
      </FormSection>
    </div>
  )
}

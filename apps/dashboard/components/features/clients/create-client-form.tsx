"use client"

import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { Button } from "@sawaa/ui"
import { useClientMutations } from "@/hooks/use-clients"
import { useLocale } from "@/components/locale-provider"
import { showApiError } from "@/lib/mutation-helpers"
import {
  createClientSchemaWithI18n,
  type CreateClientFormData,
  splitFullName,
} from "@/lib/schemas/client.schema"
import { ClientFormFields } from "@/components/features/clients/client-form"

/**
 * Self-contained create-client form.
 *
 * Owns the useForm lifecycle, splits full name into first/middle/last for the API,
 * runs the create mutation, navigates on success, and surfaces API errors as toasts.
 *
 * Stays under the page layer so `app/(dashboard)/clients/create/page.tsx` can be
 * pure orchestration.
 */
export function CreateClientForm() {
  const router = useRouter()
  const { t } = useLocale()

  const { createMut } = useClientMutations()

  const form = useForm<CreateClientFormData>({
    resolver: zodResolver(createClientSchemaWithI18n(t)),
    defaultValues: {
      fullName: "",
      phone: "",
      emergencyName: "",
      emergencyPhone: "",
      allergies: "",
      chronicConditions: "",
    },
  })

  const onSubmit = form.handleSubmit(async (data) => {
    const { fullName, ...rest } = data
    const { firstName, middleName, lastName } = splitFullName(fullName)
    const payload = { ...rest, firstName, middleName, lastName }

    try {
      const created = await createMut.mutateAsync(payload)
      const id = created?.id
      toast.success(t(created.isExisting ? "clients.toasts.existing" : "clients.toasts.created"))
      router.push(id ? `/clients/${id}` : "/clients")
    } catch (error) {
      showApiError(error, { fallback: t("clients.create.error"), t })
    }
  })

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <ClientFormFields form={form} errors={form.formState.errors} mode="create" />

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/clients")}
          disabled={createMut.isPending}
        >
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={createMut.isPending}>
          {createMut.isPending ? t("common.saving") : t("common.create")}
        </Button>
      </div>
    </form>
  )
}

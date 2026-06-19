"use client"

import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { ApiError } from "@/lib/api"
import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { Button } from "@sawaa/ui"
import { useClientMutations } from "@/hooks/use-clients"
import { useLocale } from "@/components/locale-provider"
import { createClientSchema, type CreateClientFormData, splitFullName } from "@/lib/schemas/client.schema"
import { ClientFormFields } from "@/components/features/clients/client-form"

export default function CreateClientPage() {
  const router = useRouter()
  const { t } = useLocale()

  const { createMut } = useClientMutations()

  const form = useForm<CreateClientFormData>({
    resolver: zodResolver(createClientSchema),
    defaultValues: {
      fullName: "", phone: "",
      emergencyName: "", emergencyPhone: "",
      allergies: "", chronicConditions: "",
    },
  })

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      const { fullName, ...rest } = data
      const { firstName, middleName, lastName } = splitFullName(fullName)
      const payload = { ...rest, firstName, middleName, lastName }
      const result = await createMut.mutateAsync(payload) as { isExisting?: boolean }
      if (result?.isExisting) {
        toast.info(t("clients.create.alreadyRegistered"))
      } else {
        toast.success(t("clients.create.added"))
      }
      router.push("/clients")
    } catch (err) {
      if (err instanceof ApiError && err.code === "CLIENT_PHONE_EXISTS") {
        toast.error(t("clients.create.duplicatePhone"))
      } else {
        toast.error(err instanceof Error ? err.message : t("clients.create.error"))
      }
    }
  })

  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader
        title={t("clients.create.pageTitle")}
        description={t("clients.create.pageDescription")}
      />

      <form onSubmit={onSubmit} className="flex flex-col gap-4 pb-24">
        <ClientFormFields
          form={form}
          errors={form.formState.errors}
          mode="create"
        />

        <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-6 border-t border-border bg-background px-4 sm:px-6 py-3 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" size="lg" className="rounded-full" onClick={() => router.push("/clients")}>
            {t("clients.create.cancel")}
          </Button>
          <Button type="submit" size="lg" className="rounded-full" disabled={createMut.isPending}>
            {createMut.isPending
              ? t("clients.create.saving")
              : t("clients.create.submit")}
          </Button>
        </div>
      </form>
    </ListPageShell>
  )
}

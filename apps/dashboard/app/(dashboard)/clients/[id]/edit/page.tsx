"use client"

import { useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { ApiError } from "@/lib/api"
import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { Button } from "@sawaa/ui"
import { Skeleton } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { useClient, useClientMutations } from "@/hooks/use-clients"
import { editClientSchema, type EditClientFormData, splitFullName, composeFullName } from "@/lib/schemas/client.schema"
import { ClientFormFields } from "@/components/features/clients/client-form"

export default function EditClientPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { t } = useLocale()

  const { data: client, isLoading } = useClient(params.id)
  const { updateMut } = useClientMutations()

  const form = useForm<EditClientFormData>({ resolver: zodResolver(editClientSchema) })

  useEffect(() => {
    if (!client) return
    form.reset({
      fullName:          composeFullName(client.firstName, client.middleName, client.lastName),
      gender:            (client.gender as "male" | "female") ?? undefined,
      dateOfBirth:       client.dateOfBirth ? client.dateOfBirth.split("T")[0] : "",
      nationality:       client.nationality ?? "",
      nationalId:        client.nationalId ?? "",
      phone:             client.phone ?? "",
      emergencyName:     client.emergencyName ?? "",
      emergencyPhone:    client.emergencyPhone ?? "",
      bloodType:         (client.bloodType as EditClientFormData["bloodType"]) ?? undefined,
      allergies:         client.allergies ?? "",
      chronicConditions: client.chronicConditions ?? "",
      isActive:          client.isActive ?? true,
    })
  }, [client, form])

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      const { fullName, ...rest } = data
      const { firstName, middleName, lastName } = splitFullName(fullName)
      const payload = { ...rest, firstName, middleName, lastName }
      await updateMut.mutateAsync({ id: params.id, payload })
      toast.success(t("clients.edit.changesSaved"))
      router.push("/clients")
    } catch (err) {
      if (err instanceof ApiError && err.code === "CLIENT_PHONE_EXISTS") {
        toast.error(t("clients.create.duplicatePhone"))
      } else {
        toast.error(err instanceof Error ? err.message : t("clients.edit.error"))
      }
    }
  })

  if (isLoading) {
    return (
      <ListPageShell>
        <Breadcrumbs />
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={`skeleton-${i}`} className="h-[240px] rounded-xl" />
          ))}
        </div>
      </ListPageShell>
    )
  }

  const clientName = client ? composeFullName(client.firstName, client.middleName, client.lastName) : ""

  return (
    <ListPageShell>
      <Breadcrumbs items={[
        { label: t("nav.dashboard"), href: "/" },
        { label: t("nav.clients"), href: "/clients" },
        { label: clientName, href: `/clients/${params.id}` },
        { label: t("nav.edit") },
      ]} />
      <PageHeader
        title={t("clients.edit.title")}
        description={`${t("clients.edit.descriptionPrefix")} ${clientName}`}
      />

      <form onSubmit={onSubmit} className="flex flex-col gap-4 pb-24">
        <ClientFormFields
          form={form}
          errors={form.formState.errors}
          mode="edit"
        />

        <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-6 border-t border-border bg-background px-4 sm:px-6 py-3 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" size="lg" className="rounded-full" onClick={() => router.push("/clients")}>
            {t("clients.edit.cancel")}
          </Button>
          <Button type="submit" size="lg" className="rounded-full" disabled={updateMut.isPending}>
            {updateMut.isPending
              ? t("clients.edit.saving")
              : t("clients.edit.saveChanges")}
          </Button>
        </div>
      </form>
    </ListPageShell>
  )
}

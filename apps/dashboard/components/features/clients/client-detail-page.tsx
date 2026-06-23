"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  PencilEdit01Icon,
  ArrowLeft01Icon,
  Delete02Icon,
} from "@hugeicons/core-free-icons"

import { ListPageShell } from "@/components/features/list-page-shell"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { DetailSection, DetailRow } from "@/components/features/detail-sheet-parts"
import { ErrorBanner } from "@/components/features/error-banner"
import { ClientPageSkeleton } from "@/components/features/clients/client-page-skeleton"
import { DeleteClientDialog } from "@/components/features/clients/delete-client-dialog"
import { ClientBookingsPanel } from "@/components/features/clients/client-bookings-panel"
import { ClientInvoicesPanel } from "@/components/features/clients/client-invoices-panel"
import { Button } from "@sawaa/ui"
import { Avatar, AvatarFallback } from "@sawaa/ui"
import { Badge } from "@sawaa/ui"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { useOrganizationConfig } from "@/hooks/use-organization-config"
import { useClient } from "@/hooks/use-clients"
import { ApiError } from "@/lib/api"
import { ClientAccountToggle } from "@/components/features/clients/client-account-toggle"
import { ActiveBadge } from "@/components/features/status-badge"
import { BLOOD_LABELS, type BloodType } from "@/lib/schemas/client.schema"

/* ─── Props ─── */

interface Props {
  clientId: string
}

/* ─── Component ─── */

export function ClientDetailPage({ clientId }: Props) {
  const router = useRouter()
  const { locale, t } = useLocale()
  const { formatDate } = useOrganizationConfig()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { data: client, isLoading, error, refetch } = useClient(clientId)

  if (isLoading) return <ClientPageSkeleton />

  const isNotFound =
    (error instanceof ApiError && error.status === 404) || (!error && !client)

  if (!isNotFound && error) {
    return (
      <ListPageShell>
        <Breadcrumbs />
        <ErrorBanner
          message={t("error.server")}
          onRetry={() => refetch()}
        />
        <Button variant="outline" onClick={() => router.push("/clients")}>
          <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
          {t("clients.detail.backToClients")}
        </Button>
      </ListPageShell>
    )
  }

  if (error || !client) {
    return (
      <ListPageShell>
        <Breadcrumbs />
        <ErrorBanner message={t("clients.detail.notFound")} />
        <Button variant="outline" onClick={() => router.push("/clients")}>
          <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
          {t("clients.detail.backToClients")}
        </Button>
      </ListPageShell>
    )
  }

  const fullName = [client.firstName, client.middleName, client.lastName].filter(Boolean).join(" ")
  const isWalkIn = client.accountType?.toUpperCase() === "WALK_IN"
  const isFull = client.accountType?.toUpperCase() === "FULL"

  return (
    <ListPageShell>
      <Breadcrumbs items={[
        { label: t("nav.dashboard"), href: "/" },
        { label: t("nav.clients"), href: "/clients" },
        { label: fullName },
      ]} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="size-12 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {client.firstName?.[0] ?? ""}{client.lastName?.[0] ?? ""}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{fullName}</h1>
              {isWalkIn && (
                <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
                  {t("clients.detail.walkIn")}
                </Badge>
              )}
              {isFull && (
                <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                  {t("clients.detail.hasAccount")}
                </Badge>
              )}
              <ActiveBadge
                active={client.isActive}
                label={client.isActive ? t("clients.detail.active") : t("clients.detail.inactive")}
              />
            </div>
            <p className="text-sm text-muted-foreground">{client.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            className="gap-2 rounded-lg px-6"
            onClick={() => router.push(`/clients/${clientId}/edit`)}
          >
            <HugeiconsIcon icon={PencilEdit01Icon} size={16} />
            {t("clients.detail.edit")}
          </Button>
          <Button
            variant="outline"
            className="gap-2 rounded-lg px-6 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <HugeiconsIcon icon={Delete02Icon} size={16} />
            {t("clients.actions.delete")}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="info" dir={locale === "ar" ? "rtl" : "ltr"}>
        <TabsList variant="line">
          <TabsTrigger value="info">{t("clients.dialog.tabs.contact")}</TabsTrigger>
          <TabsTrigger value="bookings">{t("clients.dialog.tabs.bookings")}</TabsTrigger>
          <TabsTrigger value="invoices">{t("clients.dialog.tabs.invoices")}</TabsTrigger>
          <TabsTrigger value="stats">{t("clients.dialog.tabs.stats")}</TabsTrigger>
        </TabsList>

        {/* ── Tab 1: التواصل والبيانات ── */}
        <TabsContent value="info" className="pt-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <DetailSection title={t("clients.detail.personalInfo")}>
              <DetailRow label={t("clients.detail.fullName")} value={fullName} />
              <DetailRow
                label={t("clients.detail.gender")}
                value={client.gender
                  ? t(client.gender === "male" ? "clients.detail.male" : "clients.detail.female")
                  : "—"}
              />
              <DetailRow
                label={t("clients.detail.dateOfBirth")}
                value={client.dateOfBirth ? formatDate(client.dateOfBirth) : "—"}
                numeric
              />
              <DetailRow label={t("clients.detail.nationality")} value={client.nationality ?? "—"} />
              <DetailRow label={t("clients.detail.nationalId")} value={client.nationalId ?? "—"} numeric />
            </DetailSection>

            <div className="flex flex-col gap-4">
              <DetailSection title={t("clients.detail.contactInfo")}>
                <DetailRow label={t("clients.detail.email")} value={client.email ? <span dir="ltr">{client.email}</span> : "—"} />
                <DetailRow label={t("clients.detail.phone")} value={<span dir="ltr">{client.phone ?? "—"}</span>} />
              </DetailSection>
              <DetailSection title={t("clients.detail.emergencyContact")}>
                <DetailRow label={t("clients.detail.name")} value={client.emergencyName ?? "—"} />
                <DetailRow label={t("clients.detail.phone")} value={<span dir="ltr">{client.emergencyPhone ?? "—"}</span>} />
              </DetailSection>
            </div>

            <DetailSection title={t("clients.detail.medicalInfo")}>
              <DetailRow
                label={t("clients.detail.bloodType")}
                value={client.bloodType ? (BLOOD_LABELS[client.bloodType as BloodType] ?? client.bloodType) : "—"}
              />
              <DetailRow label={t("clients.detail.allergies")} value={client.allergies ?? "—"} />
              <DetailRow label={t("clients.detail.chronicConditions")} value={client.chronicConditions ?? "—"} />
            </DetailSection>

            <div className="flex flex-col gap-4">
              <DetailSection title={t("clients.detail.accountInfo")}>
                <DetailRow
                  label={t("clients.detail.registeredDate")}
                  value={formatDate(client.createdAt)}
                  numeric
                />
                <DetailRow
                  label={t("clients.detail.lastUpdated")}
                  value={formatDate(client.updatedAt)}
                  numeric
                />
                {isWalkIn && (
                  <>
                    <DetailRow
                      label={t("clients.detail.accountType")}
                      value={
                        <span className="rounded-sm bg-warning/10 px-1.5 py-0.5 text-xs font-medium text-warning">
                          {t("clients.detail.walkIn")}
                        </span>
                      }
                    />
                    <DetailRow
                      label={t("clients.detail.claimedAt")}
                      value={client.claimedAt
                        ? formatDate(client.claimedAt)
                        : t("clients.detail.notClaimed")}
                      numeric={!!client.claimedAt}
                    />
                  </>
                )}
              </DetailSection>
              <ClientAccountToggle client={client} />
            </div>
          </div>
        </TabsContent>

        {/* ── Tab 2: المواعيد ── */}
        <TabsContent value="bookings" className="pt-4">
          <ClientBookingsPanel clientId={client.id} t={t} formatDate={formatDate} />
        </TabsContent>

        {/* ── Tab 3: الفواتير ── */}
        <TabsContent value="invoices" className="pt-4">
          <ClientInvoicesPanel t={t} />
        </TabsContent>

        {/* ── Tab 4: الإحصائيات ── */}
        <TabsContent value="stats" className="pt-4">
          <div className="py-8 text-center text-sm text-muted-foreground">
            {t("clients.dialog.noBookings")}
          </div>
        </TabsContent>
      </Tabs>

      <DeleteClientDialog
        client={client}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => router.push("/clients")}
      />
    </ListPageShell>
  )
}

"use client"

import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Button,
  Badge,
  Card,
  CardContent,
  Skeleton,
} from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { useOrganizationConfig } from "@/hooks/use-organization-config"
import { useGroupSession } from "@/hooks/use-group-sessions"
import { ListPageShell } from "@/components/features/list-page-shell"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { DetailSection, DetailRow } from "@/components/features/detail-sheet-parts"
import { EnrollmentsTable } from "@/components/features/group-sessions/group-session-enrollments"
import type { GroupSessionStatus } from "@/lib/types/group-session"

/* ─── Helpers ─── */

function formatPrice(halalas: number): string {
  return (halalas / 100).toLocaleString("en-SA", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

type StatusVariant = "default" | "secondary" | "destructive" | "outline" | "success"

function statusBadgeVariant(status: GroupSessionStatus): StatusVariant {
  switch (status) {
    case "OPEN": return "default"
    case "FULL": return "secondary"
    case "CANCELLED": return "destructive"
    case "COMPLETED": return "success"
  }
}

/* ─── Props ─── */

interface Props {
  sessionId: string
}

/* ─── Component ─── */

export function GroupSessionDetailPage({ sessionId }: Props) {
  const router = useRouter()
  const { t, locale } = useLocale()
  const { formatDate } = useOrganizationConfig()

  const { data: session, isLoading, error } = useGroupSession(sessionId)

  if (isLoading) {
    return (
      <ListPageShell>
        <Skeleton className="h-5 w-48" />
        <div className="space-y-4 mt-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </ListPageShell>
    )
  }

  if (error || !session) {
    return (
      <ListPageShell>
        <Breadcrumbs />
        <p className="text-sm text-destructive">{t("groupSessions.detail.notFound")}</p>
        <Button variant="outline" onClick={() => router.push("/group-sessions")}>
          <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
          {t("groupSessions.detail.backToSessions")}
        </Button>
      </ListPageShell>
    )
  }

  const serviceName =
    locale === "ar"
      ? (session.service?.nameAr ?? session.title)
      : (session.service?.nameEn ?? session.service?.nameAr ?? session.title)
  const practitionerName =
    locale === "ar"
      ? (session.employee?.nameAr ?? session.employee?.name ?? "—")
      : (session.employee?.nameEn ?? session.employee?.name ?? "—")
  const scheduledDate = formatDate(session.scheduledAt)
  const scheduledTime = new Date(session.scheduledAt).toLocaleTimeString(
    locale === "ar" ? "ar-SA" : "en-SA",
    { hour: "2-digit", minute: "2-digit" }
  )
  const description =
    locale === "ar"
      ? (session.descriptionAr ?? session.descriptionEn)
      : (session.descriptionEn ?? session.descriptionAr)

  return (
    <ListPageShell>
      <Breadcrumbs
        items={[
          { label: t("nav.dashboard"), href: "/" },
          { label: t("groupSessions.title"), href: "/group-sessions" },
          { label: session.title },
        ]}
      />

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/group-sessions")}
          className="gap-1"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
          {t("groupSessions.detail.backToList")}
        </Button>
        <h1 className="text-xl font-semibold text-foreground">{session.title}</h1>
        <Badge variant={statusBadgeVariant(session.status)}>
          {t(`groupSessions.status.${session.status}`)}
        </Badge>
      </div>

      <Tabs defaultValue="info" dir={locale === "ar" ? "rtl" : "ltr"}>
        <TabsList variant="line">
          <TabsTrigger value="info">{t("groupSessions.detail.tabs.info")}</TabsTrigger>
          <TabsTrigger value="bookings">{t("groupSessions.detail.tabs.bookings")}</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="pt-4">
          <Card>
            <CardContent className="pt-6">
              <DetailSection title={t("groupSessions.detail.session")}>
                <DetailRow label={t("groupSessions.detail.service")} value={serviceName} />
                <DetailRow label={t("groupSessions.detail.practitioner")} value={practitionerName} />
                <DetailRow
                  label={t("groupSessions.detail.scheduledAt")}
                  value={`${scheduledDate} — ${scheduledTime}`}
                  numeric
                />
                <DetailRow
                  label={t("groupSessions.detail.duration")}
                  value={`${session.durationMins} ${t("common.min")}`}
                  numeric
                />
                <DetailRow
                  label={t("groupSessions.detail.capacity")}
                  value={`${session.enrolledCount} / ${session.maxCapacity}`}
                  numeric
                />
                <DetailRow
                  label={t("groupSessions.detail.spotsLeft")}
                  value={String(session.spotsLeft)}
                  numeric
                />
                <DetailRow
                  label={t("groupSessions.detail.price")}
                  value={`${formatPrice(session.price)} ${t("groupSessions.currency")}`}
                  numeric
                />
                <DetailRow
                  label={t("groupSessions.detail.deliveryType")}
                  value={
                    <Badge variant="outline" className="text-xs">
                      {session.deliveryType === "IN_PERSON"
                        ? t("groupSessions.deliveryType.inPerson")
                        : t("groupSessions.deliveryType.online")}
                    </Badge>
                  }
                />
                <DetailRow
                  label={t("groupSessions.detail.isPublic")}
                  value={session.isPublic ? t("groupSessions.detail.yes") : t("groupSessions.detail.no")}
                />
                <DetailRow
                  label={t("groupSessions.detail.description")}
                  value={description ?? t("groupSessions.detail.noDescription")}
                />
              </DetailSection>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bookings" className="pt-4">
          <EnrollmentsTable enrollments={session.enrollments} sessionId={sessionId} />
        </TabsContent>
      </Tabs>
    </ListPageShell>
  )
}

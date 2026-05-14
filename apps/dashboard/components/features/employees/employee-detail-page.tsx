"use client"

import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  PencilEdit01Icon,
  StarIcon,
  Calendar03Icon,
  ArrowLeft01Icon,
  Stethoscope02Icon,
  CheckmarkCircle02Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { StatsGrid } from "@/components/features/stats-grid"
import { StatCard } from "@/components/features/stat-card"
import { ErrorBanner } from "@/components/features/error-banner"
import { Button } from "@deqah/ui"
import { Card, CardContent } from "@deqah/ui"
import { Separator } from "@deqah/ui"
import { Avatar, AvatarFallback, AvatarImage } from "@deqah/ui"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import { useEmployee } from "@/hooks/use-employees"
import {
  EmployeeRatingsSection,
  EmployeeAvailabilitySection,
  EmployeeVacationsSection,
  EmployeeServicesSectionCard,
} from "@/components/features/employees/employee-profile-sections"
import {
  ProfileSkeleton,
  CombinedInfoCard,
  PricingCard,
} from "@/components/features/employees/employee-profile-helpers"
import { EmployeeBookingsChart } from "@/components/features/employees/employee-bookings-chart"
import { PublicProfileTab } from "@/components/features/employees/public-profile-tab"

interface Props {
  employeeId: string
}

export function EmployeeDetailPage({ employeeId }: Props) {
  const router = useRouter()
  const { t, locale } = useLocale()
  const isAr = locale === "ar"

  const { data: employee, isLoading, error } = useEmployee(employeeId)

  if (isLoading) return <ProfileSkeleton />

  if (error || !employee) {
    return (
      <ListPageShell>
        <Breadcrumbs />
        <ErrorBanner message={t("employees.detail.notFound")} />
        <Button variant="outline" onClick={() => router.push("/employees")}>
          <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
          {t("employees.detail.backToEmployees")}
        </Button>
      </ListPageShell>
    )
  }

  const p = employee
  const fullName =
    p.nameAr && isAr
      ? p.nameAr
      : `${p.title ? p.title + " " : ""}${p.user.firstName} ${p.user.lastName}`
  const initials = `${p.user.firstName[0] ?? ""}${p.user.lastName[0] ?? ""}`.toUpperCase()
  const specialty = isAr ? (p.specialtyAr ?? p.specialty) : p.specialty
  const bio = (isAr ? p.bioAr : p.bio) ?? (isAr ? p.bio : p.bioAr)
  const education = (isAr ? p.educationAr : p.education) ?? (isAr ? p.education : p.educationAr)

  const breadcrumbItems = [
    { label: t("employees.detail.home"), href: "/" },
    { label: t("employees.title"), href: "/employees" },
    { label: fullName },
  ]

  return (
    <ListPageShell>
      <Breadcrumbs items={breadcrumbItems} />

      <PageHeader title={fullName} description={specialty ?? ""}>
        <Button
          className="gap-2 rounded-full px-5"
          onClick={() => router.push(`/employees/${employeeId}/edit`)}
        >
          <HugeiconsIcon icon={PencilEdit01Icon} size={16} />
          {t("employees.detail.edit")}
        </Button>
      </PageHeader>

      {/* Hero Card */}
      <Card>
        <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-start sm:gap-6">
          <Avatar className="size-16 shrink-0 text-lg font-semibold">
            {p.avatarUrl && <AvatarImage src={p.avatarUrl} alt={fullName} />}
            <AvatarFallback className="bg-primary/10 text-primary">{initials}</AvatarFallback>
          </Avatar>

          <div className="flex flex-1 flex-col gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-semibold text-foreground">{fullName}</h2>
              <p className="text-sm text-muted-foreground">{specialty}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
                  p.isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                }`}
              >
                <span className={`size-1.5 rounded-full ${p.isActive ? "bg-success" : "bg-muted-foreground"}`} />
                {p.isActive ? t("employees.detail.status.active") : t("employees.detail.inactive")}
              </span>
              {p.isAcceptingBookings !== undefined && (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
                    p.isAcceptingBookings ? "bg-primary/8 text-primary" : "bg-muted text-muted-foreground"
                  }`}
                >
                  <span className={`size-1.5 rounded-full ${p.isAcceptingBookings ? "bg-primary" : "bg-muted-foreground"}`} />
                  {p.isAcceptingBookings
                    ? t("employees.detail.acceptingBookings")
                    : t("employees.detail.notAccepting")}
                </span>
              )}
            </div>

            {bio && <p className="text-sm leading-relaxed text-muted-foreground">{bio}</p>}
          </div>

          <Separator orientation="vertical" className="hidden h-24 self-center sm:block" />
          <div className="flex shrink-0 flex-row gap-6 sm:flex-col sm:items-end sm:gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <HugeiconsIcon icon={StarIcon} size={18} className="text-warning" />
                <span className="text-2xl font-bold tabular-nums text-foreground">
                  {p.averageRating != null ? p.averageRating.toFixed(1) : "—"}
                </span>
              </div>
              <span className="text-sm tabular-nums text-muted-foreground">
                {p.ratingCount ?? 0} {t("employees.detail.reviews")}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-2xl font-bold tabular-nums text-foreground">
                {p.bookingCount ?? 0}
              </span>
              <span className="text-sm text-muted-foreground">{t("employees.detail.bookings")}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <StatsGrid>
        <StatCard
          title={t("employees.detail.stats.avgRating")}
          value={p.averageRating != null ? p.averageRating.toFixed(1) : "—"}
          description={`${p.ratingCount ?? 0} ${t("employees.detail.reviews")}`}
          icon={StarIcon}
          iconColor="warning"
        />
        <StatCard
          title={t("employees.detail.stats.totalBookings")}
          value={p.bookingCount ?? 0}
          icon={Calendar03Icon}
          iconColor="primary"
        />
        <StatCard
          title={t("employees.detail.stats.experience")}
          value={p.experience != null ? String(p.experience) : "—"}
          description={t("employees.detail.stats.years")}
          icon={Stethoscope02Icon}
          iconColor="accent"
        />
        <StatCard
          title={t("employees.detail.stats.status")}
          value={p.isActive ? t("employees.detail.status.active") : t("employees.detail.inactive")}
          icon={p.isActive ? CheckmarkCircle02Icon : Cancel01Icon}
          iconColor={p.isActive ? "success" : "warning"}
        />
      </StatsGrid>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{t("employees.detail.overview")}</TabsTrigger>
          <TabsTrigger value="services">{t("employees.detail.services")}</TabsTrigger>
          <TabsTrigger value="schedule">{t("employees.detail.schedule")}</TabsTrigger>
          <TabsTrigger value="ratings">{t("employees.detail.ratingsTab")}</TabsTrigger>
          <TabsTrigger value="public">{t("employees.detail.public")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 pt-4">
          <EmployeeBookingsChart employeeId={employeeId} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CombinedInfoCard
              email={p.user.email}
              phone={p.user.phone ?? null}
              specialty={specialty ?? "—"}
              experience={p.experience ?? null}
              education={education ?? null}
              createdAt={p.createdAt}
              updatedAt={p.updatedAt}
              locale={locale}
              isAr={isAr}
            />
            <PricingCard
              priceClinic={p.priceClinic ?? null}
              pricePhone={p.pricePhone ?? null}
              priceVideo={p.priceVideo ?? null}
              locale={locale}
              isAr={isAr}
            />
          </div>
        </TabsContent>

        <TabsContent value="services" className="pt-4">
          <EmployeeServicesSectionCard employeeId={employeeId} />
        </TabsContent>

        <TabsContent value="schedule" className="space-y-4 pt-4">
          <EmployeeAvailabilitySection employeeId={employeeId} />
          <EmployeeVacationsSection employeeId={employeeId} />
        </TabsContent>

        <TabsContent value="ratings" className="pt-4">
          <EmployeeRatingsSection
            employeeId={employeeId}
            averageRating={p.averageRating}
            totalRatings={p.ratingCount ?? 0}
          />
        </TabsContent>

        <TabsContent value="public" className="pt-4">
          <PublicProfileTab employee={p} />
        </TabsContent>
      </Tabs>
    </ListPageShell>
  )
}

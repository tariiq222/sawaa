"use client"

import { Suspense, useEffect, type ReactNode } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@sawaa/ui"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { useLocale } from "@/components/locale-provider"

import { GeneralTab } from "@/components/features/settings/general-tab"
import { BookingTab } from "@/components/features/settings/booking-tab"
import { CancellationTab } from "@/components/features/settings/cancellation-tab"
import { WorkingHoursTab } from "@/components/features/settings/working-hours-tab"
import { SettingsPaymentTab } from "@/components/features/settings/settings-payment-tab"
import { SettingsIntegrationsTab } from "@/components/features/settings/settings-integrations-tab"
import { SawaaAiSettingsContent } from "@/components/features/settings/sawaa-ai-settings-content"
import { EmailTemplatesTab } from "@/components/features/settings/email-templates-tab"
import { MobileHomeCardsTab } from "@/components/features/settings/mobile-home-cards-tab"
import { DiscountReasonsManager } from "@/components/features/settings/discount-reasons-manager"
import { PermissionGuard } from "@/components/features/permission-guard"
import { useAuth } from "@/components/providers/auth-provider"

const VALID_TABS = new Set([
  "general",
  "booking",
  "cancellation",
  "hours",
  "payment",
  "discount-reasons",
  "integrations",
  "sawaa-ai",
  "email-templates",
  "mobile-home-cards",
])

// Each tab is shown when the user can read ANY of its subjects (backend splits
// the former `Setting` subject into Setting / Content / ProviderConfig).
const TAB_SUBJECTS: Record<string, string[]> = {
  general: ["setting"],
  booking: ["setting"],
  cancellation: ["setting"],
  hours: ["setting"],
  payment: ["setting", "providerconfig"],
  "discount-reasons": ["setting"],
  integrations: ["providerconfig"],
  "sawaa-ai": ["providerconfig", "content"],
  "email-templates": ["content"],
  "mobile-home-cards": ["content"],
}

function SettingsTabs() {
  const { t } = useLocale()
  const { canDo } = useAuth()
  const canSeeTab = (tab: string) => TAB_SUBJECTS[tab].some((subject) => canDo(subject, "read"))
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const queryTab = searchParams.get("tab")
  const firstVisibleTab = Object.keys(TAB_SUBJECTS).find(canSeeTab) ?? "general"
  const requestedTab = queryTab && VALID_TABS.has(queryTab) && canSeeTab(queryTab) ? queryTab : null
  const activeTab = requestedTab ?? firstVisibleTab

  // Keep the URL in sync without re-mounting the tabs. Effect runs only
  // when the active tab diverges from the URL (e.g. user clicked back/forward
  // in the browser).
  useEffect(() => {
    if (!requestedTab && queryTab) {
      router.replace(pathname, { scroll: false })
    }
  }, [requestedTab, queryTab, pathname, router])

  const onTabChange = (next: string) => {
    if (next === firstVisibleTab) {
      router.replace(pathname, { scroll: false })
    } else {
      router.replace(`${pathname}?tab=${next}`, { scroll: false })
    }
  }

  return (
    <Tabs value={activeTab} onValueChange={onTabChange}>
      <p className="text-xs text-muted-foreground">{t("settings.tabs.scrollHint")}</p>
      <div className="overflow-x-auto pb-2">
        <TabsList className="w-max">
          {canSeeTab("general") && <TabsTrigger value="general">{t("settings.tabs.general")}</TabsTrigger>}
          {canSeeTab("booking") && <TabsTrigger value="booking">{t("settings.tabs.booking")}</TabsTrigger>}
          {canSeeTab("cancellation") && <TabsTrigger value="cancellation">{t("settings.tabs.cancellation")}</TabsTrigger>}
          {canSeeTab("hours") && <TabsTrigger value="hours">{t("settings.tabs.hours")}</TabsTrigger>}
          {canSeeTab("payment") && <TabsTrigger value="payment">{t("settings.tabs.payment")}</TabsTrigger>}
          {canSeeTab("discount-reasons") && <TabsTrigger value="discount-reasons">{t("settings.tabs.discountReasons")}</TabsTrigger>}
          {canSeeTab("integrations") && <TabsTrigger value="integrations">{t("settings.tabs.integrations")}</TabsTrigger>}
          {canSeeTab("sawaa-ai") && <TabsTrigger value="sawaa-ai">{t("sawaaAi.menuLabel")}</TabsTrigger>}
          {canSeeTab("email-templates") && <TabsTrigger value="email-templates">{t("settings.tabs.emailTemplates")}</TabsTrigger>}
          {canSeeTab("mobile-home-cards") && <TabsTrigger value="mobile-home-cards">{t("settings.tabs.mobileHomeCards")}</TabsTrigger>}
        </TabsList>
      </div>

      {canSeeTab("general") && (
        <TabsContent value="general" className="mt-4">
          <GeneralTab />
        </TabsContent>
      )}
      {canSeeTab("booking") && (
        <TabsContent value="booking" className="mt-4">
          <BookingTab t={t} />
        </TabsContent>
      )}
      {canSeeTab("cancellation") && (
        <TabsContent value="cancellation" className="mt-4">
          <CancellationTab t={t} />
        </TabsContent>
      )}
      {canSeeTab("hours") && (
        <TabsContent value="hours" className="mt-4">
          <WorkingHoursTab t={t} />
        </TabsContent>
      )}
      {canSeeTab("payment") && (
        <TabsContent value="payment" className="mt-4">
          <SettingsPaymentTab />
        </TabsContent>
      )}
      {canSeeTab("discount-reasons") && (
        <TabsContent value="discount-reasons" className="mt-4">
          <DiscountReasonsManager />
        </TabsContent>
      )}
      {canSeeTab("integrations") && (
        <TabsContent value="integrations" className="mt-4">
          <SettingsIntegrationsTab />
        </TabsContent>
      )}
      {canSeeTab("sawaa-ai") && (
        <TabsContent value="sawaa-ai" className="mt-4">
          <SawaaAiSettingsContent />
        </TabsContent>
      )}
      {canSeeTab("email-templates") && (
        <TabsContent value="email-templates" className="mt-4">
          <EmailTemplatesTab />
        </TabsContent>
      )}
      {canSeeTab("mobile-home-cards") && (
        <TabsContent value="mobile-home-cards" className="mt-4">
          <MobileHomeCardsTab />
        </TabsContent>
      )}
    </Tabs>
  )
}

function SettingsAccessGate({ children }: { children: ReactNode }) {
  const { canDo } = useAuth()
  const allowed = ["setting", "content", "providerconfig"].some((subject) => canDo(subject, "read"))
  if (!allowed) return <PermissionGuard module="setting" action="read">{children}</PermissionGuard>
  return <>{children}</>
}

export default function SettingsPage() {
  const { t } = useLocale()

  return (
    <SettingsAccessGate>
      <ListPageShell>
        <Breadcrumbs />
        <PageHeader title={t("settings.title")} description={t("settings.description")} />
        {/* Suspense boundary required by Next.js 15 because the inner
            component reads search params during render. */}
        <Suspense fallback={null}>
          <SettingsTabs />
        </Suspense>
      </ListPageShell>
    </SettingsAccessGate>
  )
}

"use client"

import { Suspense, useEffect } from "react"
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
import { DiscountReasonsManager } from "@/components/features/settings/discount-reasons-manager"
import { PermissionGuard } from "@/components/features/permission-guard"

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
])

function SettingsTabs() {
  const { t } = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const queryTab = searchParams.get("tab")
  const activeTab = queryTab && VALID_TABS.has(queryTab) ? queryTab : "general"

  // Keep the URL in sync without re-mounting the tabs. Effect runs only
  // when the active tab diverges from the URL (e.g. user clicked back/forward
  // in the browser).
  useEffect(() => {
    if (activeTab === "general" && queryTab) {
      router.replace(pathname, { scroll: false })
    }
  }, [activeTab, queryTab, pathname, router])

  const onTabChange = (next: string) => {
    if (next === "general") {
      router.replace(pathname, { scroll: false })
    } else {
      router.replace(`${pathname}?tab=${next}`, { scroll: false })
    }
  }

  return (
    <Tabs value={activeTab} onValueChange={onTabChange}>
      <div className="overflow-x-auto">
        <TabsList className="w-max">
          <TabsTrigger value="general">{t("settings.tabs.general")}</TabsTrigger>
          <TabsTrigger value="booking">{t("settings.tabs.booking")}</TabsTrigger>
          <TabsTrigger value="cancellation">{t("settings.tabs.cancellation")}</TabsTrigger>
          <TabsTrigger value="hours">{t("settings.tabs.hours")}</TabsTrigger>
          <TabsTrigger value="payment">{t("settings.tabs.payment")}</TabsTrigger>
          <TabsTrigger value="discount-reasons">{t("settings.tabs.discountReasons")}</TabsTrigger>
          <TabsTrigger value="integrations">{t("settings.tabs.integrations")}</TabsTrigger>
          <TabsTrigger value="sawaa-ai">{t("sawaaAi.menuLabel")}</TabsTrigger>
          <TabsTrigger value="email-templates">{t("settings.tabs.emailTemplates")}</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="general" className="mt-4">
        <GeneralTab />
      </TabsContent>
      <TabsContent value="booking" className="mt-4">
        <BookingTab t={t} />
      </TabsContent>
      <TabsContent value="cancellation" className="mt-4">
        <CancellationTab t={t} />
      </TabsContent>
      <TabsContent value="hours" className="mt-4">
        <WorkingHoursTab t={t} />
      </TabsContent>
      <TabsContent value="payment" className="mt-4">
        <SettingsPaymentTab />
      </TabsContent>
      <TabsContent value="discount-reasons" className="mt-4">
        <DiscountReasonsManager />
      </TabsContent>
      <TabsContent value="integrations" className="mt-4">
        <SettingsIntegrationsTab />
      </TabsContent>
      <TabsContent value="sawaa-ai" className="mt-4">
        <SawaaAiSettingsContent />
      </TabsContent>
      <TabsContent value="email-templates" className="mt-4">
        <EmailTemplatesTab />
      </TabsContent>
    </Tabs>
  )
}

export default function SettingsPage() {
  const { t } = useLocale()

  return (
    <PermissionGuard module="setting" action="read">
      <ListPageShell>
        <Breadcrumbs />
        <PageHeader title={t("settings.title")} description={t("settings.description")} />
        {/* Suspense boundary required by Next.js 15 because the inner
            component reads search params during render. */}
        <Suspense fallback={null}>
          <SettingsTabs />
        </Suspense>
      </ListPageShell>
    </PermissionGuard>
  )
}

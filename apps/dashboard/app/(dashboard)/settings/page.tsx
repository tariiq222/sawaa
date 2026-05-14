"use client"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@deqah/ui"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { useLocale } from "@/components/locale-provider"

import { GeneralTab } from "@/components/features/settings/general-tab"
import { BookingTab } from "@/components/features/settings/booking-tab"
import { CancellationTab } from "@/components/features/settings/cancellation-tab"
import { WorkingHoursTab } from "@/components/features/settings/working-hours-tab"
import { SettingsPaymentTab } from "@/components/features/settings/settings-payment-tab"
import { SettingsIntegrationsTab } from "@/components/features/settings/settings-integrations-tab"
import { EmailTemplatesTab } from "@/components/features/settings/email-templates-tab"
import { LegalContentTab } from "@/components/features/settings/legal-content-tab"

export default function SettingsPage() {
  const { t } = useLocale()

  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader title={t("settings.title")} description={t("settings.description")} />

      <Tabs defaultValue="general">
        <div className="overflow-x-auto">
          <TabsList className="w-max">
            <TabsTrigger value="general">{t("settings.tabs.general")}</TabsTrigger>
            <TabsTrigger value="booking">{t("settings.tabs.booking")}</TabsTrigger>
            <TabsTrigger value="cancellation">{t("settings.tabs.cancellation")}</TabsTrigger>
            <TabsTrigger value="hours">{t("settings.tabs.hours")}</TabsTrigger>
            <TabsTrigger value="payment">{t("settings.tabs.payment")}</TabsTrigger>
            <TabsTrigger value="integrations">{t("settings.tabs.integrations")}</TabsTrigger>
            <TabsTrigger value="legal">{t("settings.tabs.legal")}</TabsTrigger>
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
        <TabsContent value="integrations" className="mt-4">
          <SettingsIntegrationsTab />
        </TabsContent>
        <TabsContent value="legal" className="mt-4">
          <LegalContentTab />
        </TabsContent>
        <TabsContent value="email-templates" className="mt-4">
          <EmailTemplatesTab />
        </TabsContent>

      </Tabs>
    </ListPageShell>
  )
}

"use client"

import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Skeleton } from "@deqah/ui"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@deqah/ui"
import { HeroForm } from "@/components/features/content/hero-form"
import { FeatureCardsForm } from "@/components/features/content/feature-cards-form"
import { SectionIntrosForm } from "@/components/features/content/section-intros-form"
import { useLocale } from "@/components/locale-provider"
import { useSiteSettings } from "@/hooks/use-site-settings"

export default function ContentHomePage() {
  const { t } = useLocale()
  const { data, isLoading } = useSiteSettings("home.")
  const rows = data ?? []

  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader
        title={t("content.home.title")}
        description={t("content.home.description")}
      />

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <Tabs defaultValue="hero">
          <TabsList>
            <TabsTrigger value="hero">{t("content.home.tab.hero")}</TabsTrigger>
            <TabsTrigger value="intros">{t("content.home.tab.intros")}</TabsTrigger>
            <TabsTrigger value="features">{t("content.home.tab.features")}</TabsTrigger>
          </TabsList>
          <TabsContent value="hero" className="pt-6">
            <HeroForm rows={rows} />
          </TabsContent>
          <TabsContent value="intros" className="pt-6">
            <SectionIntrosForm rows={rows} />
          </TabsContent>
          <TabsContent value="features" className="pt-6">
            <FeatureCardsForm rows={rows} />
          </TabsContent>
        </Tabs>
      )}
    </ListPageShell>
  )
}

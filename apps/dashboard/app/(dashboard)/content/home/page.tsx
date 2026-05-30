"use client"

import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Skeleton } from "@sawaa/ui"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@sawaa/ui"
import { HeroForm } from "@/components/features/content/hero-form"
import { FeatureCardsForm } from "@/components/features/content/feature-cards-form"
import { SectionIntrosForm } from "@/components/features/content/section-intros-form"
import { BlogPostsForm } from "@/components/features/content/blog-posts-form"
import { FaqForm } from "@/components/features/content/faq-form"
import { SupportGroupsForm } from "@/components/features/content/support-groups-form"
import { useLocale } from "@/components/locale-provider"
import { useSiteSettings } from "@/hooks/use-site-settings"

export default function ContentHomePage() {
  const { t } = useLocale()
  const { data: homeData, isLoading: homeLoading } = useSiteSettings("home.")
  const { data: contentData, isLoading: contentLoading } = useSiteSettings("content.")
  const rows = [...(homeData ?? []), ...(contentData ?? [])]
  const isLoading = homeLoading || contentLoading

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
            <TabsTrigger value="blog">{t("content.home.tab.blog")}</TabsTrigger>
            <TabsTrigger value="faq">{t("content.home.tab.faq")}</TabsTrigger>
            <TabsTrigger value="support-groups">{t("content.home.tab.supportGroups")}</TabsTrigger>
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
          <TabsContent value="blog" className="pt-6">
            <BlogPostsForm rows={rows} />
          </TabsContent>
          <TabsContent value="faq" className="pt-6">
            <FaqForm rows={rows} />
          </TabsContent>
          <TabsContent value="support-groups" className="pt-6">
            <SupportGroupsForm rows={rows} />
          </TabsContent>
        </Tabs>
      )}
    </ListPageShell>
  )
}

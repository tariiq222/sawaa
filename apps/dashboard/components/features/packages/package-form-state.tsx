"use client"

import { Button, Skeleton } from "@sawaa/ui"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"

export function PackageFormState({ loading, t, onBack }: { loading: boolean; t: (key: string) => string; onBack: () => void }) {
  if (loading) return <ListPageShell><Skeleton className="h-8 w-48" /><div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}</div></ListPageShell>
  return <ListPageShell><Breadcrumbs /><PageHeader title={t("packages.notFound.title")} description={t("packages.notFound.desc")} /><Button variant="ghost" onClick={onBack}>{t("packages.notFound.back")}</Button></ListPageShell>
}

"use client"

import { Button, Skeleton } from "@sawaa/ui"
import { useClientBookingStatistics } from "@/hooks/use-client-records"

export function ClientStatisticsPanel({ clientId, t }: { clientId: string; t: (key: string) => string }) {
  const { data, isLoading, error, refetch } = useClientBookingStatistics(clientId)
  if (isLoading) return <Skeleton className="h-24 w-full" />
  if (error) return <div role="alert" className="space-y-3 py-6"><p>{t("error.server")}</p><Button onClick={() => void refetch()}>{t("common.retry")}</Button></div>
  return <dl className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-3">
    {(["total", "completed", "cancelled"] as const).map(key => <div key={key} className="rounded-lg border p-4"><dt className="text-sm text-muted-foreground">{t(`clients.statistics.${key}`)}</dt><dd className="mt-2 text-2xl font-semibold tabular-nums">{data?.[key] ?? 0}</dd></div>)}
  </dl>
}

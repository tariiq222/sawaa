"use client"

import { useLocale } from "@/components/locale-provider"
import { HugeiconsIcon } from "@hugeicons/react"
import { Card, CardContent, CardHeader, CardTitle } from "@deqah/ui"
import { StatusBadge } from "@/components/features/status-badge"
import { cn } from "@/lib/utils"
import type { IconSvgElement } from "@hugeicons/react"

export interface TimelineAppointment {
  id: string
  time: string
  clientName: string
  employeeName: string
  type: "in_person" | "online"
  status: "confirmed" | "pending" | "completed" | "cancelled"
  typeIcon: IconSvgElement
}

interface TodayTimelineProps {
  appointments: TimelineAppointment[]
  className?: string
}

export function TodayTimeline({ appointments, className }: TodayTimelineProps) {
  const { t } = useLocale()

  return (
    <Card className={cn("card-lift", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("dashboard.todayTimeline")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {appointments.map((appt) => (
          <div
            key={appt.id}
            className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted/50"
          >
            <span className="w-12 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
              {appt.time}
            </span>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <HugeiconsIcon icon={appt.typeIcon} size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{appt.clientName}</p>
              <p className="truncate text-xs text-muted-foreground">{appt.employeeName}</p>
            </div>
            <StatusBadge status={appt.status} />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

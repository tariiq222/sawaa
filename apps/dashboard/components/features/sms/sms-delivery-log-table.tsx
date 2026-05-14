"use client"

// SaaS-02g-sms — last 50 deliveries table.

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import { useSmsDeliveries } from "@/hooks/use-sms-config"
import { formatLocaleDate } from "@/lib/date"
import type { SmsDeliveryStatus } from "@/lib/types/sms"

function StatusBadge({ status }: { status: SmsDeliveryStatus }) {
  const cls = (() => {
    switch (status) {
      case "DELIVERED":
        return "bg-success/10 text-success border-success/30"
      case "SENT":
      case "QUEUED":
        return "bg-primary/10 text-primary border-primary/30"
      case "FAILED":
        return "bg-destructive/10 text-destructive border-destructive/30"
      default:
        return "bg-muted text-muted-foreground"
    }
  })()
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${cls}`}
    >
      {status}
    </span>
  )
}

export function SmsDeliveryLogTable() {
  const { locale, t } = useLocale()
  const { deliveries, loading } = useSmsDeliveries()

  const format = (iso: string | null) =>
    formatLocaleDate(iso, locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("sms.log.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground">{t("sms.log.loading")}</p>
        ) : deliveries.length === 0 ? (
          <p className="text-muted-foreground">{t("sms.log.empty")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("sms.log.col.phone")}</TableHead>
                <TableHead>{t("sms.log.col.provider")}</TableHead>
                <TableHead>{t("sms.log.col.status")}</TableHead>
                <TableHead>{t("sms.log.col.sent")}</TableHead>
                <TableHead>{t("sms.log.col.delivered")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveries.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-sm">
                    {d.toPhone}
                  </TableCell>
                  <TableCell>{d.provider}</TableCell>
                  <TableCell>
                    <StatusBadge status={d.status} />
                  </TableCell>
                  <TableCell>{format(d.sentAt)}</TableCell>
                  <TableCell>{format(d.deliveredAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

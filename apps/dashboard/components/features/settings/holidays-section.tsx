"use client"

import { useState } from "react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Calendar03Icon,
  Delete02Icon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons"

import { Card, CardContent, CardHeader, CardTitle } from "@deqah/ui"
import { Button } from "@deqah/ui"
import { Input } from "@deqah/ui"
import { Label } from "@deqah/ui"
import { DatePicker } from "@/components/ui/date-picker"
import { Separator } from "@deqah/ui"
import { Skeleton } from "@deqah/ui"
import type { OrganizationHoliday } from "@/lib/api/organization"
import {
  useOrganizationHolidays,
  useCreateHoliday,
  useDeleteHoliday,
} from "@/hooks/use-organization-settings"

/* ─── Props ─── */

interface Props {
  t: (key: string) => string
  branchId: string
}

/* ─── Component ─── */

export function HolidaysSection({ t, branchId }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [date, setDate] = useState("")
  const [nameAr, setNameAr] = useState("")
  const [nameEn, setNameEn] = useState("")

  const { data: holidays, isLoading } = useOrganizationHolidays(branchId)
  const createMutation = useCreateHoliday()
  const deleteMutation = useDeleteHoliday()

  const resetForm = () => {
    setDate("")
    setNameAr("")
    setNameEn("")
    setShowForm(false)
  }

  const handleAdd = () => {
    if (!date || !nameAr || !nameEn) return
    createMutation.mutate(
      { branchId, date, nameAr, nameEn },
      {
        onSuccess: () => { toast.success(t("settings.saved")); resetForm() },
        onError: (err: Error) => toast.error(err.message),
      },
    )
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm">{t("settings.holidays")}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {t("settings.holidaysDesc")}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
          <HugeiconsIcon icon={PlusSignIcon} size={16} />
          <span className="ms-1">{t("settings.addHoliday")}</span>
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {showForm && (
          <>
            <div className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("settings.holidayDate")}</Label>
                <DatePicker
                  value={date}
                  onChange={setDate}
                  placeholder={t("settings.holidayDate")}
                  error={!date && createMutation.isPending}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("settings.holidayNameAr")}</Label>
                <Input
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                  placeholder={t("settings.holidays.examplePlaceholder")}
                  dir="rtl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("settings.holidayNameEn")}</Label>
                <Input
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  placeholder="Eid Al-Fitr"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={resetForm}>
                {t("common.cancel")}
              </Button>
              <Button
                size="sm"
                disabled={!date || !nameAr || !nameEn || createMutation.isPending}
                onClick={handleAdd}
              >
                {t("settings.addHoliday")}
              </Button>
            </div>
            <Separator />
          </>
        )}

        {!holidays || holidays.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {t("settings.noHolidays")}
          </p>
        ) : (
          <div className="space-y-2">
            {holidays.map((holiday: OrganizationHoliday) => (
              <HolidayRow
                key={holiday.id}
                holiday={holiday}
                onDelete={() =>
                  deleteMutation.mutate(holiday.id, {
                    onSuccess: () => toast.success(t("settings.saved")),
                    onError: (err: Error) => toast.error(err.message),
                  })
                }
                isDeleting={deleteMutation.isPending}
                t={t}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* ─── Holiday Row ─── */

function HolidayRow({
  holiday,
  onDelete,
  isDeleting,
  t,
}: {
  holiday: OrganizationHoliday
  onDelete: () => void
  isDeleting: boolean
  t: (key: string) => string
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border p-2">
      <div className="flex items-center gap-3">
        <HugeiconsIcon
          icon={Calendar03Icon}
          size={16}
          className="text-muted-foreground"
        />
        <div>
          <p className="text-sm font-medium text-foreground">
            {holiday.nameEn ? `${holiday.nameEn} / ` : ""}{holiday.nameAr}
          </p>
          <p className="text-xs tabular-nums text-muted-foreground">
            {holiday.date.slice(0, 10)}
          </p>
        </div>
      </div>
      <Button
        size="icon"
        variant="ghost"
        disabled={isDeleting}
        onClick={onDelete}
        aria-label={t("settings.deleteHoliday")}
      >
        <HugeiconsIcon
          icon={Delete02Icon}
          size={16}
          className="text-destructive"
        />
      </Button>
    </div>
  )
}

"use client"

import { Input } from "@deqah/ui"
import { Label } from "@deqah/ui"
import { Switch } from "@deqah/ui"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Card,
  CardContent,
  CardTitle,
  CardDescription,
} from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import type { LocalVacation } from "./schedule-types"

interface VacationCardProps {
  vacation: LocalVacation
  onVacationChange: (vacation: LocalVacation) => void
}

export function VacationCard({ vacation, onVacationChange }: VacationCardProps) {
  const { t } = useLocale()

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">
                {t("vacation.employeeVacation")}
              </CardTitle>
              <CardDescription className="mt-1">
                {t("vacation.vacationDescription")}
              </CardDescription>
            </div>
            <Switch
              checked={vacation.enabled}
              onCheckedChange={(v) =>
                onVacationChange({ ...vacation, enabled: v })
              }
            />
          </div>

          {vacation.enabled && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">
                  {t("vacation.startDateLabel")}
                </Label>
                <DatePicker
                  value={vacation.startDate}
                  onChange={(v) =>
                    onVacationChange({ ...vacation, startDate: v })
                  }
                  placeholder={t("vacation.pickDate")}
                  className="w-full"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">
                  {t("vacation.endDateLabel")}
                </Label>
                <DatePicker
                  value={vacation.endDate}
                  onChange={(v) =>
                    onVacationChange({ ...vacation, endDate: v })
                  }
                  placeholder={t("vacation.pickDate")}
                  className="w-full"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">
                  {t("vacation.reasonLabel")}
                </Label>
                <Input
                  className="h-9 text-xs"
                  placeholder={t("vacation.reasonPlaceholder")}
                  value={vacation.reason}
                  onChange={(e) =>
                    onVacationChange({ ...vacation, reason: e.target.value })
                  }
                />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

"use client"

import { Input } from "@sawaa/ui"
import { Switch } from "@sawaa/ui"
import { DatePicker } from "@/components/ui/date-picker"
import { useLocale } from "@/components/locale-provider"
import { FormSection, FormField } from "@/components/features/shared/form-section"
import type { LocalVacation } from "./schedule-types"

interface VacationCardProps {
  vacation: LocalVacation
  onVacationChange: (vacation: LocalVacation) => void
}

export function VacationCard({ vacation, onVacationChange }: VacationCardProps) {
  const { t } = useLocale()

  return (
    <FormSection>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-semibold text-foreground">
                {t("vacation.employeeVacation")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("vacation.vacationDescription")}
              </p>
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
              <FormField label={t("vacation.startDateLabel")}>
                <DatePicker
                  value={vacation.startDate}
                  onChange={(v) =>
                    onVacationChange({ ...vacation, startDate: v })
                  }
                  placeholder={t("vacation.pickDate")}
                  className="w-full"
                />
              </FormField>
              <FormField label={t("vacation.endDateLabel")}>
                <DatePicker
                  value={vacation.endDate}
                  onChange={(v) =>
                    onVacationChange({ ...vacation, endDate: v })
                  }
                  placeholder={t("vacation.pickDate")}
                  className="w-full"
                />
              </FormField>
              <FormField label={t("vacation.reasonLabel")}>
                <Input
                  className="h-9 text-xs"
                  placeholder={t("vacation.reasonPlaceholder")}
                  value={vacation.reason}
                  onChange={(e) =>
                    onVacationChange({ ...vacation, reason: e.target.value })
                  }
                />
              </FormField>
            </div>
          )}
        </div>
    </FormSection>
  )
}

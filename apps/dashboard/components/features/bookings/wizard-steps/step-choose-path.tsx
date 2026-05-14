"use client"

import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { Stethoscope02Icon, UserIcon } from "@hugeicons/core-free-icons"

import { useLocale } from "@/components/locale-provider"
import { cn } from "@/lib/utils"

/* ─── Types ─── */

export type BookingPath = "service_first" | "employee_first"

interface StepChoosePathProps {
  onSelect: (path: BookingPath) => void
}

/* ─── Path card ─── */

interface PathCardProps {
  icon: IconSvgElement
  title: string
  description: string
  onClick: () => void
}

function PathCard({ icon, title, description, onClick }: PathCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface",
        "px-6 py-8 transition-all duration-150",
        "hover:border-primary/60 hover:bg-primary/5 hover:shadow-md",
        "active:scale-[0.97]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
      )}
    >
      <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10">
        <HugeiconsIcon icon={icon} size={30} className="text-primary" />
      </div>
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="text-base font-bold text-foreground">{title}</span>
        <span className="text-sm text-muted-foreground">{description}</span>
      </div>
    </button>
  )
}

/* ─── Step component ─── */

export function StepChoosePath({ onSelect }: StepChoosePathProps) {
  const { t } = useLocale()

  return (
    <div className="grid grid-cols-2 gap-4">
      <PathCard
        icon={Stethoscope02Icon}
        title={t("bookings.wizard.step.choosePath.byService")}
        description={t("bookings.wizard.step.choosePath.byServiceDesc")}
        onClick={() => onSelect("service_first")}
      />
      <PathCard
        icon={UserIcon}
        title={t("bookings.wizard.step.choosePath.byEmployee")}
        description={t("bookings.wizard.step.choosePath.byEmployeeDesc")}
        onClick={() => onSelect("employee_first")}
      />
    </div>
  )
}

"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  ClinicIcon,
  PackageIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"

import { WizardCard } from "@/components/features/bookings/wizard-card"
import { useLocale } from "@/components/locale-provider"

export type WizardTrack = "CLINICS" | "GROUP" | "PACKAGES"

interface StepTrackProps {
  selected: WizardTrack | null
  onSelect: (track: WizardTrack) => void
}

export function StepTrack({ selected, onSelect }: StepTrackProps): JSX.Element {
  const { t } = useLocale()

  const tracks: ReadonlyArray<{
    id: WizardTrack
    titleKey: string
    descKey: string
    Icon: typeof ClinicIcon
  }> = [
    {
      id: "CLINICS",
      titleKey: "bookings.pos.track.clinics",
      descKey: "bookings.pos.track.clinics.desc",
      Icon: ClinicIcon,
    },
    {
      id: "GROUP",
      titleKey: "bookings.pos.track.group",
      descKey: "bookings.pos.track.group.desc",
      Icon: UserGroupIcon,
    },
    {
      id: "PACKAGES",
      titleKey: "bookings.pos.track.packages",
      descKey: "bookings.pos.track.packages.desc",
      Icon: PackageIcon,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {tracks.map(({ id, titleKey, descKey, Icon }) => (
        <WizardCard
          key={id}
          onClick={() => onSelect(id)}
          selected={selected === id}
          className="px-4 py-3.5"
        >
          <div className="flex items-center gap-3 text-start">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <HugeiconsIcon icon={Icon} size={18} className="text-primary" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="line-clamp-1 text-sm font-semibold leading-snug text-foreground">
                {t(titleKey)}
              </span>
              <span className="line-clamp-2 text-xs font-normal text-muted-foreground">
                {t(descKey)}
              </span>
            </div>
          </div>
        </WizardCard>
      ))}
    </div>
  )
}

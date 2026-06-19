"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { StarIcon, Award01Icon } from "@hugeicons/core-free-icons"

import { Card } from "@sawaa/ui"
import { Avatar, AvatarFallback } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { getAvatarGradientStyle } from "@/lib/utils"
import type { Employee } from "@/lib/types/employee"

interface TopPerformersProps {
  employees: Employee[]
}

/* Rank prefix labels — decorative numerals only; first rank gets a subtle tint */
const rankBadgeClass = [
  "bg-warning/15 text-warning border border-warning/30",
  "bg-surface-muted text-muted-foreground border border-border",
  "bg-surface-muted text-muted-foreground border border-border",
]

export function TopPerformers({ employees }: TopPerformersProps) {
  const { locale, t } = useLocale()

  const top3 = [...employees]
    .filter((p) => p.averageRating != null && p.averageRating > 0)
    .sort((a, b) => (b.averageRating ?? 0) - (a.averageRating ?? 0))
    .slice(0, 3)

  if (top3.length === 0) return null

  return (
    <Card className="p-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={Award01Icon} size={18} className="text-warning" />
          <h3 className="text-base font-bold text-foreground">
            {t("employees.topPerformersMonth")}
          </h3>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {top3.map((p, i) => {
          const name = `${p.user.firstName} ${p.user.lastName}`
          const initials = `${p.user.firstName?.[0] ?? ""}${p.user.lastName?.[0] ?? ""}`.toUpperCase()
          const specialty = locale === "ar" ? (p.specialtyAr || p.specialty) : p.specialty

          return (
            <div
              key={p.id}
              className="relative flex items-center gap-4 rounded-md border border-border bg-surface p-5 transition-all hover:-translate-y-0.5 hover:shadow-sm"
            >
              {/* Rank badge */}
              <div
                className={`absolute start-3 top-3 flex size-7 items-center justify-center rounded-full text-[13px] font-bold tabular-nums ${rankBadgeClass[i]}`}
              >
                {i + 1}
              </div>

              {/* Avatar — consistent gradient per employee id */}
              <Avatar className="size-12 shrink-0">
                <AvatarFallback
                  style={getAvatarGradientStyle(p.id)}
                  className="text-lg font-bold text-white"
                >
                  {initials}
                </AvatarFallback>
              </Avatar>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-foreground">
                  {name}
                </p>
                <p className="mb-1.5 truncate text-xs text-muted-foreground">
                  {specialty ?? "—"}
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <HugeiconsIcon
                      icon={StarIcon}
                      size={14}
                      className="fill-warning text-warning"
                    />
                    <span className="text-[13px] font-semibold tabular-nums text-foreground">
                      {(p.averageRating ?? 0).toFixed(1)}
                    </span>
                  </div>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {p._count?.bookings ?? 0} {t("employees.card.bookings")}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

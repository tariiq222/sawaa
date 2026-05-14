"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { StarIcon, Award01Icon } from "@hugeicons/core-free-icons"

import { Card } from "@deqah/ui"
import { Avatar, AvatarFallback } from "@deqah/ui"
import { cn } from "@/lib/utils"
import { useLocale } from "@/components/locale-provider"
import type { Employee } from "@/lib/types/employee"

interface TopPerformersProps {
  employees: Employee[]
}

/* Rank decorative colors — gold/silver/bronze (exception: these are decorative, not semantic) */
const rankStyles = [
  {
    card: "bg-gradient-to-br from-rank-gold-from to-rank-gold-to border-rank-gold-border",
    badge: "bg-gradient-to-br from-rank-gold-badge-from to-rank-gold-badge-to text-rank-gold-badge-text shadow-[0_2px_8px_var(--rank-gold-shadow)]",
  },
  {
    card: "bg-gradient-to-br from-rank-silver-from to-rank-silver-to border-rank-silver-border",
    badge: "bg-gradient-to-br from-rank-silver-badge-from to-rank-silver-badge-to text-rank-silver-badge-text shadow-[0_2px_8px_var(--rank-silver-shadow)]",
  },
  {
    card: "bg-gradient-to-br from-rank-bronze-from to-rank-bronze-to border-rank-bronze-border",
    badge: "bg-gradient-to-br from-rank-bronze-badge-from to-rank-bronze-badge-to text-primary-foreground shadow-[0_2px_8px_var(--rank-bronze-shadow)]",
  },
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
          const style = rankStyles[i]

          return (
            <div
              key={p.id}
              className={cn(
                "relative flex items-center gap-4 rounded-[10px] border p-5 transition-all hover:-translate-y-0.5 hover:shadow-sm",
                style.card
              )}
            >
              {/* Rank badge */}
              <div
                className={cn(
                  "absolute start-3 top-3 flex size-7 items-center justify-center rounded-full text-[13px] font-bold tabular-nums shadow-md",
                  style.badge
                )}
              >
                {i + 1}
              </div>

              {/* Avatar */}
              <Avatar className="size-12 shrink-0">
                <AvatarFallback className="bg-gradient-to-br from-avatar-1-from to-avatar-1-to text-lg font-bold text-primary-foreground">
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

"use client"

/**
 * Matching Credit Badge — Sawaa Dashboard
 *
 * Shown inside the booking wizard the moment the operator has chosen
 * client + service + employee + duration. Calls
 * `useMatchingCredits` to surface the client's ACTIVE matching credits
 * (FIFO order). When a match exists, the badge suggests "احجز من الرصيد"
 * — accepting flips `bookFromCreditMode` so the wizard's submit posts
 * to `/dashboard/bookings/from-credit` instead of `/dashboard/bookings`,
 * consuming the oldest matching credit for zero payment.
 *
 * Dismissal is sticky for the current (client, service, employee,
 * duration) selection — re-selecting any of them re-arms the badge.
 *
 * Props are intentionally minimal: parent owns the four ids and the
 * `enabled` gate (matches what the wizard already knows). The badge
 * does NOT block the normal flow: dismissing it (or having no match)
 * leaves the wizard to post to the regular paid endpoint.
 *
 * Render condition: the parent renders this only once ALL four ids are
 * set, so the hook's own "all params present" gate is belt-and-braces.
 */

import { useMemo } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { CheckmarkCircle02Icon, WalletAdd02Icon, Cancel01Icon } from "@hugeicons/core-free-icons"

import { Badge, Button } from "@sawaa/ui"

import { useMatchingCredits } from "@/hooks/use-credit-bookings"
import { useLocale } from "@/components/locale-provider"
import { cn } from "@/lib/utils"

/* ─── Props ─── */

interface MatchingCreditBadgeProps {
  clientId: string | null
  serviceId: string | null
  employeeId: string | null
  durationOptionId: string | null
  /** True when the wizard's submit should call `bookFromCredit`. */
  useCredit: boolean
  /** Sticky dismissal flag for the current selection. */
  dismissed: boolean
  onAccept: () => void
  onDismiss: () => void
}

/* ─── Component ─── */

export function MatchingCreditBadge({
  clientId,
  serviceId,
  employeeId,
  durationOptionId,
  useCredit,
  dismissed,
  onAccept,
  onDismiss,
}: MatchingCreditBadgeProps) {
  const { t } = useLocale()

  // Memoize the query object so TanStack Query doesn't re-fetch on
  // every render (object identity changes otherwise).
  const query = useMemo(
    () => ({
      clientId: clientId ?? "",
      serviceId: serviceId ?? "",
      employeeId: employeeId ?? "",
      durationOptionId: durationOptionId ?? "",
    }),
    [clientId, serviceId, employeeId, durationOptionId],
  )

  const allPresent =
    !!clientId && !!serviceId && !!employeeId && !!durationOptionId

  const { data: matches = [], isLoading } = useMatchingCredits(query, allPresent)

  // No params yet, still loading, no match, or dismissed → render nothing.
  if (!allPresent) return null
  if (dismissed) return null
  if (!isLoading && matches.length === 0) return null

  // When the wizard is in credit mode, show a confirmed "using credit" state.
  if (useCredit && matches.length > 0) {
    const first = matches[0]
    const bodyTemplate = t("bookings.credit.badge.body")
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/5 p-3"
        data-testid="matching-credit-badge"
        data-state="using"
      >
        <HugeiconsIcon
          icon={CheckmarkCircle02Icon}
          size={20}
          className="mt-0.5 shrink-0 text-success"
        />
        <div className="flex flex-1 flex-col gap-1">
          <p className="text-sm font-semibold text-foreground">
            {t("bookings.credit.badge.title")}
          </p>
          <p className="text-xs text-muted-foreground">
            {bodyTemplate.replace("{remaining}", String(first.remaining))}
          </p>
          <Badge
            variant="outline"
            className="mt-1 w-fit border-success/30 bg-success/10 text-[11px] text-success"
          >
            {t("bookings.credit.badge.using")}
          </Badge>
        </div>
      </div>
    )
  }

  // Suggestion state: there is a match, the user has not accepted/dismissed.
  const first = matches[0]
  const bodyTemplate = t("bookings.credit.badge.body")
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3"
      data-testid="matching-credit-badge"
      data-state="suggestion"
    >
      <HugeiconsIcon
        icon={WalletAdd02Icon}
        size={20}
        className="mt-0.5 shrink-0 text-primary"
      />
      <div className="flex flex-1 flex-col gap-2">
        <p className="text-sm font-semibold text-foreground">
          {t("bookings.credit.badge.title")}
        </p>
        {first && (
          <p className="text-xs text-muted-foreground">
            {bodyTemplate.replace("{remaining}", String(first.remaining))}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={onAccept}
            data-testid="matching-credit-accept"
            className={cn("h-8")}
          >
            {t("bookings.credit.badge.useCredit")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onDismiss}
            data-testid="matching-credit-dismiss"
            className="h-8 text-muted-foreground"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={14} className="me-1" />
            {t("bookings.credit.badge.dismiss")}
          </Button>
        </div>
      </div>
    </div>
  )
}
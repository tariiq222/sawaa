"use client"

import { cn } from "@/lib/utils"
import { BookingPos } from "./booking-pos"

interface BookingCreateViewProps {
  onSuccess: () => void
  onCancel: () => void
  className?: string
}

export function BookingCreateView({
  onSuccess,
  onCancel,
  className,
}: BookingCreateViewProps) {
  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-2xl border border-border bg-surface-solid shadow-sm",
        className,
      )}
    >
      <BookingPos onSuccess={onSuccess} onCancel={onCancel} />
    </div>
  )
}

"use client"
/* eslint-disable no-restricted-syntax */

/**
 * DateTimeInput — مكون موحد لحقول التاريخ والوقت معاً (datetime-local)
 *
 * الاستخدام الصحيح:
 *   import { DateTimeInput } from "./date-time-input"
 *   <DateTimeInput value={value} onChange={onChange} />
 *
 * مع react-hook-form:
 *   <Controller control={control} name="expiresAt"
 *     render={({ field }) => <DateTimeInput value={field.value} onChange={field.onChange} />}
 *   />
 *
 * ممنوع:
 *   - <Input type="datetime-local" ...>
 *   - أي datetime picker مباشر في صفحات الـ feature
 */

import * as React from "react"
import { cn } from "../lib/cn"

export interface DateTimeInputProps {
  /** ISO datetime string: "YYYY-MM-DDTHH:mm" or full ISO */
  value?: string
  onChange: (value: string) => void
  className?: string
  disabled?: boolean
  /** Minimum datetime — ISO "YYYY-MM-DDTHH:mm" */
  min?: string
  /** Maximum datetime — ISO "YYYY-MM-DDTHH:mm" */
  max?: string
  /** Show error state (red border) */
  error?: boolean
  required?: boolean
  placeholder?: string
  id?: string
  name?: string
}

export function DateTimeInput({
  value,
  onChange,
  className,
  disabled = false,
  min,
  max,
  error = false,
  required = false,
  placeholder,
  id,
  name,
}: DateTimeInputProps) {
  // Normalize ISO full strings to "YYYY-MM-DDTHH:mm" (required by datetime-local)
  const normalizedValue = React.useMemo(() => {
    if (!value) return ""
    // Already in datetime-local format
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return value
    // Full ISO — trim to datetime-local format
    if (value.includes("T")) return value.slice(0, 16)
    return value
  }, [value])

  return (
    <input
      type="datetime-local"
      id={id}
      name={name}
      value={normalizedValue}
      min={min}
      max={max}
      disabled={disabled}
      required={required}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        // Match shadcn Input styling exactly
        "flex h-9 w-full rounded-md border border-border bg-background px-3 py-1",
        "text-sm tabular-nums text-foreground shadow-sm",
        "transition-colors",
        "placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary",
        "disabled:cursor-not-allowed disabled:opacity-50",
        error && "border-destructive focus-visible:ring-destructive/30 focus-visible:border-destructive",
        className
      )}
    />
  )
}

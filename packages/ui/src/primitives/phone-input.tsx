"use client"

import * as React from "react"
import { cn } from "../lib/cn"

const COUNTRY_CODE = "+966"

interface PhoneInputProps {
  value?: string
  onChange?: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
}

export function PhoneInput({
  value = "",
  onChange,
  onBlur,
  placeholder = "5XXXXXXXX",
  disabled,
  className,
  id,
}: PhoneInputProps) {
  // Extract local digits from full E.164 value
  const displayValue = value.startsWith(COUNTRY_CODE)
    ? value.slice(COUNTRY_CODE.length)
    : value

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    let digits = e.target.value.replace(/\D/g, "")
    // Strip any leading zero the user types — Saudi local numbers start with 5
    while (digits.startsWith("0")) {
      digits = digits.slice(1)
    }
    // Saudi local number is exactly 9 digits starting with 5 (e.g. 5XXXXXXXX)
    if (digits.length > 9) {
      digits = digits.slice(0, 9)
    }
    onChange?.(digits ? `${COUNTRY_CODE}${digits}` : "")
  }

  return (
    <div
      dir="ltr"
      className={cn(
        "flex h-9 rounded-lg border border-border-strong bg-surface-solid text-sm shadow-sm transition-all duration-200",
        "hover:border-ring/40 focus-within:outline-none focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <span className="flex items-center px-3 text-muted-foreground border-e border-border-strong select-none font-numeric shrink-0 text-sm">
        +966
      </span>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        dir="ltr"
        disabled={disabled}
        placeholder={placeholder}
        value={displayValue}
        onChange={handleChange}
        onBlur={onBlur}
        className="flex-1 bg-transparent px-3 py-2 font-numeric placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 min-w-0"
      />
    </div>
  )
}

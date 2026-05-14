"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown01Icon } from "@hugeicons/core-free-icons"
import { Popover, PopoverContent, PopoverTrigger } from "@deqah/ui"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@deqah/ui"
import { cn } from "@/lib/utils"
import { COUNTRIES } from "@/lib/countries-data"
import { useLocale } from "@/components/locale-provider"

/* ─── Component ─── */

interface NationalitySelectProps {
  value?: string | null
  onChange: (value: string) => void
  locale?: "ar" | "en"
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
}

export function NationalitySelect({
  value,
  onChange,
  locale = "ar",
  placeholder,
  searchPlaceholder,
  emptyText,
  disabled = false,
}: NationalitySelectProps) {
  const [open, setOpen] = React.useState(false)
  const { t } = useLocale()

  const isAr = locale === "ar"

  const defaultPlaceholder       = t("common.nationality.placeholder")
  const defaultSearchPlaceholder = t("common.nationality.searchPlaceholder")
  const defaultEmptyText         = t("common.nationality.empty")

  // Match value by code, Arabic name, or English name
  const selected = value
    ? COUNTRIES.find(
        (c) =>
          c.code === value ||
          c.ar === value ||
          c.en === value ||
          c.en.toLowerCase() === value.toLowerCase()
      )
    : null

  const displayLabel = selected
    ? `${selected.emoji} ${isAr ? selected.ar : selected.en}`
    : null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-expanded={open}
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm",
            "ring-offset-background transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            !displayLabel && "text-muted-foreground"
          )}
        >
          <span className="truncate">
            {displayLabel ?? (placeholder ?? defaultPlaceholder)}
          </span>
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            strokeWidth={2}
            className={cn(
              "ms-2 size-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
        dir={isAr ? "rtl" : "ltr"}
      >
        <Command
          filter={(itemValue, search) => {
            const lower = search.toLowerCase()
            const country = COUNTRIES.find((c) => c.code === itemValue)
            if (!country) return 0
            const matchAr = country.ar.includes(search)
            const matchEn = country.en.toLowerCase().includes(lower)
            return matchAr || matchEn ? 1 : 0
          }}
        >
          <CommandInput
            placeholder={searchPlaceholder ?? defaultSearchPlaceholder}
            className="text-sm"
          />
          <CommandList>
            <CommandEmpty className="text-muted-foreground">
              {emptyText ?? defaultEmptyText}
            </CommandEmpty>
            <CommandGroup>
              {COUNTRIES.map((country) => (
                <CommandItem
                  key={country.code}
                  value={country.code}
                  onSelect={() => {
                    onChange(isAr ? country.ar : country.en)
                    setOpen(false)
                  }}
                  data-checked={
                    selected?.code === country.code ? "true" : undefined
                  }
                >
                  <span className="me-2">{country.emoji}</span>
                  <span>{isAr ? country.ar : country.en}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

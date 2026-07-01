"use client"

/**
 * MultiSelect — Sawaa Dashboard (packages feature)
 *
 * Compact, accessible multi-select built from `@sawaa/ui` primitives
 * (Popover + Command + Checkbox). No new primitive is added to
 * `components/ui/`; this is a feature-local composite.
 *
 * Behaviour:
 *   - A trigger button shows the current selection count (or a placeholder).
 *   - The popover holds a searchable checkbox list (Command filters by label).
 *   - Selection is controlled: `value` (ids) + `onChange`.
 *
 * RTL-safe (logical spacing only) and warm/calm per the design system.
 */

import { useState } from "react"

import { Button } from "@sawaa/ui"
import { Checkbox } from "@sawaa/ui"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@sawaa/ui"
import { Popover, PopoverContent, PopoverTrigger } from "@sawaa/ui"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown01Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"

export interface MultiSelectOption {
  value: string
  label: string
}

interface MultiSelectProps {
  options: MultiSelectOption[]
  value: string[]
  onChange: (next: string[]) => void
  placeholder: string
  searchPlaceholder: string
  emptyLabel: string
  disabled?: boolean
  id?: string
}

/** How many selected labels to spell out before collapsing the rest into "+N". */
const MAX_SHOWN_LABELS = 3

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  disabled,
  id,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false)

  const toggle = (val: string) => {
    onChange(value.includes(val) ? value.filter((v) => v !== val) : [...value, val])
  }

  // Show the actual selected names (not just a count); collapse the overflow.
  const selectedLabels = value
    .map((v) => options.find((o) => o.value === v)?.label)
    .filter((l): l is string => Boolean(l))
  const shown = selectedLabels.slice(0, MAX_SHOWN_LABELS).join("، ")
  const extra = selectedLabels.length - MAX_SHOWN_LABELS
  const triggerLabel =
    selectedLabels.length > 0 ? (extra > 0 ? `${shown} +${extra}` : shown) : placeholder

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span
            className={cn(
              "min-w-0 truncate text-start",
              value.length > 0 ? "text-foreground" : "text-muted-foreground",
            )}
            title={selectedLabels.join("، ")}
          >
            {triggerLabel}
          </span>
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            size={16}
            className="ms-2 shrink-0 text-muted-foreground"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const checked = value.includes(opt.value)
                return (
                  <CommandItem
                    key={opt.value}
                    value={opt.label}
                    onSelect={() => toggle(opt.value)}
                    className="gap-2"
                  >
                    <Checkbox checked={checked} className="pointer-events-none" />
                    <span className="truncate">{opt.label}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

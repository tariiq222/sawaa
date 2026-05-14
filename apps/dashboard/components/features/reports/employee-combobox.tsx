"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown01Icon, CheckmarkCircle01Icon } from "@hugeicons/core-free-icons"

import { Button } from "@deqah/ui"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@deqah/ui"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import { useEmployees } from "@/hooks/use-employees"
import { cn } from "@/lib/utils"

interface EmployeeComboboxProps {
  value: string
  onChange: (id: string) => void
}

export function EmployeeCombobox({ value, onChange }: EmployeeComboboxProps) {
  const { t, locale } = useLocale()
  const isAr = locale === "ar"
  const [open, setOpen] = useState(false)

  const { employees } = useEmployees()

  const selected = employees.find((p) => p.id === value)

  const displayName = selected
    ? isAr && selected.nameAr
      ? selected.nameAr
      : `${selected.user.firstName} ${selected.user.lastName}`
    : t("reports.selectEmployee")

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full max-w-sm justify-between"
        >
          <span className={cn(!selected && "text-muted-foreground")}>
            {displayName}
          </span>
          <HugeiconsIcon icon={ArrowDown01Icon} size={16} className="ms-2 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(320px,_calc(100vw-2rem))] p-0" align="start">
        <Command>
          <CommandInput placeholder={t("reports.searchEmployee")} />
          <CommandList>
            <CommandEmpty>{t("reports.noEmployeeFound")}</CommandEmpty>
            <CommandGroup>
              {employees.map((p) => {
                const name = isAr && p.nameAr
                  ? p.nameAr
                  : `${p.user.firstName} ${p.user.lastName}`
                return (
                  <CommandItem
                    key={p.id}
                    value={name}
                    onSelect={() => {
                      onChange(p.id === value ? "" : p.id)
                      setOpen(false)
                    }}
                  >
                    <HugeiconsIcon
                      icon={CheckmarkCircle01Icon}
                      size={14}
                      className={cn(
                        "me-2",
                        value === p.id ? "opacity-100 text-primary" : "opacity-0",
                      )}
                    />
                    {name}
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

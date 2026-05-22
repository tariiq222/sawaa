"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Skeleton,
} from "@sawaa/ui"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Building04Icon,
  Cancel01Icon,
  Tick02Icon,
  ArrowDown01Icon,
} from "@hugeicons/core-free-icons"
import { useRouter } from "next/navigation"

import { fetchBranches } from "@/lib/api/branches"
import { queryKeys } from "@/lib/query-keys"
import { useLocale } from "@/components/locale-provider"
import { cn } from "@/lib/utils"
import type { Branch } from "@/lib/types/branch"

interface EmployeeBranchesPickerProps {
  value: string[]
  onChange: (ids: string[]) => void
  /** Pre-select main branch (or first available) when value is empty. */
  autoSelectMain?: boolean
}

export function EmployeeBranchesPicker({
  value,
  onChange,
  autoSelectMain = false,
}: EmployeeBranchesPickerProps) {
  const { t, locale } = useLocale()
  const router = useRouter()
  const isAr = locale === "ar"
  const [open, setOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.branches.list({ page: 1, perPage: 100 }),
    queryFn: () => fetchBranches({ page: 1, perPage: 100 }),
    staleTime: 5 * 60 * 1000,
  })

  const branches: Branch[] = data?.items ?? []

  useEffect(() => {
    if (value.length > 0 || branches.length === 0) return
    // Single branch: pick it regardless of autoSelectMain — it's the only option.
    if (branches.length === 1) {
      onChange([branches[0].id])
      return
    }
    if (!autoSelectMain) return
    const main = branches.find((b) => b.isMain) ?? branches[0]
    if (main) onChange([main.id])
  }, [autoSelectMain, branches, value.length, onChange])

  const branchById = useMemo(() => {
    const map = new Map<string, Branch>()
    for (const b of branches) map.set(b.id, b)
    return map
  }, [branches])

  const selected = useMemo(
    () => value.map((id) => branchById.get(id)).filter((b): b is Branch => !!b),
    [value, branchById],
  )

  const toggle = (branchId: string) => {
    if (value.includes(branchId)) {
      onChange(value.filter((id) => id !== branchId))
    } else {
      onChange([...value, branchId])
    }
  }

  const remove = (branchId: string) => {
    onChange(value.filter((id) => id !== branchId))
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-5 w-40" />
      </div>
    )
  }

  if (branches.length === 0) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-surface-muted/40 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
            <HugeiconsIcon
              icon={Building04Icon}
              strokeWidth={1.5}
              className="size-5 text-muted-foreground"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {t("employees.branches.noBranchesHint")}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 gap-1.5"
          onClick={() => router.push("/branches/new")}
        >
          <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-3.5" />
          {t("employees.branches.addBranch")}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3" dir={isAr ? "rtl" : "ltr"}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-expanded={open}
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-start",
              "transition-colors hover:border-foreground/20 hover:bg-surface-muted/40",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary/60",
              open && "border-primary/60 ring-2 ring-primary/30",
            )}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <HugeiconsIcon
                icon={Building04Icon}
                strokeWidth={1.5}
                className="size-4 shrink-0 text-muted-foreground"
              />
              <span className="truncate text-sm text-foreground">
                {selected.length === 0
                  ? t("employees.branches.placeholder")
                  : t("employees.branches.summary").replace(
                      "{count}",
                      String(selected.length),
                    )}
              </span>
            </div>
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              strokeWidth={1.5}
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform",
                open && "rotate-180",
              )}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0"
        >
          <Command
            // Default cmdk filter does substring; works fine on Arabic.
            filter={(value, search) =>
              value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
            }
          >
            <CommandInput
              placeholder={t("employees.branches.searchPlaceholder")}
              dir={isAr ? "rtl" : "ltr"}
            />
            <CommandList className="max-h-72">
              <CommandEmpty>{t("employees.branches.noResults")}</CommandEmpty>
              <CommandGroup>
                {branches.map((branch) => {
                  const isSelected = value.includes(branch.id)
                  const label = isAr ? branch.nameAr : branch.nameEn
                  return (
                    <CommandItem
                      key={branch.id}
                      value={`${branch.nameAr} ${branch.nameEn ?? ""}`}
                      onSelect={() => toggle(branch.id)}
                      className="flex items-center justify-between gap-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm">{label}</span>
                        {branch.isMain && (
                          <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            {t("employees.branches.mainBadge")}
                          </span>
                        )}
                      </div>
                      <HugeiconsIcon
                        icon={Tick02Icon}
                        strokeWidth={2}
                        className={cn(
                          "size-4 shrink-0 text-primary transition-opacity",
                          isSelected ? "opacity-100" : "opacity-0",
                        )}
                      />
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((branch) => (
            <span
              key={branch.id}
              className={cn(
                "group inline-flex items-center gap-1.5 rounded-full border bg-surface ps-2.5 pe-1 py-1 text-xs",
                branch.isMain
                  ? "border-primary/30 bg-primary/5 text-primary"
                  : "border-border text-foreground",
              )}
            >
              <span className="max-w-[14ch] truncate">
                {isAr ? branch.nameAr : branch.nameEn}
              </span>
              {branch.isMain && (
                <span className="text-[9px] uppercase tracking-wider opacity-70">
                  {t("employees.branches.mainBadge")}
                </span>
              )}
              <button
                type="button"
                aria-label={t("employees.branches.removeAria")}
                onClick={() => remove(branch.id)}
                className={cn(
                  "ms-0.5 flex size-4 items-center justify-center rounded-full text-muted-foreground/70",
                  "transition-colors hover:bg-muted hover:text-foreground",
                  branch.isMain && "hover:bg-primary/15 hover:text-primary",
                )}
              >
                <HugeiconsIcon
                  icon={Cancel01Icon}
                  strokeWidth={2}
                  className="size-2.5"
                />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {t("employees.branches.emptyHint")}
        </p>
      )}
    </div>
  )
}

"use client"

import { useState } from "react"
import { Label } from "@deqah/ui"
import { Checkbox } from "@deqah/ui"
import { Skeleton } from "@deqah/ui"
import { RadioGroup, RadioGroupItem } from "@deqah/ui"
import { Button } from "@deqah/ui"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Building04Icon } from "@hugeicons/core-free-icons"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { fetchBranches } from "@/lib/api/branches"
import { queryKeys } from "@/lib/query-keys"
import { useLocale } from "@/components/locale-provider"

/* ─── Props ─── */

interface ServiceBranchesPickerProps {
  value: string[]
  onChange: (ids: string[]) => void
}

/* ─── Component ─── */

export function ServiceBranchesPicker({ value, onChange }: ServiceBranchesPickerProps) {
  const { t, locale } = useLocale()
  const router = useRouter()

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.branches.list({ page: 1, perPage: 100 }),
    queryFn: () => fetchBranches({ page: 1, perPage: 100 }),
    staleTime: 5 * 60 * 1000,
  })

  const branches = data?.items ?? []
  const [mode, setMode] = useState<"all" | "specific">(value.length > 0 ? "specific" : "all")

  const handleModeChange = (next: "all" | "specific") => {
    setMode(next)
    if (next === "all") {
      onChange([])
    }
  }

  const handleToggle = (branchId: string, checked: boolean) => {
    if (checked) {
      onChange([...value, branchId])
    } else {
      onChange(value.filter((id) => id !== branchId))
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
      </div>
    )
  }

  if (branches.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <HugeiconsIcon icon={Building04Icon} strokeWidth={1.5} className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">{t("services.branches.noBranchesHint")}</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 gap-1.5 text-xs"
          onClick={() => router.push("/branches/new")}
        >
          <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-3.5" />
          {t("services.branches.addBranch")}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <RadioGroup
        value={mode}
        onValueChange={(v) => handleModeChange(v as "all" | "specific")}
        dir={locale === "ar" ? "rtl" : "ltr"}
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem value="all" id="picker-branches-all" />
          <Label htmlFor="picker-branches-all" className="cursor-pointer text-sm">
            {t("services.branches.allBranchesLabel")}
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="specific" id="picker-branches-specific" />
          <Label htmlFor="picker-branches-specific" className="cursor-pointer text-sm">
            {t("services.branches.specificLabel")}
          </Label>
        </div>
      </RadioGroup>

      {mode === "specific" && (
        <div
          className="rounded-lg border border-border p-4 flex flex-col gap-3"
          dir={locale === "ar" ? "rtl" : "ltr"}
        >
          {branches.map((branch) => (
            <div key={branch.id} className="flex items-center gap-2">
              <Checkbox
                id={`picker-branch-${branch.id}`}
                checked={value.includes(branch.id)}
                onCheckedChange={(checked) => handleToggle(branch.id, !!checked)}
              />
              <Label htmlFor={`picker-branch-${branch.id}`} className="cursor-pointer text-sm">
                {locale === "ar" ? branch.nameAr : branch.nameEn}
              </Label>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

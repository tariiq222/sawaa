"use client"

import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { Checkbox, Label, Skeleton, Button } from "@sawaa/ui"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Building04Icon } from "@hugeicons/core-free-icons"
import { useRouter } from "next/navigation"

import { fetchBranches } from "@/lib/api/branches"
import { queryKeys } from "@/lib/query-keys"
import { useLocale } from "@/components/locale-provider"

interface EmployeeBranchesPickerProps {
  value: string[]
  onChange: (ids: string[]) => void
  /** When true, picks main branch automatically if value is empty after branches load. */
  autoSelectMain?: boolean
}

export function EmployeeBranchesPicker({
  value,
  onChange,
  autoSelectMain = false,
}: EmployeeBranchesPickerProps) {
  const { t, locale } = useLocale()
  const router = useRouter()

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.branches.list({ page: 1, perPage: 100 }),
    queryFn: () => fetchBranches({ page: 1, perPage: 100 }),
    staleTime: 5 * 60 * 1000,
  })

  const branches = data?.items ?? []

  useEffect(() => {
    if (!autoSelectMain || value.length > 0 || branches.length === 0) return
    const main = branches.find((b) => b.isMain) ?? branches[0]
    if (main) onChange([main.id])
  }, [autoSelectMain, branches, value.length, onChange])

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
          <p className="text-sm text-muted-foreground">{t("employees.branches.noBranchesHint")}</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 gap-1.5 text-xs"
          onClick={() => router.push("/branches/new")}
        >
          <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-3.5" />
          {t("employees.branches.addBranch")}
        </Button>
      </div>
    )
  }

  return (
    <div
      className="rounded-lg border border-border p-4 flex flex-col gap-3"
      dir={locale === "ar" ? "rtl" : "ltr"}
    >
      {branches.map((branch) => (
        <div key={branch.id} className="flex items-center gap-2">
          <Checkbox
            id={`employee-branch-${branch.id}`}
            checked={value.includes(branch.id)}
            onCheckedChange={(checked) => handleToggle(branch.id, !!checked)}
          />
          <Label htmlFor={`employee-branch-${branch.id}`} className="cursor-pointer text-sm">
            {locale === "ar" ? branch.nameAr : branch.nameEn}
            {branch.isMain && (
              <span className="ms-2 rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                {t("employees.branches.mainBadge")}
              </span>
            )}
          </Label>
        </div>
      ))}
    </div>
  )
}

"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Cancel01Icon } from "@hugeicons/core-free-icons"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogBody,
  DialogHeader,
  DialogTitle,
} from "@deqah/ui"
import { Button } from "@deqah/ui"
import { Input } from "@deqah/ui"
import { Skeleton } from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import { useBranchEmployees, useBranchEmployeeMutations } from "@/hooks/use-branches"
import { fetchEmployees } from "@/lib/api/employees"
import { queryKeys } from "@/lib/query-keys"
import type { Branch } from "@/lib/types/branch"

interface Props {
  branch: Branch | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BranchEmployeesDialog({ branch, open, onOpenChange }: Props) {
  const { t, locale } = useLocale()
  const [search, setSearch] = useState("")
  const branchName = branch ? (locale === "ar" ? branch.nameAr : branch.nameEn) : ""

  const { data: assigned = [], isLoading: loadingAssigned } = useBranchEmployees(
    open && branch ? branch.id : null,
  )
  const { assignMut, unassignMut } = useBranchEmployeeMutations(branch?.id ?? null)

  const { data: allEmployees, isLoading: loadingAll } = useQuery({
    queryKey: queryKeys.employees.list({ search, perPage: 50 }),
    queryFn: () => fetchEmployees({ search: search || undefined, perPage: 50 }),
    enabled: open,
    staleTime: 60 * 1000,
  })

  const assignedIds = useMemo(() => new Set(assigned.map((a) => a.employeeId)), [assigned])
  const available = useMemo(
    () => (allEmployees?.items ?? []).filter((e) => !assignedIds.has(e.id)),
    [allEmployees, assignedIds],
  )

  const handleAssign = async (employeeId: string) => {
    try {
      await assignMut.mutateAsync(employeeId)
      toast.success(t("branches.employees.assigned"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"))
    }
  }

  const handleUnassign = async (employeeId: string) => {
    try {
      await unassignMut.mutateAsync(employeeId)
      toast.success(t("branches.employees.unassigned"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {t("branches.employees.title")} — {branchName}
          </DialogTitle>
          <DialogDescription>{t("branches.employees.description")}</DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-6">
          {/* Assigned */}
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              {t("branches.employees.assignedSection")} ({assigned.length})
            </h3>
            {loadingAssigned ? (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={`skeleton-${i}`} className="h-12 w-full rounded-md" />
                ))}
              </div>
            ) : assigned.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("branches.employees.none")}</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {assigned.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">
                        {locale === "ar" ? a.employee.name : a.employee.nameEn}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {a.employee.specialtyAr || a.employee.specialty || a.employee.email}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleUnassign(a.employeeId)}
                      disabled={unassignMut.isPending}
                      title={t("branches.employees.remove")}
                    >
                      <HugeiconsIcon icon={Cancel01Icon} size={14} />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Available */}
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              {t("branches.employees.availableSection")}
            </h3>
            <Input
              placeholder={t("branches.employees.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {loadingAll ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={`skeleton-${i}`} className="h-12 w-full rounded-md" />
                ))}
              </div>
            ) : available.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("branches.employees.noAvailable")}
              </p>
            ) : (
              <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
                {available.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">
                        {e.user?.firstName} {e.user?.lastName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {e.specialtyAr || e.specialty || e.user?.email}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleAssign(e.id)}
                      disabled={assignMut.isPending}
                      title={t("branches.employees.add")}
                    >
                      <HugeiconsIcon icon={Add01Icon} size={14} />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import { useState, useMemo } from "react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { UserIcon, Search01Icon, Tick02Icon } from "@hugeicons/core-free-icons"

// Deterministic avatar color index from a string
function getAvatarIndex(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash) % 8 + 1
}

// Extract initials — first char of first + last word
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@deqah/ui"
import { Button } from "@deqah/ui"
import { Input } from "@deqah/ui"
import { Skeleton } from "@deqah/ui"
import { cn } from "@/lib/utils"
import { useQuery } from "@tanstack/react-query"
import { fetchEmployees } from "@/lib/api/employees"
import { queryKeys } from "@/lib/query-keys"
import { useAssignEmployeesToService } from "@/hooks/use-services"
import { useLocale } from "@/components/locale-provider"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  serviceId: string
  excludeIds: string[]
  /** In create mode: don't call the API, just return selected IDs to parent */
  createMode?: boolean
  onCreateAssign?: (ids: string[]) => void
}

export function AssignEmployeesDialog({
  open,
  onOpenChange,
  serviceId,
  excludeIds,
  createMode,
  onCreateAssign,
}: Props) {
  const { t, locale } = useLocale()
  const isAr = locale === "ar"
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<string[]>([])

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.employees.list({ perPage: 200, isActive: undefined }),
    queryFn: () => fetchEmployees({ perPage: 200 }),
    staleTime: 5 * 60 * 1000,
    enabled: open,
  })
  const assignMut = useAssignEmployeesToService(serviceId)

  // Filter: exclude already-assigned, apply search
  const available = useMemo(() => {
    const employees = data?.items ?? []
    return employees.filter((p) => {
      if (excludeIds.includes(p.id)) return false
      if (!search) return true
      const fullName = `${p.user.firstName} ${p.user.lastName}`.toLowerCase()
      const nameAr = (p.nameAr ?? "").toLowerCase()
      const q = search.toLowerCase()
      return fullName.includes(q) || nameAr.includes(q)
    })
  }, [data, excludeIds, search])

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const handleSave = async () => {
    if (selected.length === 0) return

    if (createMode) {
      onCreateAssign?.(selected)
      setSelected([])
      setSearch("")
      onOpenChange(false)
      return
    }

    try {
      await assignMut.mutateAsync(selected)
      toast.success(t("services.employees.assignSuccess"))
      setSelected([])
      setSearch("")
      onOpenChange(false)
    } catch {
      toast.error(t("services.employees.assignError"))
    }
  }

  const handleClose = () => {
    setSelected([])
    setSearch("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("services.employees.dialogTitle")}</DialogTitle>
          <DialogDescription>
            {t("services.employees.dialogDesc")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 px-6 py-4">
        {/* Search */}
        <div className="relative">
          <HugeiconsIcon
            icon={Search01Icon}
            strokeWidth={1.5}
            className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
          />
          <Input
            placeholder={t("services.employees.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9"
          />
        </div>

        {/* List with scroll fade */}
        <div className="relative">
          <div role="listbox" aria-multiselectable="true" aria-label={t("services.employees.dialogTitle")} className="max-h-72 overflow-y-auto space-y-1 -mx-1 px-1">
            {isLoading ? (
              <>
                <Skeleton className="h-14 w-full rounded-lg" />
                <Skeleton className="h-14 w-full rounded-lg" />
                <Skeleton className="h-14 w-full rounded-lg" />
              </>
            ) : available.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <HugeiconsIcon icon={UserIcon} strokeWidth={1.5} className="size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {search
                    ? t("services.employees.noResults")
                    : t("services.employees.allAssigned")}
                </p>
              </div>
            ) : (
              available.map((p) => {
                const fullName = `${p.user.firstName} ${p.user.lastName}`
                const displayName = isAr && p.nameAr ? p.nameAr : fullName
                const isSelected = selected.includes(p.id)
                const avatarIdx = getAvatarIndex(p.id)
                const initials = getInitials(displayName)
                const specialtyLabel = p.specialty
                  ? (isAr ? (p.specialtyAr || p.specialty) : p.specialty)
                  : null

                return (
                  <button
                    key={p.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => toggle(p.id)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-start transition-colors",
                      "hover:bg-surface-muted",
                      isSelected && "bg-primary/10 hover:bg-primary/15",
                    )}
                  >
                    {/* Avatar with initials */}
                    <div
                      className={cn(
                        "size-9 shrink-0 rounded-full flex items-center justify-center",
                        `bg-gradient-to-br from-avatar-${avatarIdx}-from to-avatar-${avatarIdx}-to`,
                      )}
                    >
                      <span className="text-xs font-semibold text-white leading-none">
                        {initials}
                      </span>
                    </div>

                    {/* Name + specialty + inactive badge inline */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {specialtyLabel && (
                          <p className="text-xs text-muted-foreground truncate">{specialtyLabel}</p>
                        )}
                        {!p.isActive && (
                          <>
                            {specialtyLabel && <span className="text-xs text-muted-foreground/40">·</span>}
                            <span className="text-xs text-muted-foreground/70">
                              {t("common.inactive")}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Radio-style circle indicator */}
                    <div
                      className={cn(
                        "size-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                        isSelected
                          ? "bg-primary border-primary"
                          : "border-border",
                      )}
                    >
                      {isSelected && (
                        <HugeiconsIcon icon={Tick02Icon} strokeWidth={3} className="size-2.5 text-primary-foreground" />
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>
          {/* Scroll fade — signals more content below */}
          {available.length > 4 && (
            <div className="pointer-events-none absolute bottom-0 start-0 end-0 h-8 bg-gradient-to-t from-surface-solid to-transparent rounded-b-lg" />
          )}
        </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            disabled={selected.length === 0 || assignMut.isPending}
            onClick={handleSave}
          >
            {assignMut.isPending
              ? t("services.employees.assigning")
              : `${t("services.employees.assignBtn")}${selected.length > 0 ? ` (${selected.length})` : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

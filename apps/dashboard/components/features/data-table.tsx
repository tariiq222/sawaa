"use client"

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
} from "@tanstack/react-table"
import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowUpIcon, ArrowDownIcon, ArrowUpDownIcon } from "@hugeicons/core-free-icons"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@deqah/ui"
import { Button } from "@deqah/ui"
import { EmptyState } from "@/components/features/empty-state"
import { useLocale } from "@/components/locale-provider"
import { cn } from "@/lib/utils"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: { label: string; onClick: () => void }
  /** When true, disable the built-in client pagination. If the server-side
   * pagination props below are provided the component renders its own prev/next
   * UI wired to them; if omitted, pagination is hidden entirely. */
  serverPaginated?: boolean
  /** Server pagination controls — only meaningful when serverPaginated is true. */
  page?: number
  totalPages?: number
  hasPreviousPage?: boolean
  hasNextPage?: boolean
  onPageChange?: (page: number) => void
  /** When true, sorting is owned by the server. Provide `sorting` + `onSortingChange`. */
  manualSorting?: boolean
  sorting?: SortingState
  onSortingChange?: (sorting: SortingState) => void
}

export function DataTable<TData, TValue>({
  columns,
  data,
  emptyTitle,
  emptyDescription,
  emptyAction,
  serverPaginated = false,
  page,
  totalPages,
  hasPreviousPage,
  hasNextPage,
  onPageChange,
  manualSorting = false,
  sorting: externalSorting,
  onSortingChange: externalOnSortingChange,
}: DataTableProps<TData, TValue>) {
  const [internalSorting, setInternalSorting] = useState<SortingState>([])
  const sorting = manualSorting ? (externalSorting ?? []) : internalSorting
  const { t } = useLocale()

  const table = useReactTable({
    data: data ?? [],
    columns: columns ?? [],
    getCoreRowModel: getCoreRowModel(),
    ...(serverPaginated ? {} : { getPaginationRowModel: getPaginationRowModel() }),
    ...(manualSorting
      ? { manualSorting: true as const }
      : { getSortedRowModel: getSortedRowModel() }),
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater
      if (manualSorting) externalOnSortingChange?.(next)
      else setInternalSorting(next)
    },
    state: { sorting },
  })

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-sm">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  const sorted = header.column.getIsSorted()
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            "flex items-center gap-1.5 text-xs font-medium transition-colors",
                            sorted ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <HugeiconsIcon
                            icon={sorted === "asc" ? ArrowUpIcon : sorted === "desc" ? ArrowDownIcon : ArrowUpDownIcon}
                            size={12}
                            className={sorted ? "text-primary" : "text-muted-foreground/50"}
                          />
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-48">
                  <EmptyState
                    title={emptyTitle ?? t("table.noResults")}
                    description={emptyDescription ?? t("table.noData")}
                    action={emptyAction}
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {!serverPaginated && table.getPageCount() > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-muted-foreground tabular-nums">
            {t("table.page")} {table.getState().pagination.pageIndex + 1} {t("table.of")} {table.getPageCount()}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              {t("table.previous")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              {t("table.next")}
            </Button>
          </div>
        </div>
      )}

      {serverPaginated && onPageChange && typeof page === "number" && typeof totalPages === "number" && totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-muted-foreground tabular-nums">
            {t("table.page")} {page} {t("table.of")} {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={!hasPreviousPage}
            >
              {t("table.previous")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={!hasNextPage}
            >
              {t("table.next")}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

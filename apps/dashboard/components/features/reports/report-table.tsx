"use client"

import { type ReactNode } from "react"

export interface ReportTableColumn<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  className?: string
}

interface ReportTableProps<T> {
  columns: ReportTableColumn<T>[]
  rows: T[]
  getRowKey: (row: T) => string
  emptyText?: string
}

export function ReportTable<T>({
  columns,
  rows,
  getRowKey,
  emptyText = "—",
}: ReportTableProps<T>) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-border text-xs text-muted-foreground">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={col.className ?? "px-3 py-2 text-start font-medium"}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowKey(row)} className="border-b border-border last:border-b-0">
              {columns.map((col) => (
                <td key={col.key} className="px-3 py-2">
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

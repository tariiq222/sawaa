"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@sawaa/ui"
import type { GroupProgramListItem } from "@/lib/types/group-program"

function formatPrice(halalas: number): string {
  return (halalas / 100).toLocaleString("en-SA", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

interface GetGroupProgramColumnsOptions {
  t: (key: string) => string
  departmentName: (id: string) => string
}

export function getGroupProgramColumns({
  t,
  departmentName,
}: GetGroupProgramColumnsOptions): ColumnDef<GroupProgramListItem>[] {
  return [
    {
      accessorKey: "nameAr",
      header: t("groupPrograms.col.name"),
      cell: ({ row }) => (
        <span className="font-medium">{row.original.nameAr || row.original.nameEn}</span>
      ),
    },
    {
      accessorKey: "departmentId",
      header: t("groupPrograms.col.department"),
      cell: ({ row }) => departmentName(row.original.departmentId),
    },
    {
      id: "participants",
      header: t("groupPrograms.col.participants"),
      cell: ({ row }) => (
        <span className="tabular-nums">
          {row.original.minParticipants}–{row.original.maxParticipants}
        </span>
      ),
    },
    {
      accessorKey: "defaultPrice",
      header: t("groupPrograms.col.price"),
      cell: ({ row }) => (
        <span className="tabular-nums">
          {formatPrice(row.original.defaultPrice)} {t("groupPrograms.currency")}
        </span>
      ),
    },
    {
      accessorKey: "isActive",
      header: t("groupPrograms.col.status"),
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "success" : "secondary"}>
          {t(row.original.isActive ? "groupPrograms.status.active" : "groupPrograms.status.inactive")}
        </Badge>
      ),
    },
  ]
}

"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import { useLocale } from "@/components/locale-provider"
import { useGroupPrograms } from "@/hooks/use-group-programs"
import { useDepartmentOptions } from "@/hooks/use-departments"
import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { DataTable } from "@/components/features/data-table"
import { ErrorBanner } from "@/components/features/error-banner"
import { Button, Skeleton } from "@sawaa/ui"
import { getGroupProgramColumns } from "./group-program-columns"

export function GroupProgramsPageContent() {
  const { t } = useLocale()
  const router = useRouter()
  const { programs, loading, error } = useGroupPrograms()
  const { options: departments } = useDepartmentOptions()

  const departmentName = useMemo(() => {
    const map = new Map(departments.map((d) => [d.id, d.nameAr || d.nameEn]))
    return (id: string) => map.get(id) ?? "—"
  }, [departments])

  const columns = getGroupProgramColumns({ t, departmentName })

  return (
    <ListPageShell>
      <Breadcrumbs />

      <PageHeader
        title={t("groupPrograms.title")}
        description={t("groupPrograms.description")}
      >
        <Button onClick={() => router.push("/group-programs/create")}>
          {t("groupPrograms.newProgram")}
        </Button>
      </PageHeader>

      {error && <ErrorBanner message={error} />}

      {loading && programs.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={`row-${i}`} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={programs}
          emptyTitle={t("groupPrograms.empty.title")}
          emptyDescription={t("groupPrograms.empty.description")}
        />
      )}
    </ListPageShell>
  )
}

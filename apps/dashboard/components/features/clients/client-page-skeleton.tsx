import { ListPageShell } from "@/components/features/list-page-shell"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { Skeleton } from "@sawaa/ui"

export function ClientPageSkeleton() {
  return (
    <ListPageShell>
      <Breadcrumbs />
      <Skeleton className="h-16 w-80 rounded-xl" />
      <div className="flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={`skeleton-${i}`} className="h-[160px] rounded-xl" />
        ))}
      </div>
    </ListPageShell>
  )
}

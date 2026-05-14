"use client"

import { useQuery } from "@tanstack/react-query"

import { queryKeys } from "@/lib/query-keys"
import { fetchEmployeeRatings } from "@/lib/api/employees"
import { formatDatePattern } from "@/lib/date"
import type { Rating } from "@/lib/types/rating"

/* ─── Helpers ─── */

function StarDisplay({ stars }: { stars: number }) {
  return (
    <span className="text-xs font-medium tabular-nums text-foreground">
      {"★".repeat(stars)}
      {"☆".repeat(5 - stars)}
    </span>
  )
}

/* ─── Props ─── */

interface EmployeeRatingsProps {
  employeeId: string
}

/* ─── Component ─── */

export function EmployeeRatings({
  employeeId,
}: EmployeeRatingsProps) {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.employees.ratings(employeeId),
    queryFn: () => fetchEmployeeRatings(employeeId, { perPage: 10 }),
    enabled: !!employeeId,
  })

  const ratings = data?.items ?? []

  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Recent Ratings
      </h4>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : ratings.length === 0 ? (
        <p className="text-xs text-muted-foreground">No ratings yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {ratings.map((r: Rating) => (
            <div
              key={r.id}
              className="flex flex-col gap-1 rounded-md border border-border p-2"
            >
              <div className="flex items-center justify-between">
                <StarDisplay stars={r.stars} />
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {formatDatePattern(r.createdAt, "MMM d, yyyy")}
                </span>
              </div>
              {r.client && (
                <span className="text-xs text-muted-foreground">
                  {r.client.firstName} {r.client.lastName}
                </span>
              )}
              {r.comment && (
                <p className="text-xs text-foreground">{r.comment}</p>
              )}
            </div>
          ))}
          {data?.meta && data.meta.total > 10 && (
            <p className="text-center text-[10px] text-muted-foreground">
              Showing 10 of {data.meta.total} ratings
            </p>
          )}
        </div>
      )}
    </div>
  )
}

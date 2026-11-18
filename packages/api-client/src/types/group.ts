/**
 * NOT derived: no module in this package calls a groups/programs route, and
 * the documented group entity (`ProgramListItemResponseDto`) has a different
 * status vocabulary (`DRAFT | OPEN | MIN_REACHED | SCHEDULED | COMPLETED |
 * CANCELLED`), a flat `nameAr`/`nameEn` row and no `service`/`employee`
 * nesting. This legacy type keeps its historical shape; `GroupStatus` is
 * declared as a documented subset for traceability.
 */
export type GroupStatus = 'active' | 'completed' | 'cancelled'

/** NOT derived: see `GroupStatus`. Kept hand-written. */
export interface GroupListItem {
  id: string
  nameAr: string
  nameEn: string
  status: GroupStatus
  maxCapacity: number
  enrolledCount: number
  startDate: string
  endDate?: string
  service: { id: string; nameAr: string }
  employee: { id: string; user: { firstName: string; lastName: string } }
  createdAt: string
}

/** NOT derived: see `GroupStatus`. Kept hand-written. */
export interface GroupListQuery {
  page?: number
  limit?: number
  search?: string
  status?: GroupStatus
}

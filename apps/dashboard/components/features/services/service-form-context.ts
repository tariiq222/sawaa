import { formatRef } from "@/lib/utils"
import type { ServiceCategory } from "@/lib/types/service"

export type CreateCategoryContext =
  | { status: "loading" | "error" | "missing" | "invalid" }
  | { status: "direct"; category: ServiceCategory }
  | { status: "valid"; category: ServiceCategory }

export function resolveCreateCategoryContext(
  categoryId: string | null,
  categories: ServiceCategory[],
  state: { isLoading: boolean; isError: boolean },
): CreateCategoryContext {
  if (state.isLoading) return { status: "loading" }
  if (state.isError) return { status: "error" }
  if (!categoryId) return { status: "missing" }

  const category = categories.find((candidate) => candidate.id === categoryId)
  if (!category) return { status: "invalid" }
  if (category.bookingMode === "DIRECT") return { status: "direct", category }
  return { status: "valid", category }
}

export function categoryServicesReturnPath(category: Pick<ServiceCategory, "ref">): string {
  return `/categories/${formatRef("CAT", category.ref)}/edit?tab=services`
}

export function getInitialCategoryContextValue(
  categoryId: string | null,
  currentValue: string | undefined,
  hasUserEdit: boolean,
): string | undefined {
  if (!categoryId || currentValue || hasUserEdit) return undefined
  return categoryId
}

export function canSubmitCreateCategoryContext(
  hasContext: boolean,
  contextStatus: CreateCategoryContext["status"] | undefined,
): boolean {
  return !hasContext || contextStatus === "valid"
}

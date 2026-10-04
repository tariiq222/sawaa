"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchCategories } from "@/lib/api/services"
import { queryKeys } from "@/lib/query-keys"

export function useServiceFormCategories() {
  return useQuery({
    queryKey: [...queryKeys.services.categories(), "service-form-complete"],
    queryFn: async () => {
      const firstPage = await fetchCategories({ page: 1, limit: 200 })
      if (firstPage.meta.totalPages <= 1) return firstPage.items

      const remainingPages = await Promise.all(
        Array.from({ length: firstPage.meta.totalPages - 1 }, (_, index) =>
          fetchCategories({ page: index + 2, limit: 200 }),
        ),
      )
      return [...firstPage.items, ...remainingPages.flatMap((page) => page.items)]
    },
    staleTime: 5 * 60 * 1000,
  })
}

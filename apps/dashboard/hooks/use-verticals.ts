"use client"

import { useQuery } from "@tanstack/react-query"

interface VerticalOption {
  id: string
  slug: string
  nameAr: string
  nameEn: string | null
}

async function fetchVerticals(): Promise<VerticalOption[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/public/verticals`)
  if (!res.ok) throw new Error("Failed to fetch verticals")
  return res.json() as Promise<VerticalOption[]>
}

export function useVerticals() {
  return useQuery({
    queryKey: ["verticals"],
    queryFn: fetchVerticals,
    staleTime: 60 * 60 * 1000, // 1 hour — verticals rarely change
    retry: 2,
  })
}

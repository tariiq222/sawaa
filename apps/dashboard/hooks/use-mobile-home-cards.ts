"use client"

import { useQuery } from "@tanstack/react-query"
import {
  fetchMobileHomeCards,
} from "@/lib/api/mobile-home-cards"

const mobileHomeCardsKey = ["mobile-home-cards", "admin"] as const

export function useMobileHomeCards() {
  return useQuery({
    queryKey: mobileHomeCardsKey,
    queryFn: fetchMobileHomeCards,
    staleTime: 60_000,
  })
}

"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  createMobileHomeCard,
  reorderMobileHomeCards,
  updateMobileHomeCard,
  uploadMobileHomeCardImage,
} from "@/lib/api/mobile-home-cards"
import type {
  CreateMobileHomeCardPayload,
  MobileHomeCardOrderItem,
  UpdateMobileHomeCardPayload,
} from "@/lib/types/mobile-home-cards"

const mobileHomeCardsKey = ["mobile-home-cards", "admin"] as const

export function useMobileHomeCardMutations() {
  const queryClient = useQueryClient()
  const refreshCards = () =>
    queryClient.invalidateQueries({ queryKey: mobileHomeCardsKey, refetchType: "all" })

  const create = useMutation({
    mutationFn: (payload: CreateMobileHomeCardPayload) => createMobileHomeCard(payload),
    onSuccess: refreshCards,
  })
  const update = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & UpdateMobileHomeCardPayload) =>
      updateMobileHomeCard(id, payload),
    onSuccess: refreshCards,
  })
  const reorder = useMutation({
    mutationFn: (items: MobileHomeCardOrderItem[]) => reorderMobileHomeCards(items),
    onSuccess: refreshCards,
  })
  const uploadImage = useMutation({ mutationFn: uploadMobileHomeCardImage })

  return { create, update, reorder, uploadImage }
}

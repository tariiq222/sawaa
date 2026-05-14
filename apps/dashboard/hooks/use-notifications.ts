"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { queryKeys } from "@/lib/query-keys"
import {
  fetchNotifications,
  fetchUnreadCount,
  markAllAsRead,
  markOneAsRead,
} from "@/lib/api/notifications"
import type { NotificationListQuery } from "@/lib/types/notification"

/* ─── List Hook ─── */

export function useNotifications() {
  const [page, setPage] = useState(1)

  const query: NotificationListQuery = { page, perPage: 20 }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.notifications.list(query),
    queryFn: () => fetchNotifications(query),
    staleTime: 60_000,
  })

  return {
    notifications: data?.items ?? [],
    meta: data?.meta ?? null,
    isLoading,
    error: error?.message ?? null,
    page,
    setPage,
    refetch,
  }
}

/* ─── Dashboard Feed (5 items, no pagination) ─── */

export function useDashboardNotifications() {
  const query: NotificationListQuery = { perPage: 5 }
  return useQuery({
    queryKey: queryKeys.notifications.list(query),
    queryFn: () => fetchNotifications(query),
    staleTime: 60_000,
  })
}

/* ─── Unread Count (polls every 30s) ─── */

export function useUnreadCount() {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: fetchUnreadCount,
    refetchInterval: 30_000,
    staleTime: 30_000,
  })
}

/* ─── Mutations ─── */

export function useNotificationMutations() {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })

  const markAllMut = useMutation({
    mutationFn: markAllAsRead,
    onSuccess: invalidate,
  })

  const markOneMut = useMutation({
    mutationFn: (id: string) => markOneAsRead(id),
    onSuccess: invalidate,
  })

  return { markAllMut, markOneMut }
}

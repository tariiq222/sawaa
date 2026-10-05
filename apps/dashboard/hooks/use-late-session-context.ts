'use client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { fetchLateSessionContext } from '@/lib/api/late-session'
import { fetchBooking } from '@/lib/api/bookings'
import { queryKeys } from '@/lib/query-keys'

export function useLateSessionContext() {
  return useQuery({
    queryKey: [...queryKeys.bookings.all, 'late-entry-context'],
    queryFn: fetchLateSessionContext,
    staleTime: 30000,
  })
}

export function useOpenLateSessionConflict() {
  // Fetch the authorized detail before navigation; a conflict ID alone is not a booking projection.
  return useMutation({ mutationFn: fetchBooking })
}

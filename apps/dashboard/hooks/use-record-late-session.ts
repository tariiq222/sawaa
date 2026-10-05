'use client'
import { useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { recordLateSession } from '@/lib/api/late-session'
import { createIdempotencyKey } from '@/lib/idempotency'
import type { RecordLateSessionPayload } from '@/lib/types/late-session'
export function useRecordLateSession() {
  const client = useQueryClient()
  const attempt = useRef<{ body: string; key: string } | null>(null)
  const mutation = useMutation({
    mutationFn: recordLateSession,
    onSuccess: () => {
      attempt.current = null
      for (const key of [
        'bookings',
        'invoices',
        'payments',
        'dashboard',
        'reports',
        'clients',
      ])
        void client.invalidateQueries({ queryKey: [key] })
    },
  })
  const submit = (
    payload: Omit<RecordLateSessionPayload, 'creationIdempotencyKey'>
  ) => {
    const body = JSON.stringify(payload)
    if (attempt.current?.body !== body)
      attempt.current = { body, key: createIdempotencyKey() }
    return mutation.mutateAsync({
      ...payload,
      creationIdempotencyKey: attempt.current.key,
    })
  }
  return { ...mutation, submit }
}

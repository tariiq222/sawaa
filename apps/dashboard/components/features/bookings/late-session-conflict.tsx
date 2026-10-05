'use client'
import { ApiError } from '@/lib/api'

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {}
}

export function lateSessionConflict(
  error: unknown
): { bookingId?: string } | null {
  if (
    !(error instanceof ApiError) ||
    error.status !== 409 ||
    error.code !== 'ALREADY_RECORDED_SESSION'
  )
    return null
  const body = object(error.body)
  const nested = object(body.error)
  const details = object(nested.details ?? body.details)
  const id = body.bookingId ?? nested.bookingId ?? details.bookingId
  return { ...(typeof id === 'string' && id ? { bookingId: id } : {}) }
}

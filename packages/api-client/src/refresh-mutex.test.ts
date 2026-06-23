/// <reference types="node" />
import { afterEach, describe, expect, it } from 'vitest'
import { getRefreshMutex, setRefreshMutex } from './refresh-mutex'

// The mutex is module-level state. Each test must reset to null so the next
// test starts clean. Passing a resolved promise and awaiting it forces the
// .finally() cleanup to run and refreshPromise back to null.
async function resetMutex(): Promise<void> {
  setRefreshMutex(Promise.resolve('reset'))
  // Two microtask ticks: .finally() then .catch()
  await Promise.resolve()
  await Promise.resolve()
  if (getRefreshMutex() !== null) {
    // Belt-and-braces: flush a real task if microtasks didn't do it
    await new Promise((r) => setTimeout(r, 0))
  }
}

afterEach(async () => {
  await resetMutex()
})

describe('refresh-mutex', () => {
  it('returns null when no refresh is in flight', () => {
    expect(getRefreshMutex()).toBeNull()
  })

  it('exposes the in-flight promise to all concurrent callers (serializes refreshes)', () => {
    const inflight = new Promise<string>(() => {
      // never resolves — we only care that getRefreshMutex returns the same instance
    })
    setRefreshMutex(inflight)

    // Simulate 5 concurrent 401 callers each pulling the mutex.
    const a = getRefreshMutex()
    const b = getRefreshMutex()
    const c = getRefreshMutex()
    const d = getRefreshMutex()
    const e = getRefreshMutex()

    expect(a).toBe(inflight)
    expect(b).toBe(inflight)
    expect(c).toBe(inflight)
    expect(d).toBe(inflight)
    expect(e).toBe(inflight)
  })

  it('resets to null after the refresh promise resolves', async () => {
    setRefreshMutex(Promise.resolve('new-token'))

    // Drain microtasks so the .finally() chain runs to completion.
    await Promise.resolve()
    await Promise.resolve()

    expect(getRefreshMutex()).toBeNull()
  })

  it('resets to null after the refresh promise rejects', async () => {
    // We must attach a .catch ourselves BEFORE setRefreshMutex to swallow the
    // rejection on this handle. The sentinel inside setRefreshMutex has its own
    // .catch — we test that separately.
    const rejecting = Promise.reject(new Error('refresh failed'))
    rejecting.catch(() => {}) // silence the "external" handle
    setRefreshMutex(rejecting)

    // Flush the .finally() cleanup
    await Promise.resolve()
    await Promise.resolve()

    expect(getRefreshMutex()).toBeNull()
  })

  it('does not produce an unhandled rejection when the refresh promise rejects', async () => {
    const unhandled: unknown[] = []
    const listener = (reason: unknown) => {
      unhandled.push(reason)
    }
    process.on('unhandledRejection', listener)

    try {
      // Feed a rejected promise straight into setRefreshMutex. Without the
      // .finally().catch() sentinel, the rejection would be unhandled.
      setRefreshMutex(Promise.reject(new Error('refresh failed')))

      // Give Node time to process any unhandledRejection.
      await new Promise((r) => setTimeout(r, 10))
    } finally {
      process.off('unhandledRejection', listener)
    }

    expect(unhandled).toEqual([])
    expect(getRefreshMutex()).toBeNull()
  })
})

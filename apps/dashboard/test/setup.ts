import '@testing-library/jest-dom'
import { beforeEach } from 'vitest'

// Suppress the known cross-file 'Refresh failed' unhandled rejection.
// The api-client deliberately rejects the cached refresh-mutex promise so
// every concurrent awaiter throws on auth failure. Real awaiters always catch
// it (api.get → ApiError → tests assert via rejects.toThrow). Only the cached
// reference itself can be flagged "unhandled" between vi.resetModules() cycles.
process.on('unhandledRejection', (reason) => {
  if (reason instanceof Error && reason.message === 'Refresh failed') return
  throw reason
})

// Stub localStorage for jsdom
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

// Reset between tests
beforeEach(() => {
  localStorage.clear()
})

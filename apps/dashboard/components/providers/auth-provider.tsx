"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import type { ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  login as apiLogin,
  acceptAuthResponse,
  logoutApi,
  fetchMe,
  refreshToken,
} from "@/lib/api/auth"
import type { AuthUser, AuthResponse } from "@/lib/api/auth"
import { getSessionGeneration, setAccessToken, subscribeToAuthFailure } from "@/lib/api"

/* ─── Context Shape ─── */

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  restoreError: boolean
  permissions: string[]
  retryRestore: () => void
  login: (identifier: string, password: string) => Promise<void>
  loginWithTokens: (res: AuthResponse, expectedSessionGeneration?: number) => void
  logout: () => Promise<void>
  isAuthenticated: boolean
  canDo: (module: string, action: string) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

function isTerminalAuthError(error: unknown): boolean {
  if (error && typeof error === "object") {
    const status = (error as { status?: unknown }).status
    return status === 401 || status === 403
  }
  return false
}

/* ─── Provider ─── */

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [restoreError, setRestoreError] = useState(false)
  const [permissions, setPermissions] = useState<string[]>([])
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refreshAbortRef = useRef<AbortController | null>(null)
  const sessionGenerationRef = useRef(0)
  const accessExpiresAtRef = useRef(0)
  const restoreAttemptRef = useRef(0)
  const mountedRef = useRef(true)

  const scheduleRefreshRef = useRef<((expiresIn: number) => void) | null>(null)

  const clearSession = useCallback(() => {
    sessionGenerationRef.current += 1
    refreshAbortRef.current?.abort()
    refreshAbortRef.current = null
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    refreshTimerRef.current = null
    accessExpiresAtRef.current = 0
    setRestoreError(false)
    void queryClient.cancelQueries().catch(() => undefined)
    queryClient.clear()
    setAccessToken(null)
    setUser(null)
    setPermissions([])
  }, [queryClient])

  const scheduleRefresh = useCallback((expiresIn: number) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    const delay = Math.max((expiresIn - 120) * 1000, 10_000)
    refreshTimerRef.current = setTimeout(async () => {
      const generation = sessionGenerationRef.current
      const controller = new AbortController()
      refreshAbortRef.current = controller
      try {
        const data = await refreshToken(controller.signal)
        if (generation !== sessionGenerationRef.current) return
        accessExpiresAtRef.current = Date.now() + data.expiresIn * 1000
        setAccessToken(data.accessToken)
        scheduleRefreshRef.current?.(data.expiresIn)
      } catch (error) {
        if (generation !== sessionGenerationRef.current) return
        if (controller.signal.aborted) return
        if (!isTerminalAuthError(error) && Date.now() < accessExpiresAtRef.current) {
          // Retry transient failures while the current access token is still
          // valid. A fixed attempt cap could log out a healthy session during
          // a short provider or network outage.
          scheduleRefreshRef.current?.(110)
          return
        }
        clearSession()
      } finally {
        if (refreshAbortRef.current === controller) refreshAbortRef.current = null
      }
    }, delay)
  }, [clearSession])

  useEffect(() => subscribeToAuthFailure(clearSession), [clearSession])

  const restoreSession = useCallback(async () => {
    const attempt = ++restoreAttemptRef.current
    const generation = sessionGenerationRef.current
    refreshAbortRef.current?.abort()
    const controller = new AbortController()
    refreshAbortRef.current = controller

    try {
      const res = await refreshToken(controller.signal)
      if (
        !mountedRef.current ||
        attempt !== restoreAttemptRef.current ||
        generation !== sessionGenerationRef.current
      ) return
      setAccessToken(res.accessToken)
      accessExpiresAtRef.current = Date.now() + res.expiresIn * 1000
      scheduleRefresh(res.expiresIn)

      const restoredUser = await fetchMe()
      if (
        !mountedRef.current ||
        attempt !== restoreAttemptRef.current ||
        generation !== sessionGenerationRef.current
      ) return
      setUser(restoredUser)
      setPermissions(restoredUser.permissions ?? [])
    } catch (error) {
      if (
        !mountedRef.current ||
        attempt !== restoreAttemptRef.current ||
        generation !== sessionGenerationRef.current ||
        controller.signal.aborted
      ) return
      if (isTerminalAuthError(error)) {
        clearSession()
        localStorage.removeItem("sawaa_user")
      } else {
        // Preserve the cookie-backed session hint and expose an explicit retry
        // state. A 5xx/network failure is not evidence that auth expired.
        setRestoreError(true)
      }
    } finally {
      if (refreshAbortRef.current === controller) refreshAbortRef.current = null
      if (mountedRef.current && attempt === restoreAttemptRef.current) {
        setLoading(false)
      }
    }
  }, [clearSession, scheduleRefresh])

  const retryRestore = useCallback(() => {
    setLoading(true)
    setRestoreError(false)
    void restoreSession()
  }, [restoreSession])

  useEffect(() => {
    mountedRef.current = true
    scheduleRefreshRef.current = scheduleRefresh
    // Defer the initial request so React StrictMode can replay setup/cleanup
    // without synchronously entering an async state transition from the
    // effect body or launching a throwaway refresh.
    const restoreStartTimer = setTimeout(() => {
      if (mountedRef.current) void restoreSession()
    }, 0)

    return () => {
      clearTimeout(restoreStartTimer)
      mountedRef.current = false
      refreshAbortRef.current?.abort()
      refreshAbortRef.current = null
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    }
  }, [restoreSession, scheduleRefresh])

  const login = useCallback(async (identifier: string, password: string) => {
    const generation = sessionGenerationRef.current
    const apiGeneration = getSessionGeneration()
    const res = await apiLogin(identifier, password)
    if (generation !== sessionGenerationRef.current) return
    if (res.requiresOtp) {
      throw new Error("Two-factor verification is required")
    }
    if (!acceptAuthResponse(res, apiGeneration)) return
    setRestoreError(false)
    accessExpiresAtRef.current = Date.now() + res.expiresIn * 1000
    setUser(res.user)
    setPermissions(res.user.permissions ?? [])
    scheduleRefresh(res.expiresIn)
  }, [scheduleRefresh])

  const loginWithTokens = useCallback((res: AuthResponse, expectedSessionGeneration?: number) => {
    if (!acceptAuthResponse(res, expectedSessionGeneration)) return
    setRestoreError(false)
    accessExpiresAtRef.current = Date.now() + res.expiresIn * 1000
    setUser(res.user)
    setPermissions(res.user.permissions ?? [])
    scheduleRefresh(res.expiresIn)
  }, [scheduleRefresh])

  const logout = useCallback(async () => {
    const revoke = logoutApi()
    clearSession()
    await revoke
  }, [clearSession])

  const canDo = useCallback(
    (module: string, action: string): boolean => {
      const m = module.toLowerCase()
      const a = action.toLowerCase()
      return (
        permissions.includes(`${m}:${a}`) ||
        permissions.includes(`${m}:*`) ||
        permissions.includes("*")
      )
    },
    [permissions],
  )

  // Memoize the context value so consumers (Header, Sidebar, every page that
  // calls useAuth) don't re-render on unrelated parent renders.
  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      restoreError,
      permissions,
      retryRestore,
      login,
      loginWithTokens,
      logout,
      isAuthenticated: !!user,
      canDo,
    }),
    [user, loading, restoreError, permissions, retryRestore, login, loginWithTokens, logout, canDo],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/* ─── Hook ─── */

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}

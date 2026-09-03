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
  permissions: string[]
  login: (identifier: string, password: string) => Promise<void>
  loginWithTokens: (res: AuthResponse, expectedSessionGeneration?: number) => void
  logout: () => Promise<void>
  isAuthenticated: boolean
  canDo: (module: string, action: string) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

/* ─── Provider ─── */

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [permissions, setPermissions] = useState<string[]>([])
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refreshAbortRef = useRef<AbortController | null>(null)
  const sessionGenerationRef = useRef(0)

  const scheduleRefreshRef = useRef<((expiresIn: number) => void) | null>(null)

  const clearSession = useCallback(() => {
    sessionGenerationRef.current += 1
    refreshAbortRef.current?.abort()
    refreshAbortRef.current = null
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    refreshTimerRef.current = null
    setAccessToken(null)
    setUser(null)
    setPermissions([])
    queryClient.clear()
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
        setAccessToken(data.accessToken)
        scheduleRefreshRef.current?.(data.expiresIn)
      } catch {
        if (generation === sessionGenerationRef.current) clearSession()
      } finally {
        if (refreshAbortRef.current === controller) refreshAbortRef.current = null
      }
    }, delay)
  }, [clearSession])

  useEffect(() => subscribeToAuthFailure(clearSession), [clearSession])

  useEffect(() => {
    let active = true
    scheduleRefreshRef.current = scheduleRefresh
    const generation = sessionGenerationRef.current
    const controller = new AbortController()
    refreshAbortRef.current = controller

    refreshToken(controller.signal)
      .then((res) => {
        if (!active || generation !== sessionGenerationRef.current) return null
        setAccessToken(res.accessToken)
        scheduleRefresh(res.expiresIn)
        return fetchMe()
      })
      .then((u) => {
        if (!active || !u || generation !== sessionGenerationRef.current) return
        setUser(u)
        setPermissions(u.permissions ?? [])
      })
      .catch(() => {
        if (!active || generation !== sessionGenerationRef.current) return
        clearSession()
        localStorage.removeItem("sawaa_user")
        setLoading(false)
      })
      .finally(() => {
        if (active && generation === sessionGenerationRef.current) {
          setLoading(false)
        }
      })

    return () => {
      active = false
      controller.abort()
      if (refreshAbortRef.current === controller) refreshAbortRef.current = null
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    }
  }, [clearSession, scheduleRefresh])

  const login = useCallback(async (identifier: string, password: string) => {
    const generation = sessionGenerationRef.current
    const apiGeneration = getSessionGeneration()
    const res = await apiLogin(identifier, password)
    if (generation !== sessionGenerationRef.current) return
    if (res.requiresOtp) {
      throw new Error("Two-factor verification is required")
    }
    if (!acceptAuthResponse(res, apiGeneration)) return
    setUser(res.user)
    setPermissions(res.user.permissions ?? [])
    scheduleRefresh(res.expiresIn)
  }, [scheduleRefresh])

  const loginWithTokens = useCallback((res: AuthResponse, expectedSessionGeneration?: number) => {
    if (!acceptAuthResponse(res, expectedSessionGeneration)) return
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
      permissions,
      login,
      loginWithTokens,
      logout,
      isAuthenticated: !!user,
      canDo,
    }),
    [user, loading, permissions, login, loginWithTokens, logout, canDo],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/* ─── Hook ─── */

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}

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
import {
  login as apiLogin,
  logoutApi,
  fetchMe,
  refreshToken,
} from "@/lib/api/auth"
import type { AuthUser, AuthResponse } from "@/lib/api/auth"
import { setAccessToken } from "@/lib/api"

/* ─── Context Shape ─── */

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  permissions: string[]
  login: (identifier: string, password: string) => Promise<void>
  loginWithTokens: (res: AuthResponse) => void
  logout: () => Promise<void>
  isAuthenticated: boolean
  canDo: (module: string, action: string) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

/* ─── Provider ─── */

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [permissions, setPermissions] = useState<string[]>([])
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleRefreshRef = useRef<((expiresIn: number) => void) | null>(null)

  const scheduleRefresh = useCallback((expiresIn: number) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    const delay = Math.max((expiresIn - 120) * 1000, 10_000)
    refreshTimerRef.current = setTimeout(async () => {
      try {
        const data = await refreshToken()
        setAccessToken(data.accessToken)
        scheduleRefreshRef.current?.(data.expiresIn)
      } catch {
        setUser(null)
        setPermissions([])
      }
    }, delay)
  }, [])

  useEffect(() => {
    scheduleRefreshRef.current = scheduleRefresh

    refreshToken()
      .then((res) => {
        scheduleRefresh(res.expiresIn)
        return fetchMe()
      })
      .then((u) => {
        setUser(u)
        setPermissions(u.permissions ?? [])
      })
      .catch(() => {
        setUser(null)
        setPermissions([])
        localStorage.removeItem("sawaa_user")
      })
      .finally(() => setLoading(false))

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    }
  }, [scheduleRefresh])

  const login = useCallback(async (identifier: string, password: string) => {
    const res = await apiLogin(identifier, password)
    setUser(res.user)
    setPermissions(res.user.permissions ?? [])
    scheduleRefresh(res.expiresIn)
  }, [scheduleRefresh])

  const loginWithTokens = useCallback((res: AuthResponse) => {
    setUser(res.user)
    setPermissions(res.user.permissions ?? [])
    scheduleRefresh(res.expiresIn)
  }, [scheduleRefresh])

  const logout = useCallback(async () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    await logoutApi()
    setUser(null)
    setPermissions([])
  }, [])

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

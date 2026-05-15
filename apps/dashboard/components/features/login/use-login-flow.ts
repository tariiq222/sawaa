"use client"

import { useState, useCallback } from "react"
import { login as apiLogin, requestDashboardOtp, verifyDashboardOtp } from "@/lib/api/auth"
import { useAuth } from "@/components/providers/auth-provider"

type LoginMode = "login" | "otp"

export function useLoginFlow() {
  const { loginWithTokens } = useAuth()
  const [mode, setMode] = useState<LoginMode>("login")
  const [identifier, setIdentifier] = useState("")
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(false)
  const [otpSentAt, setOtpSentAt] = useState<number | null>(null)

  const clearError = useCallback(() => setError(null), [])

  const submitLogin = useCallback(
    async (id: string, password: string, rememberMe?: boolean) => {
      setLoading(true)
      setError(null)
      try {
        const res = await apiLogin(id, password, rememberMe)
        loginWithTokens(res)
      } catch (e) {
        setError(e)
      } finally {
        setLoading(false)
      }
    },
    [loginWithTokens],
  )

  const switchToOtp = useCallback(async (id: string) => {
    setIdentifier(id)
    setError(null)
    setLoading(true)
    try {
      await requestDashboardOtp(id)
      setOtpSentAt(Date.now())
      setMode("otp")
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [])

  const submitOtp = useCallback(
    async (code: string) => {
      setLoading(true)
      setError(null)
      try {
        const res = await verifyDashboardOtp(identifier, code)
        loginWithTokens(res)
      } catch (e) {
        setError(e)
      } finally {
        setLoading(false)
      }
    },
    [identifier, loginWithTokens],
  )

  const resendOtp = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await requestDashboardOtp(identifier)
      setOtpSentAt(Date.now())
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [identifier])

  const backToLogin = useCallback(() => {
    setMode("login")
    setError(null)
  }, [])

  return {
    mode,
    identifier,
    error,
    loading,
    otpSentAt,
    submitLogin,
    switchToOtp,
    submitOtp,
    resendOtp,
    backToLogin,
    clearError,
  }
}

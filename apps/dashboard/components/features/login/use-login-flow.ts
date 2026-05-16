"use client"

import { useState, useCallback } from "react"
import { login as apiLogin, requestDashboardOtp, verifyDashboardOtp, lookupUser } from "@/lib/api/auth"
import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/locale-provider"

type LoginStep = "identifier" | "method" | "password" | "otp"

export function useLoginFlow() {
  const { loginWithTokens } = useAuth()
  const { t } = useLocale()
  const [step, setStep] = useState<LoginStep>("identifier")
  const [identifier, setIdentifier] = useState("")
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(false)
  const [otpSentAt, setOtpSentAt] = useState<number | null>(null)
  const [lookupResult, setLookupResult] = useState<{ exists: boolean; hasPassword: boolean } | null>(null)

  const clearError = useCallback(() => setError(null), [])

  const submitIdentifier = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const result = await lookupUser(id)
      setIdentifier(result.identifier)
      setLookupResult(result)

      if (!result.exists) {
        setError(new Error(t("login.errors.accountNotFound")))
        return
      }
      if (result.hasPassword) {
        // Has password - let them choose
        setStep("method")
      } else {
        // No password - force OTP
        await requestDashboardOtp(result.identifier)
        setOtpSentAt(Date.now())
        setStep("otp")
      }
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [t])

  const selectMethod = useCallback((method: "password" | "otp") => {
    setError(null)
    if (method === "password") {
      setStep("password")
    } else {
      setLoading(true)
      requestDashboardOtp(identifier)
        .then(() => {
          setOtpSentAt(Date.now())
          setStep("otp")
        })
        .catch((e) => setError(e))
        .finally(() => setLoading(false))
    }
  }, [identifier])

  const submitPassword = useCallback(async (password: string, rememberMe?: boolean) => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiLogin(identifier, password, rememberMe)
      loginWithTokens(res)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [identifier, loginWithTokens])

  const submitOtp = useCallback(async (code: string) => {
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
  }, [identifier, loginWithTokens])

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

  const backToIdentifier = useCallback(() => {
    setStep("identifier")
    setError(null)
    setLookupResult(null)
  }, [])

  const backToMethod = useCallback(() => {
    setStep("method")
    setError(null)
  }, [])

  return {
    step,
    identifier,
    error,
    loading,
    otpSentAt,
    lookupResult,
    submitIdentifier,
    selectMethod,
    submitPassword,
    submitOtp,
    resendOtp,
    backToIdentifier,
    backToMethod,
    clearError,
  }
}

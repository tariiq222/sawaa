"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"

export default function VerifyEmailPage() {
  const params = useSearchParams()
  const token = params.get("token")

  const [result, setResult] = useState<{ status: "verifying"; error?: never } | { status: "ok" } | { status: "error"; error: string }>({ status: "verifying" })

  useEffect(() => {
    if (!token) {
      return
    }

    fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/v1/public/verify-email?token=${encodeURIComponent(token)}`,
    )
      .then(async (r) => {
        const j = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(j?.message ?? "Verification failed")
        return j
      })
      .then(() => {
        setResult({ status: "ok" })
        const timeout = setTimeout(() => {
          window.location.href = "sawaa://settings?verified=1"
        }, 800)
        return () => clearTimeout(timeout)
      })
      .catch((e: Error) => {
        setResult({ status: "error", error: e?.message ?? "Network error" })
      })
  }, [token])

  const errorMessage = !token ? "Missing token" : null

  if (result.status === "verifying" && !errorMessage) {
    return (
      <main style={{ padding: 32, textAlign: "center" }}>
        جارِ التحقق…
      </main>
    )
  }

  if (result.status === "ok") {
    return (
      <main style={{ padding: 32, textAlign: "center" }}>
        تم تأكيد بريدك. جارِ فتح التطبيق…
      </main>
    )
  }

  return (
    <main style={{ padding: 32, textAlign: "center" }}>
      تعذر التحقق: {errorMessage ?? result.error}
    </main>
  )
}
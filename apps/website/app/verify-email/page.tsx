"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Suspense } from "react"
import { getApiBase } from "@/lib/api-base"

function VerifyEmailContent() {
  const params = useSearchParams()
  const token = params.get("token")

  const [result, setResult] = useState<
    | { status: "verifying"; error?: never }
    | { status: "ok" }
    | { status: "error"; error: string }
  >(() => {
    if (!token) {
      return { status: "error", error: "رابط التحقق غير صالح أو منتهي الصلاحية" }
    }
    return { status: "verifying" }
  })

  useEffect(() => {
    if (!token) return

    fetch(
      `${getApiBase()}/public/verify-email?token=${encodeURIComponent(token)}`,
    )
      .then(async (r) => {
        const j = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(j?.message ?? "فشل التحقق من البريد")
        return j
      })
      .then(() => {
        setResult({ status: "ok" })
      })
      .catch((e: Error) => {
        setResult({ status: "error", error: e?.message ?? "خطأ في الاتصال" })
      })
  }, [token])

  if (result.status === "verifying") {
    return (
      <main style={{ display: 'flex', minHeight: '50vh', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '1rem' }}>
        <div style={{ width: '2rem', height: '2rem', border: '2px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ opacity: 0.6 }}>جارِ التحقق من بريدك الإلكتروني…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </main>
    )
  }

  if (result.status === "ok") {
    return (
      <main style={{ display: 'flex', minHeight: '50vh', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', padding: '1rem' }}>
        <div style={{ width: '4rem', height: '4rem', borderRadius: '50%', background: 'color-mix(in srgb, var(--success, #22c55e) 15%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="32" height="32" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="var(--success, #22c55e)">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </div>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>تم تأكيد بريدك الإلكتروني</h1>
          <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', opacity: 0.6 }}>يمكنك الآن تسجيل الدخول والاستفادة من جميع الخدمات.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link href="/login" style={{ padding: '0.625rem 1.25rem', borderRadius: '0.5rem', background: 'var(--primary)', color: 'var(--on-primary, #fff)', fontSize: '0.875rem', fontWeight: 500, textDecoration: 'none' }}>
            تسجيل الدخول
          </Link>
          <Link href="/" style={{ padding: '0.625rem 1.25rem', borderRadius: '0.5rem', border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)', fontSize: '0.875rem', fontWeight: 500, textDecoration: 'none', color: 'inherit' }}>
            العودة للرئيسية
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main style={{ display: 'flex', minHeight: '50vh', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', padding: '1rem' }}>
      <div style={{ width: '4rem', height: '4rem', borderRadius: '50%', background: 'color-mix(in srgb, var(--destructive, #ef4444) 10%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="32" height="32" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="var(--destructive, #ef4444)">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
        </svg>
      </div>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>تعذر التحقق</h1>
        <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', opacity: 0.6 }}>{result.error}</p>
      </div>
      <Link href="/" style={{ padding: '0.625rem 1.25rem', borderRadius: '0.5rem', background: 'var(--primary)', color: 'var(--on-primary, #fff)', fontSize: '0.875rem', fontWeight: 500, textDecoration: 'none' }}>
        العودة للرئيسية
      </Link>
    </main>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '3rem' }}>جارٍ التحميل...</div>}>
      <VerifyEmailContent />
    </Suspense>
  )
}

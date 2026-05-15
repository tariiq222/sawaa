"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"

export default function VerifyEmailPage() {
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
      `${process.env.NEXT_PUBLIC_API_URL}/api/v1/public/verify-email?token=${encodeURIComponent(token)}`,
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
      <main className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
        <p className="text-gray-600">جارِ التحقق من بريدك الإلكتروني…</p>
      </main>
    )
  }

  if (result.status === "ok") {
    return (
      <main className="flex min-h-[50vh] flex-col items-center justify-center gap-6 px-4">
        <div className="flex size-16 items-center justify-center rounded-full bg-green-100">
          <svg className="size-8 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </div>
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900">تم تأكيد بريدك الإلكتروني</h1>
          <p className="mt-2 text-sm text-gray-500">يمكنك الآن تسجيل الدخول والاستفادة من جميع الخدمات.</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/login"
            className="rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-700"
          >
            تسجيل الدخول
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            العودة للرئيسية
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-[50vh] flex-col items-center justify-center gap-6 px-4">
      <div className="flex size-16 items-center justify-center rounded-full bg-red-100">
        <svg className="size-8 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
        </svg>
      </div>
      <div className="text-center">
        <h1 className="text-xl font-semibold text-gray-900">تعذر التحقق</h1>
        <p className="mt-2 text-sm text-gray-500">{result.error}</p>
      </div>
      <Link
        href="/"
        className="rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-700"
      >
        العودة للرئيسية
      </Link>
    </main>
  )
}

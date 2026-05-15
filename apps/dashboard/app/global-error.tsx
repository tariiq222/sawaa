'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

/**
 * global-error.tsx renders OUTSIDE the provider tree (no LocaleProvider).
 * We read the persisted locale from localStorage to pick the right strings.
 */
function getLocaleStrings() {
  const locale =
    typeof window !== 'undefined'
      ? localStorage.getItem('sawaa-locale') ?? 'ar'
      : 'ar'

  const strings = {
    ar: {
      title: 'حدث خطأ غير متوقع',
      description: 'نعتذر، حدث خطأ في النظام. يرجى المحاولة مرة أخرى.',
      retry: 'إعادة المحاولة',
    },
    en: {
      title: 'An unexpected error occurred',
      description: "We're sorry, a system error occurred. Please try again.",
      retry: 'Try Again',
    },
  }

  return strings[locale === 'en' ? 'en' : 'ar']
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  const s = getLocaleStrings()

  return (
    <html>
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
              <svg
                className="size-8 text-destructive"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-foreground">
              {s.title}
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
              {error.message || s.description}
            </p>
          </div>
          <button
            onClick={() => reset()}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {s.retry}
          </button>
        </div>
      </body>
    </html>
  )
}

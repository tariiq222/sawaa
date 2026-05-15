/**
 * Server component — cannot use useLocale().
 * Shows bilingual loading text (Arabic primary, English fallback).
 */
export default function DashboardLoading() {
  return (
    <div className="flex h-[50vh] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground" suppressHydrationWarning>
          جارٍ التحميل...
        </p>
      </div>
    </div>
  )
}

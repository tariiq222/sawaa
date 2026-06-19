import { Suspense } from "react"
import { GroupSessionDetailPage } from "@/components/features/group-sessions/group-session-detail-page"

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-muted" />}>
      <GroupSessionDetailPage sessionId={id} />
    </Suspense>
  )
}

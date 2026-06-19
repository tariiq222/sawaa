"use client"

import { Suspense } from "react"
import { GroupSessionsPageContent } from "@/components/features/group-sessions/group-sessions-page-content"

export default function GroupSessionsPage() {
  return (
    <Suspense>
      <GroupSessionsPageContent />
    </Suspense>
  )
}

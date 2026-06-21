"use client"

import { Suspense } from "react"
import { GroupProgramsPageContent } from "@/components/features/group-programs/group-programs-page-content"

export default function GroupProgramsPage() {
  return (
    <Suspense>
      <GroupProgramsPageContent />
    </Suspense>
  )
}

"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect } from "react"

export default function DepartmentDetailRoute() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  useEffect(() => {
    router.replace(`/departments/${id}/edit`)
  }, [id, router])

  return (
    <div className="p-6">
      <p className="text-muted-foreground">
        Detail view not yet implemented for departments. Redirecting to edit…
      </p>
    </div>
  )
}
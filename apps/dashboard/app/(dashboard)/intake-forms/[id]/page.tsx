"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { fetchIntakeForm } from "@/lib/api/intake-forms"

export default function IntakeFormDetailRoute() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: form, isLoading, error } = useQuery({
    queryKey: ["intake-forms", "detail", id ?? ""],
    queryFn: () => fetchIntakeForm(id!),
    enabled: !!id,
  })

  useEffect(() => {
    if (!isLoading && !error && form) {
      router.replace(`/intake-forms/${id}/edit`)
    }
  }, [form, isLoading, error, id, router])

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Loading…</div>
  }

  return (
    <div className="p-6">
      <p className="text-muted-foreground">
        Detail view not yet implemented for intake-forms. Redirecting to edit…
      </p>
    </div>
  )
}
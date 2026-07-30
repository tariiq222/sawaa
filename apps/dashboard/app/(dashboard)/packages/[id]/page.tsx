"use client"

import { useParams } from "next/navigation"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { usePackage } from "@/hooks/use-packages"

export default function PackageDetailRoute() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: pkg, isLoading, error } = usePackage(id)

  useEffect(() => {
    if (!isLoading && !error && pkg) {
      router.replace(`/packages/${id}/edit`)
    }
  }, [pkg, isLoading, error, id, router])

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Loading…</div>
  }

  return (
    <div className="p-6">
      <p className="text-muted-foreground">
        Detail view not yet implemented for packages. Redirecting to edit…
      </p>
    </div>
  )
}
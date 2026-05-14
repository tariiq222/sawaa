"use client"

import { Suspense } from "react"
import { useParams } from "next/navigation"
import { ServiceFormPage } from "@/components/features/services/service-form-page"

export default function EditServicePage() {
  const params = useParams()
  return (
    <Suspense>
      <ServiceFormPage mode="edit" serviceId={params.id as string} />
    </Suspense>
  )
}

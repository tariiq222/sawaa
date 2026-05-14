import { Suspense } from "react"
import { ServiceFormPage } from "@/components/features/services/service-form-page"

export default function CreateServicePage() {
  return (
    <Suspense>
      <ServiceFormPage mode="create" />
    </Suspense>
  )
}

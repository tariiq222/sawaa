"use client"

import { useParams } from "next/navigation"
import { ClientDetailPage } from "@/components/features/clients/client-detail-page"

export default function ClientDetailRoute() {
  const { id } = useParams<{ id: string }>()
  return <ClientDetailPage clientId={id} />
}

import { z } from "zod"
import type { EmployeeTypeConfigPayload } from "@/lib/types/employee"
import type { ServiceBookingType } from "@/lib/types/service"

/* ─── Draft service entry ─── */

export interface DraftService {
  key: string
  serviceId: string
  serviceName: string
  bufferMinutes: number
  isActive: boolean
  availableTypes: string[]
  types: EmployeeTypeConfigPayload[]
  serviceBookingTypes?: ServiceBookingType[]
}

/* ─── Schema for add-service form ─── */

export const addServiceSchema = z.object({
  serviceId: z.string().min(1, "Service is required"),
  bufferMinutes: z.coerce.number().int().min(0),
  isActive: z.boolean(),
})

export type AddServiceFormData = z.infer<typeof addServiceSchema>

/* ─── Draft key generator ─── */

let draftKey = 0
export function nextDraftKey() {
  return `draft-svc-${++draftKey}`
}

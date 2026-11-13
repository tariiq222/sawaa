import { z } from "zod"
import { formNumber } from "@/lib/schemas/primitives"

/* ─── Verify bank transfer schema (verify-dialog) ─── */

export const verifyTransferSchema = z.object({
  action: z.enum(["approve", "reject"], {
    // Only a missing choice gets this message; other invalid values use the global map.
    error: (issue) => (issue.input === undefined ? "Action is required" : undefined),
  }),
  transferRef: z.string().optional(),
})

export type VerifyTransferFormData = z.infer<typeof verifyTransferSchema>

/* ─── Add credit schema (add-credit-dialog) ─── */

export const addCreditSchema = z.object({
  amount: formNumber().min(0.01, "Amount must be greater than 0"),
  note: z.string().max(500).optional(),
})

export type AddCreditFormData = z.infer<typeof addCreditSchema>

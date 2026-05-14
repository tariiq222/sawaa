import { z } from "zod"

/* ─── Verify bank transfer schema (verify-dialog) ─── */

export const verifyTransferSchema = z.object({
  action: z.enum(["approve", "reject"], {
    required_error: "Action is required",
  }),
  transferRef: z.string().optional(),
})

export type VerifyTransferFormData = z.infer<typeof verifyTransferSchema>

/* ─── Add credit schema (add-credit-dialog) ─── */

export const addCreditSchema = z.object({
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  note: z.string().max(500).optional(),
})

export type AddCreditFormData = z.infer<typeof addCreditSchema>

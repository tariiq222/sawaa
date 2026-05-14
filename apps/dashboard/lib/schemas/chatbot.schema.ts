import { z } from "zod"

/* ─── Create KB entry schema (create-kb-entry-dialog) ─── */

export const createKbEntrySchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  category: z.string().optional(),
})

export type CreateKbEntryFormData = z.infer<typeof createKbEntrySchema>

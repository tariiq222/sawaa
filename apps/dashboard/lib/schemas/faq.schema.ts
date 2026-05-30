import { z } from "zod"

export const faqItemSchema = z.object({
  q: z.string().min(1),
  qEn: z.string().min(1),
  a: z.string().min(1),
  aEn: z.string().min(1),
})

export const faqItemsSchema = z.object({
  items: z.array(faqItemSchema).min(1).max(50),
})

export type FaqItemSchema = z.infer<typeof faqItemSchema>
export type FaqItemsSchema = z.infer<typeof faqItemsSchema>

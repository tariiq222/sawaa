import { z } from "zod"

export const supportGroupItemSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  nameEn: z.string().min(1),
  desc: z.string().min(1),
  descEn: z.string().min(1),
  image: z.string().min(1),
  participants: z.string().min(1),
  sessions: z.string().min(1),
  format: z.string().min(1),
})

export const supportGroupsSchema = z.object({
  groups: z.array(supportGroupItemSchema).min(1).max(20),
})

export type SupportGroupItemSchema = z.infer<typeof supportGroupItemSchema>
export type SupportGroupsSchema = z.infer<typeof supportGroupsSchema>

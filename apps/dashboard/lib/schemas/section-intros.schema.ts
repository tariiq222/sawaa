import { z } from "zod"

const required = (field: string) =>
  z.string().min(1, { message: `${field} مطلوب` }).max(500)

const optional = z.string().max(500)

const introShape = z.object({
  tag:            required("الوسم"),
  titlePrefix:    required("بداية العنوان"),
  titleHighlight: required("النص المميّز"),
  titleSuffix:    optional,
  subtitle:       required("الوصف"),
})

export const sectionIntrosSchema = z.object({
  features:      introShape,
  clinics:       introShape,
  supportGroups: introShape,
  team:          introShape,
  testimonials:  introShape,
  blog:          introShape,
  faq:           introShape,
  cta:           introShape,
})

export type SectionIntrosSchema = z.infer<typeof sectionIntrosSchema>

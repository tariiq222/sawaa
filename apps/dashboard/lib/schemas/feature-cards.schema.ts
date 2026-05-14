import { z } from "zod"
import { FEATURE_CARD_ICON_OPTIONS } from "@/lib/types/feature-cards"

const required = (field: string) =>
  z.string().min(1, { message: `${field} مطلوب` }).max(500)

const icon = z.enum(FEATURE_CARD_ICON_OPTIONS, {
  errorMap: () => ({ message: "اختر أيقونة من القائمة" }),
})

const cardShape = z.object({
  label: required("الوسم"),
  title: required("عنوان البطاقة"),
  desc:  required("الوصف"),
  icon,
})

export const featureCardsSchema = z.object({
  cards: z.tuple([cardShape, cardShape, cardShape]),
})

export type FeatureCardsSchema = z.infer<typeof featureCardsSchema>

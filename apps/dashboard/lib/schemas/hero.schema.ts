import { z } from "zod"

const nonEmpty = (field: string) =>
  z.string().min(1, { message: `${field} مطلوب` }).max(500)

const href = z
  .string()
  .min(1, { message: "الرابط مطلوب" })
  .max(500)
  .regex(/^(\/|https?:\/\/)/, { message: "يبدأ الرابط بـ / أو http(s)://" })

export const heroFormSchema = z.object({
  badgeText:             nonEmpty("نص الشارة"),
  titlePrefix:           nonEmpty("بداية العنوان"),
  titleHighlight:        nonEmpty("النص المميّز"),
  titleSuffix:           nonEmpty("نهاية العنوان"),
  subtitle:              nonEmpty("الوصف"),
  ctaPrimaryText:        nonEmpty("نص الزر الرئيسي"),
  ctaPrimaryHref:        href,
  ctaSecondaryText:      nonEmpty("نص الزر الثانوي"),
  ctaSecondaryHref:      href,
  heroImageUrl:          nonEmpty("رابط الصورة"),
  badgeFloatTopLabel:    nonEmpty("عنوان الشارة العلوية"),
  badgeFloatTopValue:    nonEmpty("قيمة الشارة العلوية"),
  badgeFloatBottomLabel: nonEmpty("عنوان الشارة السفلية"),
  badgeFloatBottomValue: nonEmpty("قيمة الشارة السفلية"),
})

export type HeroFormSchema = z.infer<typeof heroFormSchema>

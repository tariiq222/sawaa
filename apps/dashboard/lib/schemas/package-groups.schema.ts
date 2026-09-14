import { z } from "zod"

const requiredText = z.string().trim().min(1, "common.required")
const nonNegative = z.coerce.number({ invalid_type_error: "packages.grouped.errors.number" }).finite().min(0, "packages.errors.nonNegative")
const sarAmount = nonNegative.refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8, "packages.grouped.errors.decimals")

export const groupedSessionFormSchema = z.object({
  key: requiredText,
  position: z.coerce.number().int().min(0),
  durationOptionId: requiredText,
  deliveryType: z.enum(["IN_PERSON", "ONLINE"]),
  unitPriceSar: sarAmount,
  hasUnitPriceOverride: z.boolean().optional(),
})

export const groupedGroupFormSchema = z.object({
  key: requiredText,
  label: z.string().trim().max(200).optional(),
  serviceId: z.string(),
  employeeId: z.string(),
  sequenceMode: z.enum(["ORDERED", "UNORDERED"]),
  dependsOnGroupKey: z.string().nullable(),
  sessionMode: z.enum(["SAME", "DETAIL"]),
  sameApplied: z.boolean().optional(),
  sessions: z.array(groupedSessionFormSchema).min(1, "packages.grouped.errors.sessionCount"),
})

export const groupedDiscountFormSchema = z.object({
  type: z.enum(["NONE", "PERCENTAGE", "FIXED"]),
  value: nonNegative,
})

const groupedDetailsSchema = z.object({
  nameAr: requiredText.max(200),
  nameEn: z.string().trim().max(200).optional(),
  descriptionAr: z.string().trim().max(2000).optional(),
  descriptionEn: z.string().trim().max(2000).optional(),
  imageUrl: z.string().trim().max(500).nullable().optional(),
  iconName: z.string().trim().max(100).nullable().optional(),
  iconBgColor: z.string().trim().max(20).nullable().optional(),
  sortOrder: z.coerce.number().int().min(0),
  isActive: z.boolean(),
  isPublic: z.boolean(),
})

export const groupedPackageSchema = groupedDetailsSchema
  .extend({
    groups: z.array(groupedGroupFormSchema).min(1, "packages.grouped.errors.groupCount"),
    globalDiscount: groupedDiscountFormSchema,
  })
  .superRefine((value, context) => {
    const keyIndexes = new Map<string, number[]>()
    value.groups.forEach((group, index) => keyIndexes.set(group.key, [...(keyIndexes.get(group.key) ?? []), index]))
    const keys = new Set(keyIndexes.keys())
    for (const indexes of keyIndexes.values()) {
      if (indexes.length > 1) {
        for (const index of indexes.slice(1)) context.addIssue({ code: "custom", path: ["groups", index, "key"], message: "packages.grouped.errors.duplicateKey" })
      }
    }
    value.groups.forEach((group, groupIndex) => {
      if (!group.serviceId) context.addIssue({ code: "custom", path: ["groups", groupIndex, "serviceId"], message: "common.required" })
      if (!group.employeeId) context.addIssue({ code: "custom", path: ["groups", groupIndex, "employeeId"], message: "common.required" })
      if (group.dependsOnGroupKey && !keys.has(group.dependsOnGroupKey)) {
        context.addIssue({ code: "custom", path: ["groups", groupIndex, "dependsOnGroupKey"], message: "packages.grouped.errors.dependency" })
      }
      if (group.dependsOnGroupKey === group.key) {
        context.addIssue({ code: "custom", path: ["groups", groupIndex, "dependsOnGroupKey"], message: "packages.grouped.errors.dependency" })
      }
    })
    const state = new Map<string, 0 | 1 | 2>()
    const visit = (key: string): boolean => {
      const current = state.get(key)
      if (current === 1) return true
      if (current === 2) return false
      state.set(key, 1)
      const dependency = value.groups[keyIndexes.get(key)?.[0] ?? -1]?.dependsOnGroupKey
      const cycle = Boolean(dependency && keys.has(dependency) && visit(dependency))
      state.set(key, 2)
      return cycle
    }
    value.groups.forEach((group, groupIndex) => {
      if (visit(group.key)) context.addIssue({ code: "custom", path: ["groups", groupIndex, "dependsOnGroupKey"], message: "packages.grouped.errors.dependency" })
    })
    if (value.globalDiscount.type === "PERCENTAGE" && value.globalDiscount.value > 100) {
      context.addIssue({ code: "custom", path: ["globalDiscount", "value"], message: "packages.grouped.errors.percent" })
    }
    if (value.globalDiscount.type === "FIXED") {
      const subtotal = value.groups.reduce((sum, group) => sum + group.sessions.reduce((groupSum, session) => groupSum + Math.round(session.unitPriceSar * 100), 0), 0)
      if (!Number.isSafeInteger(subtotal) || value.globalDiscount.value * 100 > subtotal) context.addIssue({ code: "custom", path: ["globalDiscount", "value"], message: "packages.grouped.errors.discountExceedsSubtotal" })
    }
    if (value.globalDiscount.type !== "NONE" && Math.abs(value.globalDiscount.value * 100 - Math.round(value.globalDiscount.value * 100)) >= 1e-8) context.addIssue({ code: "custom", path: ["globalDiscount", "value"], message: "packages.grouped.errors.decimals" })
    value.groups.forEach((group, groupIndex) => group.sessions.forEach((session, sessionIndex) => {
      if (!Number.isSafeInteger(Math.round(session.unitPriceSar * 100))) context.addIssue({ code: "custom", path: ["groups", groupIndex, "sessions", sessionIndex, "unitPriceSar"], message: "packages.grouped.errors.number" })
    }))
  })

export type GroupedSessionFormData = z.infer<typeof groupedSessionFormSchema>
export type GroupedGroupFormData = z.infer<typeof groupedGroupFormSchema>
export type GroupedPackageFormData = z.infer<typeof groupedPackageSchema>

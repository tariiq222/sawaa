import type { PackageFamilyOptionInput, PackageFamilyInput } from "@sawaa/shared/types"
import { calculateGroupedSessionNet } from "@sawaa/shared/money"
import { editorKey, formDiscountToPayload, groupsToPayload, groupedFormDefaults, groupedPricePreview } from "./package-groups-form"
import type { GroupedPackageFormData } from "./schemas/package-groups.schema"

export type PackageFamilyEditorValue = PackageFamilyInput

export function familyOptionSessionCount(option: Pick<PackageFamilyOptionInput, "groups">): number {
  return option.groups.reduce((count, group) => count + group.sessions.length, 0)
}

export function familyOptionPrice(option: Pick<PackageFamilyOptionInput, "groups" | "globalDiscount">): number {
  const prices = option.groups.flatMap((group) => group.sessions.map((session) => session.unitPrice))
  if (!prices.length) return 0
  return calculateGroupedSessionNet(prices, option.globalDiscount).amountPaid
}

export function emptyFamilyOption(): PackageFamilyOptionInput {
  const defaults = groupedFormDefaults()
  return {
    nameAr: "",
    nameEn: "",
    isActive: true,
    isPublic: true,
    groups: groupsToPayload(defaults.groups),
    globalDiscount: formDiscountToPayload(defaults.globalDiscount),
  }
}

export function copyFamilyOption(option: PackageFamilyOptionInput): PackageFamilyOptionInput {
  const keyMap = new Map<string, string>()
  const groups = option.groups.map((group) => {
    const nextKey = editorKey("group")
    keyMap.set(group.key, nextKey)
    return {
      ...group,
      key: nextKey,
      sessions: group.sessions.map((session, position) => ({
        ...session,
        key: editorKey("session"),
        position,
      })),
    }
  })
  return {
    ...option,
    id: undefined,
    groups: groups.map((group, index) => ({
      ...group,
      dependsOnGroupKey: option.groups[index]?.dependsOnGroupKey
        ? keyMap.get(option.groups[index].dependsOnGroupKey as string) ?? null
        : null,
    })),
  }
}

export function familyOptionToForm(option: PackageFamilyOptionInput): GroupedPackageFormData {
  const defaults = groupedFormDefaults()
  return {
    ...defaults,
    nameAr: option.nameAr,
    nameEn: option.nameEn ?? "",
    isActive: option.isActive ?? true,
    isPublic: option.isPublic ?? true,
    groups: option.groups.length
      ? option.groups.map((group) => ({
          key: group.key,
          label: group.label ?? "",
          serviceId: group.serviceId,
          employeeId: group.employeeId,
          sequenceMode: group.sequenceMode,
          dependsOnGroupKey: group.dependsOnGroupKey,
          sessionMode: "DETAIL" as const,
          sameApplied: false,
          sessions: group.sessions.map((session) => ({
            key: session.key,
            position: session.position,
            durationOptionId: session.durationOptionId,
            deliveryType: session.deliveryType,
            unitPriceSar: session.unitPrice / 100,
            hasUnitPriceOverride: true,
          })),
        }))
      : defaults.groups,
    globalDiscount: option.globalDiscount.type === "FIXED"
      ? { type: "FIXED", value: option.globalDiscount.value / 100 }
      : option.globalDiscount,
  }
}

export function familyOptionFromForm(form: GroupedPackageFormData): PackageFamilyOptionInput {
  return {
    nameAr: form.nameAr.trim(),
    nameEn: form.nameEn?.trim() || "",
    isActive: form.isActive,
    isPublic: form.isPublic,
    groups: groupsToPayload(form.groups),
    globalDiscount: formDiscountToPayload(form.globalDiscount),
  }
}

export function familyOptionPreview(option: PackageFamilyOptionInput) {
  const form = familyOptionToForm(option)
  return groupedPricePreview({ groups: form.groups, globalDiscount: form.globalDiscount })
}

export function familyFormHasOptions(value: PackageFamilyInput): boolean {
  return value.options.length > 0
}

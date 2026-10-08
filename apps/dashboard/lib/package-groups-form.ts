import { calculateGroupedSessionNet, sarToHalalas } from "@sawaa/shared/money"
import { groupedPackageInputSchema } from "@sawaa/shared/schemas"
import type { GlobalDiscount, PackageGroupInput } from "@sawaa/shared/types"
import type { UseFormRegisterReturn } from "react-hook-form"
import type { SessionPackage, CreateSessionPackagePayload } from "@/lib/types/package"
import type { GroupedGroupFormData, GroupedPackageFormData } from "@/lib/schemas/package-groups.schema"

let keyCounter = 0

export function editorKey(prefix: "group" | "session"): string {
  keyCounter += 1
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`
  return `${prefix}-${Date.now()}-${keyCounter}`
}

export function emptySession(position = 0): GroupedGroupFormData["sessions"][number] {
  return {
    key: editorKey("session"),
    position,
    durationOptionId: "",
    deliveryType: "IN_PERSON",
    unitPriceSar: 0,
    hasUnitPriceOverride: false,
  }
}

export function emptyGroup(): GroupedGroupFormData {
  return {
    key: editorKey("group"),
    label: "",
    serviceId: "",
    employeeId: "",
    sequenceMode: "ORDERED",
    dependsOnGroupKey: null,
    sessionMode: "DETAIL",
    sameApplied: false,
    sessions: [emptySession()],
  }
}

export function formDiscountToPayload(discount: GroupedPackageFormData["globalDiscount"]): GlobalDiscount {
  if (discount.type === "NONE") return { type: "NONE", value: 0 }
  const value = Number.isFinite(discount.value) ? discount.value : 0
  if (discount.type === "PERCENTAGE") return { type: "PERCENTAGE", value }
  return { type: "FIXED", value: sarToHalalas(value) }
}

export function groupsToPayload(groups: GroupedPackageFormData["groups"]): PackageGroupInput[] {
  return groups.map((group) => ({
    key: group.key,
    ...(group.label?.trim() ? { label: group.label.trim() } : {}),
    serviceId: group.serviceId,
    employeeId: group.employeeId,
    sequenceMode: group.sequenceMode,
    dependsOnGroupKey: group.dependsOnGroupKey || null,
    sessions: group.sessions.map((session, position) => ({
      key: session.key,
      position,
      durationOptionId: session.durationOptionId,
      deliveryType: session.deliveryType,
      unitPrice: sarToHalalas(session.unitPriceSar),
    })),
  }))
}

export function groupedInputFromForm(form: GroupedPackageFormData) {
  return {
    modelVersion: "GROUPED_V2" as const,
    groups: groupsToPayload(form.groups),
    globalDiscount: formDiscountToPayload(form.globalDiscount),
  }
}

export function buildGroupedPackagePayload(form: GroupedPackageFormData): CreateSessionPackagePayload {
  const input = groupedInputFromForm(form)
  const result = groupedPackageInputSchema.safeParse(input)
  if (!result.success) throw result.error
  return {
    nameAr: form.nameAr.trim(),
    nameEn: form.nameEn?.trim() || undefined,
    descriptionAr: form.descriptionAr?.trim() || undefined,
    descriptionEn: form.descriptionEn?.trim() || undefined,
    imageUrl: form.imageUrl?.startsWith("blob:") ? undefined : (form.imageUrl ?? null),
    iconName: form.iconName ?? null,
    iconBgColor: form.iconBgColor ?? null,
    sortOrder: form.sortOrder,
    isActive: form.isActive,
    isPublic: form.isPublic,
    modelVersion: "GROUPED_V2",
    groups: input.groups,
    globalDiscount: input.globalDiscount,
  }
}

export interface PackageSubmitIssue {
  path: string
  message: string
}

/**
 * Turn a payload validation error into field errors with translation keys.
 * Returns null for any other error so the caller can show its own message; raw Zod text must never reach the toast.
 */
export function packageSubmitIssues(error: unknown): PackageSubmitIssue[] | null {
  if (!(error instanceof Error) || error.name !== "ZodError" || !Array.isArray((error as { issues?: unknown }).issues)) return null
  const issues = (error as Error & { issues: { path: (string | number)[]; message: string }[] }).issues
  return issues.map((issue) => {
    const isDependency = issue.path.includes("dependsOnGroupKey") || /dependency/i.test(issue.message)
    if (!isDependency) return { path: issue.path.join("."), message: "packages.errors.submitSummary" }
    const groupIndex = issue.path[0] === "groups" && typeof issue.path[1] === "number" ? issue.path[1] : 0
    return { path: `groups.${groupIndex}.dependsOnGroupKey`, message: "packages.grouped.errors.dependency" }
  })
}

export function groupedFormDefaults(pkg?: SessionPackage | null): GroupedPackageFormData {
  if (!pkg || pkg.modelVersion !== "GROUPED_V2" || !pkg.groups?.length) {
    return {
      nameAr: "",
      nameEn: "",
      descriptionAr: "",
      descriptionEn: "",
      imageUrl: null,
      iconName: null,
      iconBgColor: null,
      sortOrder: 0,
      isActive: true,
      isPublic: false,
      groups: [emptyGroup()],
      globalDiscount: { type: "NONE", value: 0 },
    }
  }
  const discount = pkg.globalDiscount ?? { type: "NONE" as const, value: 0 }
  return {
    nameAr: pkg.nameAr,
    nameEn: pkg.nameEn ?? "",
    descriptionAr: pkg.descriptionAr ?? "",
    descriptionEn: pkg.descriptionEn ?? "",
    imageUrl: pkg.imageUrl,
    iconName: pkg.iconName,
    iconBgColor: pkg.iconBgColor,
    sortOrder: pkg.sortOrder,
    isActive: pkg.isActive,
    isPublic: pkg.isPublic,
    groups: pkg.groups.map((group) => ({
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
    })),
    globalDiscount: {
      type: discount.type,
      value: discount.type === "FIXED" ? discount.value / 100 : discount.value,
    },
  }
}

export function groupedPricePreview(form: Pick<GroupedPackageFormData, "groups" | "globalDiscount">) {
  const sourcePrices = form.groups.flatMap((group) => group.sessions.map((session) => session.unitPriceSar))
  const invalidPrice = sourcePrices.some((price) => !Number.isFinite(price) || price < 0 || Math.abs(price * 100 - Math.round(price * 100)) >= 1e-8 || !Number.isSafeInteger(Math.round(price * 100)))
  const invalidDiscount = form.globalDiscount.type === "NONE" ? form.globalDiscount.value !== 0 : (!Number.isFinite(form.globalDiscount.value) || form.globalDiscount.value < 0 || (form.globalDiscount.type === "PERCENTAGE" && form.globalDiscount.value > 100) || Math.abs(form.globalDiscount.value * 100 - Math.round(form.globalDiscount.value * 100)) >= 1e-8)
  if (invalidPrice || invalidDiscount) return { subtotal: 0, discountAmount: 0, amountPaid: 0, sessionNet: [], prices: [], valid: false as const, error: "packages.grouped.errors.invalidPreview" }
  const prices = sourcePrices.map((price) => sarToHalalas(price))
  const safePrices = prices.length ? prices : [0]
  try {
    return {
      ...calculateGroupedSessionNet(safePrices, formDiscountToPayload(form.globalDiscount)),
      prices,
      valid: true as const,
      error: undefined,
    }
  } catch (error) {
    const subtotal = safePrices.reduce((sum, price) => sum + price, 0)
    return {
      subtotal,
      discountAmount: 0,
      amountPaid: subtotal,
      sessionNet: safePrices,
      prices,
      valid: false as const,
      error: error instanceof Error ? error.message : "packages.grouped.errors.invalidPreview",
    }
  }
}

/** Apply the first session specification to every session while preserving keys and positions. */
export function applyFirstSessionToAll(sessions: GroupedGroupFormData["sessions"]): GroupedGroupFormData["sessions"] {
  const first = sessions[0]
  if (!first) return sessions
  return sessions.map((session, position) => ({ ...first, key: session.key, position }))
}

/**
 * Keep only the name + ref of a registration for a select whose value is written through setValue.
 * RHF's register onBlur re-reads the DOM value, so blurring "no dependency" stored "" instead of null
 * and blurring a select whose saved option is not listed wiped the saved id.
 */
export function controlledSelectField({ name, ref }: UseFormRegisterReturn): Pick<UseFormRegisterReturn, "name" | "ref"> {
  return { name, ref }
}

export function dependencyOptions(groups: readonly Pick<PackageGroupInput, "key" | "dependsOnGroupKey">[], currentKey: string): string[] {
  return groups.filter((candidate) => candidate.key !== currentKey && !wouldCreateCycle(groups, currentKey, candidate.key)).map((candidate) => candidate.key)
}

function wouldCreateCycle(groups: readonly Pick<PackageGroupInput, "key" | "dependsOnGroupKey">[], currentKey: string, dependencyKey: string): boolean {
  const next = new Map(groups.map((group) => [group.key, group.dependsOnGroupKey]))
  let cursor: string | null | undefined = dependencyKey
  const visited = new Set<string>()
  while (cursor) {
    if (cursor === currentKey || visited.has(cursor)) return true
    visited.add(cursor)
    cursor = next.get(cursor)
  }
  return false
}

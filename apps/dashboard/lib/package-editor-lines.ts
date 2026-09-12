/** The small resolved shape needed by the editor summary cache. */
export interface PackageEditorLineDetail {
  serviceName: string
  practitionerName: string
  durationName: string
  /** Raw duration data lets the unmounted item row's review change language. */
  durations?: { id: string; deliveryType: string; durationMins: number }[]
  deliveryName: string
  paidQuantity: number
  freeQuantity: number
  unitPrice: number
  discountType: "PERCENTAGE" | "FIXED" | null
  discountValue: number
  discountAmount: number
  net: number
  priceAvailable?: boolean
  pricePending?: boolean
}

/** Drop removed rows while keeping detail objects for rows that can re-index. */
export function prunePackageLineDetails<T extends PackageEditorLineDetail>(details: Record<number, T>, count: number) {
  return Object.fromEntries(Object.entries(details).filter(([index]) => Number(index) < count)) as Record<number, T>
}

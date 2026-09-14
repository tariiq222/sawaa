import type { DeliveryType } from './service'

/** Version marker for mutable package definitions and immutable purchases. */
export type PackageModelVersion = 'LEGACY' | 'GROUPED_V2'

/** Whether sessions in a group must be completed in order. */
export type GroupSequenceMode = 'ORDERED' | 'UNORDERED'

export type GlobalDiscount =
  | { type: 'NONE'; value: 0 }
  | { type: 'PERCENTAGE'; value: number }
  | { type: 'FIXED'; value: number }

/** One explicitly configured session in a V2 package group. */
export interface PackageSessionInput {
  key: string
  position: number
  durationOptionId: string
  deliveryType: DeliveryType
  unitPrice: number
}

/** A V2 group owns one practitioner and an ordered or selectable sequence. */
export interface PackageGroupInput {
  key: string
  label?: string
  serviceId: string
  employeeId: string
  sequenceMode: GroupSequenceMode
  dependsOnGroupKey: string | null
  sessions: PackageSessionInput[]
}

/** Creation payload for a grouped V2 package. */
export interface GroupedPackageInput {
  modelVersion: 'GROUPED_V2'
  groups: PackageGroupInput[]
  globalDiscount: GlobalDiscount
}

import { z } from 'zod'
import type { PackageGroupInput } from '../types/session-package-v2'

const safeMoneySchema = z.number().int().nonnegative().safe()

export const packageModelVersionSchema = z.enum(['LEGACY', 'GROUPED_V2'])
export const groupSequenceModeSchema = z.enum(['ORDERED', 'UNORDERED'])
export const packageDeliveryTypeSchema = z.enum(['IN_PERSON', 'ONLINE'])

export const globalDiscountSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('NONE'), value: z.literal(0) }),
  z.object({ type: z.literal('PERCENTAGE'), value: z.number().min(0).max(100) }),
  z.object({ type: z.literal('FIXED'), value: safeMoneySchema }),
])

export const packageSessionInputSchema = z.object({
  key: z.string().trim().min(1),
  position: z.number().int().nonnegative().max(2_147_483_647),
  durationOptionId: z.string().uuid(),
  deliveryType: packageDeliveryTypeSchema,
  unitPrice: safeMoneySchema,
})

export const packageGroupInputSchema = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().min(1).optional(),
  serviceId: z.string().uuid(),
  employeeId: z.string().uuid(),
  sequenceMode: groupSequenceModeSchema,
  dependsOnGroupKey: z.string().trim().min(1).nullable(),
  sessions: z.array(packageSessionInputSchema).min(1),
})

export type PackageGroupGraphIssueCode =
  | 'PACKAGE_GROUP_CYCLE'
  | 'PACKAGE_GROUP_REFERENCE'
  | 'PACKAGE_GROUP_DUPLICATE'
  | 'PACKAGE_SESSION_POSITION'

export interface PackageGroupGraphIssue {
  code: PackageGroupGraphIssueCode
  groupIndex?: number
  sessionIndex?: number
  message: string
}

/** Shared graph policy used by Zod and the backend BadRequestException helper. */
export function findPackageGroupGraphIssues(
  groups: readonly PackageGroupInput[],
): PackageGroupGraphIssue[] {
  const issues: PackageGroupGraphIssue[] = []
  const groupIndexesByKey = new Map<string, number[]>()

  groups.forEach((group, groupIndex) => {
    const indexes = groupIndexesByKey.get(group.key) ?? []
    indexes.push(groupIndex)
    groupIndexesByKey.set(group.key, indexes)
  })

  for (const indexes of groupIndexesByKey.values()) {
    if (indexes.length > 1) {
      issues.push({
        code: 'PACKAGE_GROUP_DUPLICATE',
        groupIndex: indexes[1],
        message: 'Package group keys must be unique',
      })
    }
  }

  const groupKeys = new Set(groupIndexesByKey.keys())
  groups.forEach((group, groupIndex) => {
    if (group.sessions.length === 0) {
      issues.push({
        code: 'PACKAGE_SESSION_POSITION',
        groupIndex,
        message: 'Each package group must contain at least one session',
      })
      return
    }

    const positions = new Set<number>()
    const sessionKeys = new Set<string>()
    let hasDuplicatePosition = false
    let hasDuplicateKey = false
    for (const session of group.sessions) {
      if (positions.has(session.position)) hasDuplicatePosition = true
      if (sessionKeys.has(session.key)) hasDuplicateKey = true
      positions.add(session.position)
      sessionKeys.add(session.key)
    }
    if (hasDuplicatePosition || hasDuplicateKey) {
      issues.push({
        code: 'PACKAGE_GROUP_DUPLICATE',
        groupIndex,
        message: 'Session keys and positions must be unique within a package group',
      })
    }

    const sortedPositions = [...positions].sort((a, b) => a - b)
    const isContiguous = sortedPositions.every((position, index) => position === index)
    if (!isContiguous) {
      issues.push({
        code: 'PACKAGE_SESSION_POSITION',
        groupIndex,
        message: 'Session positions must be contiguous starting at zero',
      })
    }

    if (group.dependsOnGroupKey !== null && !groupKeys.has(group.dependsOnGroupKey)) {
      issues.push({
        code: 'PACKAGE_GROUP_REFERENCE',
        groupIndex,
        message: `Package group dependency does not exist: ${group.dependsOnGroupKey}`,
      })
    }
  })

  const state = new Map<string, 0 | 1 | 2>()
  let cycleFound = false
  const visit = (key: string): void => {
    if (cycleFound) return
    const current = state.get(key)
    if (current === 1) {
      cycleFound = true
      issues.push({
        code: 'PACKAGE_GROUP_CYCLE',
        groupIndex: groupIndexesByKey.get(key)?.[0],
        message: 'Package group dependencies must not contain a cycle',
      })
      return
    }
    if (current === 2) return
    state.set(key, 1)
    const group = groups[groupIndexesByKey.get(key)?.[0] ?? -1]
    if (group?.dependsOnGroupKey && groupKeys.has(group.dependsOnGroupKey)) {
      visit(group.dependsOnGroupKey)
    }
    state.set(key, 2)
  }

  for (const key of groupKeys) visit(key)
  return issues
}

export const groupedPackageInputSchema = z
  .object({
    modelVersion: z.literal('GROUPED_V2'),
    groups: z.array(packageGroupInputSchema).min(1),
    globalDiscount: globalDiscountSchema,
  })
  .superRefine((value, context) => {
    for (const issue of findPackageGroupGraphIssues(value.groups)) {
      const path: (string | number)[] = ['groups']
      if (issue.groupIndex !== undefined) path.push(issue.groupIndex)
      if (issue.sessionIndex !== undefined) path.push('sessions', issue.sessionIndex)
      context.addIssue({ code: 'custom', path, message: issue.message })
    }
  })

export type PackageSessionInputShape = z.infer<typeof packageSessionInputSchema>
export type PackageGroupInputShape = z.infer<typeof packageGroupInputSchema>
export type GroupedPackageInputShape = z.infer<typeof groupedPackageInputSchema>

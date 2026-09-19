import { BadRequestException } from '@nestjs/common'
import { validateGroupGraph } from './package-group-policy'
import type { PackageGroupInput } from '@sawaa/shared/types'

const serviceId = '00000000-0000-4000-8000-000000000001'
const employeeId = '00000000-0000-4000-8000-000000000002'
const durationOptionId = '00000000-0000-4000-8000-000000000003'

const group = (overrides: Partial<PackageGroupInput> = {}): PackageGroupInput => ({
  key: 'group-a',
  serviceId,
  employeeId,
  sequenceMode: 'ORDERED',
  dependsOnGroupKey: null,
  sessions: [
    {
      key: 'session-a-1',
      position: 0,
      durationOptionId,
      deliveryType: 'IN_PERSON',
      unitPrice: 10000,
    },
  ],
  ...overrides,
})

const errorCode = (error: unknown): unknown =>
  error instanceof BadRequestException ? (error.getResponse() as { code?: string }).code : undefined

const codeFor = (groups: PackageGroupInput[]): unknown => {
  try {
    validateGroupGraph(groups)
    return undefined
  } catch (error) {
    return errorCode(error)
  }
}

describe('validateGroupGraph', () => {
  it('accepts a simple group and multiple practitioners', () => {
    expect(() =>
      validateGroupGraph([
        group(),
        group({
          key: 'group-b',
          employeeId: '00000000-0000-4000-8000-000000000004',
          dependsOnGroupKey: 'group-a',
        }),
      ]),
    ).not.toThrow()
  })

  it('rejects a self-cycle', () => {
    expect(codeFor([group({ dependsOnGroupKey: 'group-a' })])).toBe('PACKAGE_GROUP_CYCLE')
  })

  it('rejects an indirect cycle', () => {
    expect(codeFor([
      group({ dependsOnGroupKey: 'group-b' }),
      group({ key: 'group-b', dependsOnGroupKey: 'group-a' }),
    ])).toBe('PACKAGE_GROUP_CYCLE')
  })

  it('rejects an unknown dependency', () => {
    expect(codeFor([group({ dependsOnGroupKey: 'missing' })])).toBe('PACKAGE_GROUP_REFERENCE')
  })

  it('rejects duplicate group keys and duplicate session positions', () => {
    expect(codeFor([group(), group()])).toBe('PACKAGE_GROUP_DUPLICATE')
    expect(codeFor([group({
      sessions: [
        { ...group().sessions[0], key: 'one', position: 0 },
        { ...group().sessions[0], key: 'two', position: 0 },
      ],
    })])).toBe('PACKAGE_GROUP_DUPLICATE')
    expect(codeFor([group({
      sessions: [
        { ...group().sessions[0], key: 'same', position: 0 },
        { ...group().sessions[0], key: 'same', position: 1 },
      ],
    })])).toBe('PACKAGE_GROUP_DUPLICATE')
  })

  it('rejects gaps and empty groups', () => {
    expect(codeFor([group({
      sessions: [{ ...group().sessions[0], position: 1 }],
    })])).toBe('PACKAGE_SESSION_POSITION')
    expect(codeFor([group({ sessions: [] })])).toBe('PACKAGE_SESSION_POSITION')
  })
})

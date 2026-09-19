import { BadRequestException } from '@nestjs/common'
import {
  findPackageGroupGraphIssues,
  type PackageGroupGraphIssue,
} from '@sawaa/shared/schemas'
import type { PackageGroupInput } from '@sawaa/shared/types'

const errorMessages: Record<PackageGroupGraphIssue['code'], string> = {
  PACKAGE_GROUP_CYCLE: 'Package group dependencies must not contain a cycle',
  PACKAGE_GROUP_REFERENCE: 'Package group dependency does not exist',
  PACKAGE_GROUP_DUPLICATE: 'Package group keys and session positions must be unique',
  PACKAGE_SESSION_POSITION: 'Session positions must be contiguous starting at zero',
}

/** Validate V2 group references and session ordinals without IO. */
export function validateGroupGraph(groups: PackageGroupInput[]): void {
  const issue = findPackageGroupGraphIssues(groups)[0]
  if (!issue) return

  throw new BadRequestException({
    code: issue.code,
    message: issue.message || errorMessages[issue.code],
  })
}

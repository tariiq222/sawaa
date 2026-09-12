import { BadRequestException } from '@nestjs/common';
import {
  PackageConstraintDimension,
  PackageConstraintMode,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { CreateSessionPackageItemDto } from './create-session-package/create-session-package.dto';
import {
  NormalizedConstraint,
  NormalizedItem,
  validatePackageItems,
} from './package-constraints.helper';

/**
 * Validate catalog items for a package with a practitioner owner.
 *
 * Ownership is persisted as a normal practitioner INCLUDE constraint on each
 * item. This keeps package-credit snapshots self-contained: booking never
 * needs to look up the mutable package template or its owner.
 */
export async function validatePackageItemsForOwner(
  prisma: PrismaService,
  items: CreateSessionPackageItemDto[],
  ownerEmployeeId: string | null | undefined,
): Promise<NormalizedItem[]> {
  if (ownerEmployeeId == null) return validatePackageItems(prisma, items);

  const owner = await prisma.employee.findFirst({
    where: { id: ownerEmployeeId, isActive: true },
    select: { id: true },
  });
  if (!owner) {
    throw new BadRequestException('Package owner was not found or is inactive');
  }

  const links = await prisma.employeeService.findMany({
    where: { employeeId: ownerEmployeeId, isActive: true },
    select: { id: true, serviceId: true, useCustomPricing: true },
  });
  const linkedServiceIds = [...new Set(links.map((link) => link.serviceId))];
  const activeServices = linkedServiceIds.length
    ? await prisma.service.findMany({
        where: { id: { in: linkedServiceIds }, isActive: true, archivedAt: null },
        select: { id: true },
      })
    : [];
  const activeLinkedServiceIds = new Set(activeServices.map((service) => service.id));

  // Reject malformed practitioner scopes before ANY/INCLUDE narrowing or
  // target existence lookups can replace or obscure the caller's bad input.
  for (const item of items) {
    const practitioner = (item.constraints ?? []).find(
      (constraint) => constraint.dimension === PackageConstraintDimension.PRACTITIONER,
    );
    if (practitioner?.mode === PackageConstraintMode.ANY && practitioner.targetIds?.length) {
      throw new BadRequestException('ANY constraint for PRACTITIONER must have no targets');
    }
    if (
      practitioner &&
      practitioner.mode !== PackageConstraintMode.ANY &&
      !(practitioner.targetIds?.length)
    ) {
      throw new BadRequestException(
        `${practitioner.mode} constraint for PRACTITIONER needs at least one target`,
      );
    }
  }

  const practitionerTargets = [
    ...new Set(
      items.flatMap((item) =>
        (item.constraints ?? [])
          .filter((constraint) =>
            constraint.dimension === PackageConstraintDimension.PRACTITIONER &&
            constraint.mode !== PackageConstraintMode.ANY,
          )
          .flatMap((constraint) => constraint.targetIds ?? []),
      ),
    ),
  ];
  if (practitionerTargets.length) {
    const referencedEmployees = await prisma.employee.findMany({
      where: { id: { in: practitionerTargets } },
      select: { id: true },
    });
    const employeeIds = new Set(referencedEmployees.map((employee) => employee.id));
    const missing = practitionerTargets.find((employeeId) => !employeeIds.has(employeeId));
    if (missing) throw new BadRequestException(`Employee not found: ${missing}`);
  }

  const ownedItems = items.map((input) => {
    if (input.employeeId && input.employeeId !== ownerEmployeeId) {
      throw new BadRequestException('Package item practitioner must match the package owner');
    }

    // Legacy triples already carry a concrete practitioner. Leave them intact
    // so the shared validator can synthesize all three INCLUDE constraints.
    if (!input.constraints || input.constraints.length === 0) {
      if (input.serviceId && !activeLinkedServiceIds.has(input.serviceId)) {
        throw new BadRequestException(`Service ${input.serviceId} is not an active offering of the package owner`);
      }
      if (!input.serviceId && activeLinkedServiceIds.size === 0) {
        throw new BadRequestException('Package owner has no active service offering');
      }
      return input;
    }

    const constraints = input.constraints.map((constraint) => ({
      dimension: constraint.dimension,
      mode: constraint.mode,
      targetIds: [...(constraint.targetIds ?? [])],
    }));

    const practitioner = constraints.find(
      (constraint) => constraint.dimension === PackageConstraintDimension.PRACTITIONER,
    );
    if (practitioner?.mode === PackageConstraintMode.EXCLUDE) {
      if (practitioner.targetIds.includes(ownerEmployeeId)) {
        throw new BadRequestException('Package owner is excluded by an item practitioner constraint');
      }
    }
    if (practitioner?.mode === PackageConstraintMode.INCLUDE && !practitioner.targetIds.includes(ownerEmployeeId)) {
      throw new BadRequestException('Package item practitioner constraint contradicts the package owner');
    }

    // ANY and INCLUDE are both narrowed to the owner. A missing practitioner
    // dimension inherits the owner in the same way as ANY.
    const ownerConstraint: NormalizedConstraint = {
      dimension: PackageConstraintDimension.PRACTITIONER,
      mode: PackageConstraintMode.INCLUDE,
      targetIds: [ownerEmployeeId],
    };
    const practitionerIndex = constraints.findIndex(
      (constraint) => constraint.dimension === PackageConstraintDimension.PRACTITIONER,
    );
    if (practitionerIndex === -1) constraints.push(ownerConstraint);
    else constraints[practitionerIndex] = ownerConstraint;

    const service = constraints.find(
      (constraint) => constraint.dimension === PackageConstraintDimension.SERVICE,
    );
    if (!service) {
      if (activeLinkedServiceIds.size === 0) {
        throw new BadRequestException('Package owner has no active service offering');
      }
    } else if (service.mode === PackageConstraintMode.INCLUDE) {
      const unsupported = service.targetIds.find((serviceId) => !activeLinkedServiceIds.has(serviceId));
      if (unsupported) {
        throw new BadRequestException(`Service ${unsupported} is not an active offering of the package owner`);
      }
    } else {
      const remaining = [...activeLinkedServiceIds].some(
        (serviceId) => service.mode === PackageConstraintMode.ANY || !service.targetIds.includes(serviceId),
      );
      if (!remaining) {
        throw new BadRequestException('Owner package item must leave at least one active owner service eligible');
      }
    }

    return { ...input, constraints };
  });

  const durationTargetsByItem = ownedItems.map((item) => {
    const serviceConstraint = (item.constraints ?? []).find(
      (constraint) =>
        constraint.dimension === PackageConstraintDimension.SERVICE &&
        constraint.mode === PackageConstraintMode.INCLUDE &&
        (constraint.targetIds ?? []).length === 1,
    );
    const serviceId = serviceConstraint?.targetIds?.[0] ?? item.serviceId ?? null;
    const durationIds = item.constraints && item.constraints.length > 0
      ? item.constraints
          .filter((constraint) =>
            constraint.dimension === PackageConstraintDimension.DURATION &&
            constraint.mode !== PackageConstraintMode.ANY,
          )
          .flatMap((constraint) => constraint.targetIds ?? [])
      : item.durationOptionId
        ? [item.durationOptionId]
        : [];
    return { serviceId, durationIds };
  });
  const durationTargets = [...new Set(durationTargetsByItem.flatMap((item) => item.durationIds))];
  if (durationTargets.length) {
    const durationOptions = await prisma.serviceDurationOption.findMany({
      where: { id: { in: durationTargets }, isActive: true },
      select: { id: true, serviceId: true, employeeServiceId: true },
    });
    const durationById = new Map(durationOptions.map((option) => [option.id, option]));
    const ownerLinkByService = new Map(links.map((link) => [link.serviceId, link]));

    for (const { serviceId, durationIds } of durationTargetsByItem) {
      for (const durationId of durationIds) {
        const option = durationById.get(durationId);
        // Generic validation reports missing/inactive durations below. Only
        // apply service/scope checks when the active row is available here.
        if (!option) continue;
        if (serviceId && option.serviceId !== serviceId) {
          throw new BadRequestException(
            `Duration option ${durationId} does not belong to selected service ${serviceId}`,
          );
        }

        const ownerLink = ownerLinkByService.get(serviceId ?? option.serviceId);
        if (!ownerLink) continue;
        const expectedEmployeeServiceId = ownerLink.useCustomPricing ? ownerLink.id : null;
        const actualEmployeeServiceId = option.employeeServiceId ?? null;
        if (actualEmployeeServiceId !== expectedEmployeeServiceId) {
          throw new BadRequestException(
            expectedEmployeeServiceId
              ? `Duration option ${durationId} is not owned by the package owner's custom service offering`
              : `Duration option ${durationId} must use the service-default offering for the package owner`,
          );
        }
      }
    }
  }

  // Validate only after inheritance. This permits a fixed owner item with a
  // concrete service and duration to omit unitPrice and use the legacy price
  // resolver, while still applying the shared DB checks to the owner target.
  return validatePackageItems(prisma, ownedItems);
}

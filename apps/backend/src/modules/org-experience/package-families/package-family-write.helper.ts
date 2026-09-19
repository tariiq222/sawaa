import { BadRequestException } from '@nestjs/common';
import { DiscountType } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { resolvePackageGroupOfferings, validateGroupedPackageStorageBounds, type PackageGroupInputLike } from '../session-packages/package-group-offering.helper';
import { allocateSessionNet } from '../session-packages/package-group-pricing';
import type { GlobalDiscount } from '@sawaa/shared/types';
import type { PackageFamilyOptionDto } from './package-family.dto';

export type FamilyWriteClient = {
  sessionPackage: { create(args: any): Promise<any>; update(args: any): Promise<any>; findUnique(args: any): Promise<any> };
  sessionPackageGroup: { createMany(args: any): Promise<any>; deleteMany(args: any): Promise<any>; updateMany(args: any): Promise<any> };
  sessionPackageItem: { create(args: any): Promise<any>; deleteMany(args: any): Promise<any> };
};

function storedDiscount(discount: GlobalDiscount) {
  return {
    discountType: discount.type === 'FIXED' ? DiscountType.FIXED : DiscountType.PERCENTAGE,
    discountValue: discount.type === 'NONE' ? 0 : discount.value,
  };
}

/** Writes one GROUPED_V2 option using the same identity/pricing checks as standalone packages. */
export async function writeGroupedFamilyOption(
  tx: FamilyWriteClient,
  option: PackageFamilyOptionDto,
  familyId: string,
  priceResolverDb: any,
  priceResolver?: any,
  optionId?: string,
) {
  if (!option.groups?.length || !option.globalDiscount) {
    throw new BadRequestException('Package family options require groups and globalDiscount');
  }
  const offerings = await resolvePackageGroupOfferings(
    priceResolverDb,
    option.groups as PackageGroupInputLike[],
    priceResolver,
  );
  const prices = offerings.flatMap((group) => group.sessions.map((session) => session.unitPrice));
  validateGroupedPackageStorageBounds(prices, option.globalDiscount);
  allocateSessionNet(prices, option.globalDiscount as unknown as GlobalDiscount);

  const groupRows = offerings.map((group, index) => ({
    id: randomUUID(),
    key: group.key,
    label: group.label ?? null,
    serviceId: group.serviceId,
    employeeId: group.employeeId,
    sequenceMode: group.sequenceMode,
    sortOrder: index,
  }));
  const groupIds = new Map(groupRows.map((row) => [row.key, row.id]));
  const discount = storedDiscount(option.globalDiscount as unknown as GlobalDiscount);
  const packageData = {
    ...(optionId ? {} : { id: randomUUID() }),
    familyId,
    archivedAt: null,
    modelVersion: 'GROUPED_V2',
    ownerEmployeeId: null,
    nameAr: option.nameAr,
    nameEn: option.nameEn ?? null,
    descriptionAr: null,
    descriptionEn: null,
    imageUrl: null,
    iconName: null,
    iconBgColor: null,
    ...discount,
    isActive: option.isActive ?? true,
    isPublic: option.isPublic ?? false,
    sortOrder: 0,
  };

  const pkg = optionId
    ? await tx.sessionPackage.update({ where: { id: optionId }, data: packageData })
    : await tx.sessionPackage.create({ data: packageData });
  if (optionId) {
    await tx.sessionPackageItem.deleteMany({ where: { packageId: optionId } });
    await tx.sessionPackageGroup.updateMany({ where: { packageId: optionId }, data: { dependsOnGroupId: null } });
    await tx.sessionPackageGroup.deleteMany({ where: { packageId: optionId } });
  }
  await tx.sessionPackageGroup.createMany({
    data: groupRows.map((row, index) => ({
      ...row,
      packageId: pkg.id,
      dependsOnGroupId: offerings[index].dependsOnGroupKey ? groupIds.get(offerings[index].dependsOnGroupKey!) ?? null : null,
    })),
  });
  for (const [groupIndex, group] of offerings.entries()) {
    for (const [sessionIndex, session] of group.sessions.entries()) {
      await tx.sessionPackageItem.create({
        data: {
          id: randomUUID(),
          packageId: pkg.id,
          groupId: groupRows[groupIndex].id,
          sessionPosition: session.position,
          serviceId: group.serviceId,
          employeeId: group.employeeId,
          durationOptionId: session.durationOptionId,
          unitPrice: session.unitPrice,
          label: null,
          paidQuantity: 1,
          freeQuantity: 0,
          discountType: null,
          discountValue: 0,
          sortOrder: sessionIndex,
          constraints: { create: [
            { dimension: 'SERVICE', mode: 'INCLUDE', targets: { create: [{ targetId: group.serviceId }] } },
            { dimension: 'PRACTITIONER', mode: 'INCLUDE', targets: { create: [{ targetId: group.employeeId }] } },
            { dimension: 'DURATION', mode: 'INCLUDE', targets: { create: [{ targetId: session.durationOptionId }] } },
            { dimension: 'DELIVERY_TYPE', mode: 'INCLUDE', targets: { create: [{ targetId: session.deliveryType }] } },
          ] },
        },
      });
    }
  }
  return { id: pkg.id, ...packageData, groups: groupRows.map((row, index) => ({ ...row, items: offerings[index].sessions })) };
}

export function familySessionCount(option: any): number {
  if (Array.isArray(option?.groups) && option.groups.length > 0) {
    return option.groups.reduce((total: number, group: any) => total + (group.items?.length ?? group.sessions?.length ?? 0), 0);
  }
  return (option?.items ?? []).reduce((total: number, item: any) => total + Number(item.paidQuantity ?? 0) + Number(item.freeQuantity ?? 0), 0);
}

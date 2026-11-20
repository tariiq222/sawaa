import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../../infrastructure/database';

/**
 * Supporting-entity reads for a package-credit booking (MNT-18).
 *
 * These are the same four lookups the handler already performed, in the same
 * order, with the same select shapes — just moved out of `execute` so the
 * handler stays readable. No transaction is opened here: all of it is the
 * pre-transaction validation phase, exactly as before.
 */
export interface BookingParties {
  branch: { id: string; nameAr: string; isActive: boolean };
  employee: { id: string; name: string; isActive: boolean };
  service: {
    id: string;
    nameAr: string;
    categoryId: string | null;
    isActive: boolean;
    archivedAt: Date | null;
    bufferMinutes: number | null;
  };
}

export async function loadBookingParties(
  prisma: PrismaService,
  input: { branchId: string; clientId: string; employeeId: string; serviceId: string },
): Promise<BookingParties> {
  const branch = await prisma.branch.findFirst({
    where: { id: input.branchId },
    select: { id: true, nameAr: true, isActive: true },
  });
  if (!branch) throw new NotFoundException('Branch not found');
  if (branch.isActive === false) throw new BadRequestException('Branch is not active');

  const client = await prisma.client.findFirst({
    where: { id: input.clientId, deletedAt: null },
    select: { id: true },
  });
  if (!client) throw new NotFoundException('Client not found');

  const employee = await prisma.employee.findFirst({
    where: { id: input.employeeId },
    select: { id: true, name: true, isActive: true },
  });
  if (!employee) throw new NotFoundException('Employee not found');
  if (employee.isActive === false) throw new BadRequestException('Employee is not active');

  const service = await prisma.service.findFirst({
    where: { id: input.serviceId },
    select: {
      id: true,
      nameAr: true,
      categoryId: true,
      isActive: true,
      archivedAt: true,
      bufferMinutes: true,
    },
  });
  if (!service) throw new NotFoundException('Service not found');
  if (service.isActive === false) throw new BadRequestException('Service is not active');
  if (service.archivedAt != null) throw new BadRequestException('Service is archived');

  return { branch, employee, service };
}

/** Category/department snapshot names for the booking row (read-only). */
export async function loadCategoryAndDepartmentNames(
  prisma: PrismaService,
  categoryId: string | null,
): Promise<{ categoryName: string | null; departmentName: string | null }> {
  let categoryName: string | null = null;
  let departmentName: string | null = null;
  if (!categoryId) return { categoryName, departmentName };

  const category = await prisma.serviceCategory.findFirst({
    where: { id: categoryId },
    select: { nameAr: true, departmentId: true },
  });
  if (!category) return { categoryName, departmentName };

  categoryName = category.nameAr;
  if (category.departmentId) {
    const department = await prisma.department.findFirst({
      where: { id: category.departmentId },
      select: { nameAr: true },
    });
    if (department) departmentName = department.nameAr;
  }
  return { categoryName, departmentName };
}

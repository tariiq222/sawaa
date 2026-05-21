import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';
import { CheckAvailabilityHandler, AvailableSlot } from '../../check-availability/check-availability.handler';
import { GetPublicAvailabilityDto } from './get-public-availability.dto';

export type GetPublicAvailabilityQuery = GetPublicAvailabilityDto & {
  employeeId: string;
};

@Injectable()
export class GetPublicAvailabilityHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly checkAvailability: CheckAvailabilityHandler,
  ) {}

  async execute(query: GetPublicAvailabilityQuery): Promise<AvailableSlot[]> {
    const employee = await this.prisma.employee.findFirst({
      where: { id: query.employeeId, isPublic: true, isActive: true },
      select: { id: true },
    });

    if (!employee) {
      throw new NotFoundException('Resource not found or not available');
    }

    let branchId = query.branchId;

    if (!branchId) {
      const employeeBranch = await this.prisma.employeeBranch.findFirst({
        where: { employeeId: query.employeeId },
        select: { branchId: true },
      });
      branchId = employeeBranch?.branchId;
    }

    if (!branchId) {
      throw new NotFoundException('Resource not found or not available');
    }

    let serviceId = query.serviceId;

    if (!serviceId) {
      const employeeService = await this.prisma.employeeService.findFirst({
        where: { employeeId: query.employeeId },
        select: { serviceId: true },
      });
      serviceId = employeeService?.serviceId;
    }

    if (!serviceId) {
      throw new NotFoundException('Resource not found or not available');
    }

    const date = new Date(query.date);

    const slots = await this.checkAvailability.execute({
      employeeId: query.employeeId,
      branchId,
      serviceId,
      date,
      durationOptionId: query.durationOptionId,
      bookingType: query.bookingType,
      deliveryType: query.deliveryType,
    });

    return slots;
  }
}

import { CacheService } from '../../../infrastructure/cache';
import { SERVICES_CACHE_PREFIX } from '../../org-experience/services/services.cache';
import { BadRequestException, Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface AssignEmployeeServiceCommand { employeeId: string; serviceId: string; }

@Injectable()
export class AssignEmployeeServiceHandler {
  constructor(private readonly prisma: PrismaService, private readonly cache: CacheService) {}

  async execute(cmd: AssignEmployeeServiceCommand) {
    if (!cmd.serviceId) {
      throw new BadRequestException('serviceId is required');
    }

    const employee = await this.prisma.employee.findFirst({
      where: { id: cmd.employeeId },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    // Track B — practitioner integrity: an inactive employee must not gain
    // new service assignments. The link would otherwise silently activate
    // when the employee is re-enabled.
    if (employee.isActive === false) {
      throw new BadRequestException('Employee is not active');
    }

    const service = await this.prisma.service.findFirst({
      where: { id: cmd.serviceId, archivedAt: null },
    });
    if (!service) throw new NotFoundException('Service not found');

    const existing = await this.prisma.employeeService.findUnique({
      where: { employeeId_serviceId: { employeeId: cmd.employeeId, serviceId: cmd.serviceId } },
    });
    if (existing) throw new ConflictException('Service already assigned to employee');

    const result = await this.prisma.employeeService.create({
      data: {
        employeeId: cmd.employeeId,
        serviceId: cmd.serviceId,
      },
    });
    await this.cache.invalidatePrefix(SERVICES_CACHE_PREFIX);
    return result;
  }
}

import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { CreateGroupSessionDto } from './create-group-session.dto';

export type CreateGroupSessionCommand = Omit<CreateGroupSessionDto, 'scheduledAt'> & {
  scheduledAt: Date;
};

@Injectable()
export class CreateGroupSessionHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: CreateGroupSessionCommand) {
    if (cmd.scheduledAt <= new Date()) {
      throw new BadRequestException('scheduledAt must be in the future');
    }

    // 1. Branch check
    const branch = await this.prisma.branch.findFirst({
      where: { id: cmd.branchId },
      select: { id: true, nameAr: true, isActive: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    if (branch.isActive === false) throw new BadRequestException('Branch is not active');

    // 2. Employee check
    const employee = await this.prisma.employee.findFirst({
      where: { id: cmd.employeeId },
      select: { id: true, name: true, isActive: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    if (employee.isActive === false) throw new BadRequestException('Employee is not active');

    // 3. Group program check
    const program = await this.prisma.groupProgram.findFirst({
      where: { id: cmd.programId },
      select: { id: true, isActive: true },
    });
    if (!program) throw new NotFoundException('Group program not found');
    if (!program.isActive) throw new BadRequestException('Group program is not active');

    const session = await this.prisma.groupSession.create({
      data: {
        branchId: cmd.branchId,
        employeeId: cmd.employeeId,
        programId: cmd.programId,
        title: cmd.title,
        descriptionAr: cmd.descriptionAr,
        descriptionEn: cmd.descriptionEn,
        scheduledAt: cmd.scheduledAt,
        durationMins: cmd.durationMins,
        maxCapacity: cmd.maxCapacity,
        enrolledCount: 0,
        price: cmd.price,
        deliveryType: cmd.deliveryType,
        isPublic: cmd.isPublic ?? false,
        publicDescriptionAr: cmd.publicDescriptionAr,
        publicDescriptionEn: cmd.publicDescriptionEn,
      },
    });
    return { id: session.id, status: session.status, scheduledAt: session.scheduledAt };
  }
}

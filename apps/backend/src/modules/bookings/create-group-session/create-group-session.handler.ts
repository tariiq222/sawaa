import { Injectable, BadRequestException } from '@nestjs/common';
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
    const session = await this.prisma.groupSession.create({
      data: {
        branchId: cmd.branchId,
        employeeId: cmd.employeeId,
        serviceId: cmd.serviceId,
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

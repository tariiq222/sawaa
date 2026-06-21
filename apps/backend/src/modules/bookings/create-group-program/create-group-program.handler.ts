import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { CreateGroupProgramDto } from './create-group-program.dto';

export type CreateGroupProgramCommand = CreateGroupProgramDto;

@Injectable()
export class CreateGroupProgramHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: CreateGroupProgramCommand) {
    if (cmd.maxParticipants < cmd.minParticipants) {
      throw new BadRequestException('maxParticipants must be >= minParticipants');
    }
    const department = await this.prisma.department.findFirst({
      where: { id: cmd.departmentId },
      select: { id: true, isActive: true },
    });
    if (!department) throw new NotFoundException('Department not found');
    if (!department.isActive) throw new BadRequestException('Department is not active');

    return this.prisma.groupProgram.create({
      data: {
        departmentId: cmd.departmentId,
        nameAr: cmd.nameAr,
        nameEn: cmd.nameEn,
        descriptionAr: cmd.descriptionAr,
        descriptionEn: cmd.descriptionEn,
        minParticipants: cmd.minParticipants,
        maxParticipants: cmd.maxParticipants,
        defaultPrice: cmd.defaultPrice,
      },
      select: { id: true, ref: true },
    });
  }
}

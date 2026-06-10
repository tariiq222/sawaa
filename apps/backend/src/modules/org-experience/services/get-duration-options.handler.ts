import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface GetDurationOptionsCommand {
  serviceId: string;
}

@Injectable()
export class GetDurationOptionsHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(cmd: GetDurationOptionsCommand) {
    return this.prisma.serviceDurationOption.findMany({
      where: { serviceId: cmd.serviceId },
      orderBy: { sortOrder: 'asc' },
    });
  }
}

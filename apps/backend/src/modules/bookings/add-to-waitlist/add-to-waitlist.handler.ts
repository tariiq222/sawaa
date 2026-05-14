import { Injectable, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { AddToWaitlistDto } from './add-to-waitlist.dto';

export type AddToWaitlistCommand = Omit<AddToWaitlistDto, 'preferredDate'> & {
  preferredDate?: Date;
};

@Injectable()
export class AddToWaitlistHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(cmd: AddToWaitlistCommand) {
    const existing = await this.prisma.waitlistEntry.findFirst({
      where: {
        clientId: cmd.clientId,
        employeeId: cmd.employeeId,
        serviceId: cmd.serviceId,
        status: 'WAITING',
      },
    });
    if (existing) throw new ConflictException('Client is already on the waitlist for this employee and service');

    try {
      return await this.prisma.waitlistEntry.create({
        data: {
          clientId: cmd.clientId,
          employeeId: cmd.employeeId,
          serviceId: cmd.serviceId,
          branchId: cmd.branchId,
          preferredDate: cmd.preferredDate,
          notes: cmd.notes,
          status: 'WAITING',
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Client is already on the waitlist for this employee and service');
      }
      throw err;
    }
  }
}

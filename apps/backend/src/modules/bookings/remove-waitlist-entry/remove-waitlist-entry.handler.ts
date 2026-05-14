import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface RemoveWaitlistEntryCommand {
  id: string;
}

@Injectable()
export class RemoveWaitlistEntryHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: RemoveWaitlistEntryCommand): Promise<void> {
    const { count } = await this.prisma.waitlistEntry.deleteMany({
      where: { id: cmd.id },
    });
    if (count === 0) throw new NotFoundException(`Waitlist entry ${cmd.id} not found`);
  }
}

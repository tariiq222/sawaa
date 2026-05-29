import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface UpdateRatingVisibilityCommand {
  id: string;
  isPublic: boolean;
}

@Injectable()
export class UpdateRatingVisibilityHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: UpdateRatingVisibilityCommand): Promise<{ id: string; isPublic: boolean }> {
    const existing = await this.prisma.rating.findUnique({
      where: { id: command.id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Rating not found');
    }

    await this.prisma.rating.update({
      where: { id: command.id },
      data: { isPublic: command.isPublic },
    });

    return { id: command.id, isPublic: command.isPublic };
  }
}

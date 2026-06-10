import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import type { GetCurrentUserQuery } from './get-current-user.query';

@Injectable()
export class GetCurrentUserHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetCurrentUserQuery) {
    const user = await this.prisma.user.findUnique({
      where: { id: query.userId },
      include: { customRole: { include: { permissions: true } } },
      omit: { passwordHash: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const [fallbackFirstName = '', ...fallbackRest] = (user.name ?? '').trim().split(/\s+/);
    const firstName = user.firstName ?? fallbackFirstName;
    const lastName = user.lastName ?? fallbackRest.join(' ');

    return {
      ...user,
      firstName,
      lastName,
      onboardingCompletedAt: null,
    };
  }
}

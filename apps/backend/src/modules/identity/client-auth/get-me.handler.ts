import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { withProvenEmailOnly } from '../../people/clients/client.serializer';
import { ClientProfileDto } from './client-profile.dto';

export type ClientProfile = ClientProfileDto;

@Injectable()
export class GetMeHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(clientId: string): Promise<ClientProfile> {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, deletedAt: null },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        emailVerified: true,
        phoneVerified: true,
        avatarUrl: true,
        gender: true,
        dateOfBirth: true,
        preferredLocale: true,
        pushEnabled: true,
        accountType: true,
        claimedAt: true,
        createdAt: true,
      },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    // A legacy email that was never proven is not echoed as `email`; it is
    // surfaced separately as `unverifiedEmail` so the client sees what is stored.
    return withProvenEmailOnly({
      ...client,
      unverifiedEmail: client.emailVerified ? null : client.email,
      gender: client.gender ? (client.gender.toLowerCase() as 'male' | 'female') : null,
      accountType: client.accountType === 'FULL' ? ('full' as const) : ('walk_in' as const),
    });
  }
}

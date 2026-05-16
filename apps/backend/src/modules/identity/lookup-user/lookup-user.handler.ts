import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { detectChannel, normalizeIdentifier, AuthChannel } from '../shared/identifier-detector';

export interface LookupUserCommand {
  identifier: string;
}

export interface LookupUserResult {
  exists: boolean;
  hasPassword: boolean;
  identifier: string;
  channel: AuthChannel;
}

@Injectable()
export class LookupUserHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: LookupUserCommand): Promise<LookupUserResult> {
    const channel = detectChannel(cmd.identifier);
    const identifier = normalizeIdentifier(cmd.identifier, channel);

    const userWhere = channel === 'EMAIL'
      ? { email: identifier }
      : { phone: identifier };

    const user = await this.prisma.user.findFirst({
      where: userWhere,
      select: { id: true, passwordHash: true, isActive: true },
    });

    return {
      exists: !!user && user.isActive,
      hasPassword: !!user?.passwordHash,
      identifier,
      channel,
    };
  }
}

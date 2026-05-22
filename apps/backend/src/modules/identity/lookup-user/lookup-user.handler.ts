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

    // SECURITY (P0-12): the endpoint USED to return `{ exists, hasPassword }`
    // which let attackers enumerate every staff identifier in the system.
    // We now ALWAYS return `{ exists: true, hasPassword: true }` regardless of
    // whether the identifier corresponds to a real user. The login endpoint
    // (rate-limited + bcrypt) is the only place credentials are checked.
    // We still consult the DB (a) so timing is comparable to a real lookup
    // and (b) so future logic that needs to silently no-op for missing users
    // has the value available, but the result is NEVER exposed.
    await this.prisma.user.findFirst({
      where: channel === 'EMAIL' ? { email: identifier } : { phone: identifier },
      select: { id: true },
    });

    return {
      exists: true,
      hasPassword: true,
      identifier,
      channel,
    };
  }
}

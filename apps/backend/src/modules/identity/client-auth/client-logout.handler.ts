import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../../infrastructure/database';
@Injectable()
export class ClientLogoutHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(rawToken: string, clientId: string) {
    const selector = rawToken.slice(0, 8);

    const candidates = await this.prisma.clientRefreshToken.findMany({
      where: { clientId, tokenSelector: selector, revokedAt: null },
    });

    for (const c of candidates) {
      if (await bcrypt.compare(rawToken, c.tokenHash)) {
        await this.prisma.clientRefreshToken.update({
          where: { id: c.id },
          data: { revokedAt: new Date() },
        });

        // SECURITY (P1): logout MUST revoke the client's FCM push tokens too.
        // Otherwise a forced logout (or a device handed off / stolen) keeps
        // receiving push notifications for booking reminders, payments, chat —
        // a real privacy leak. We hard-delete the rows because FCM treats
        // expired tokens as unregistered and there is no audit-trail value.
        await this.prisma.fcmToken.deleteMany({ where: { clientId } }).catch(() => undefined);

        return;
      }
    }
  }
}

import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { ClientEmailStore, clientEmailStatus } from './client-email.store';
import { ClientEmailStatusDto } from './client-email.response';

@Injectable()
export class DeclineClientEmailHandler {
  private readonly logger = new Logger(DeclineClientEmailHandler.name);
  constructor(private readonly store: ClientEmailStore, private readonly prisma: PrismaService) {}
  async execute(clientId: string): Promise<ClientEmailStatusDto> {
    await this.store.transaction(async tx => {
      const client = await this.store.owner(tx, clientId);
      // A verified email is proven identity; it cannot be discarded without a new proof.
      if (client.emailVerified !== null && client.email?.trim()) throw new ConflictException({ code: 'email_verified' });
      const now = new Date();
      await tx.client.update({ where: { id: clientId }, data: { email: null, pendingEmail: null, emailPromptResolvedAt: now } });
      await tx.clientEmailChallenge.updateMany({ where: { clientId, consumedAt: null }, data: { consumedAt: now } });
    });
    this.logger.log({ event: 'client_email.declined', clientId });
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) return { status: 'none', email: null, pendingEmail: null, prompt: false };
    return clientEmailStatus(client);
  }
}

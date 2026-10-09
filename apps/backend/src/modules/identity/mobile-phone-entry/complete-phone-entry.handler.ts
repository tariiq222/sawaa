import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isEmail } from 'class-validator';
import { ClientTokenService } from '../shared/client-token.service';
import { PRIVACY_POLICY_VERSION } from '../client-auth/consent.constants';
import { detailsUnavailable, invalidFlow, translateConflict } from '../mobile-email-entry/mobile-email-errors';
import { MobilePhoneFlowStore } from './mobile-phone-flow.store';
import { CompletePhoneEntryDto } from './mobile-phone-entry.dto';

@Injectable()
export class CompletePhoneEntryHandler {
  constructor(private readonly store: MobilePhoneFlowStore, private readonly tokens: ClientTokenService) {}

  async execute(cmd: CompletePhoneEntryDto) {
    const firstName = typeof cmd.firstName === 'string' ? cmd.firstName.trim() : '';
    const lastName = typeof cmd.lastName === 'string' ? cmd.lastName.trim() : '';
    const email = typeof cmd.email === 'string' ? cmd.email.trim().toLowerCase() : undefined;
    if (!firstName || firstName.length > 100 || !lastName || lastName.length > 100 || cmd.privacyAccepted !== true ||
        (cmd.email !== undefined && (!email || !isEmail(email)))) throw new BadRequestException({ code: 'invalid_details' });
    return this.store.transaction(async tx => {
      const flow = await this.store.lockContinuation(tx, cmd.continuationToken);
      if (!flow || flow.state !== 'DETAILS_PENDING') throw invalidFlow();
      // Serialize competing phone-entry flows too: row locks alone only serialize
      // one challenge; Client.phone is intentionally not globally unique.
      await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${flow.phone}, 0))::text`);
      const clientOwner = await tx.client.findFirst({ where: { phone: flow.phone, deletedAt: null }, select: { id: true } });
      const userOwner = await tx.user.findFirst({ where: { phone: flow.phone }, select: { id: true } });
      if (clientOwner || userOwner) throw detailsUnavailable();
      if (!await this.store.consume(tx, flow)) throw invalidFlow();
      const now = new Date();
      const client = await tx.client.create({ data: {
        name: `${firstName} ${lastName}`, firstName, lastName, phone: flow.phone,
        phoneVerified: now, accountType: 'FULL', source: 'ONLINE', claimedAt: now,
        consentedAt: now, consentVersion: PRIVACY_POLICY_VERSION,
        pendingEmail: email ?? null, lastLoginAt: now,
      } });
      const pair = await this.tokens.issueTokenPair(client, tx);
      return { next: 'authenticated' as const, sessionKind: 'client' as const, emailPrompt: false,
        tokens: { accessToken: pair.accessToken, refreshToken: pair.rawRefresh } };
    }).catch(translateConflict);
  }
}

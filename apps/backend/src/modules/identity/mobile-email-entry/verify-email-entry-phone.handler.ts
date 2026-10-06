import { Injectable } from '@nestjs/common';
import { Client } from '@prisma/client';
import { isDeepStrictEqual } from 'node:util';
import { ClientTokenService } from '../shared/client-token.service';
import { PRIVACY_POLICY_VERSION } from '../client-auth/consent.constants';
import { VerifyEmailEntryPhoneDto } from './mobile-email-entry.dto';
import { EmailEntrySessionDto } from './mobile-email-entry.response';
import { MobileEmailFlowStore } from './mobile-email-flow.store';
import { MobileEmailIdentity } from './mobile-email-identity';
import { detailsUnavailable, invalidCode, invalidFlow, translateConflict } from './mobile-email-errors';

@Injectable()
export class VerifyEmailEntryPhoneHandler {
  constructor(private readonly store: MobileEmailFlowStore, private readonly identity: MobileEmailIdentity, private readonly tokens: ClientTokenService) {}
  async execute(cmd: VerifyEmailEntryPhoneDto): Promise<EmailEntrySessionDto> {
    const result = await this.store.transaction(async tx => {
      const flow = await this.store.lockContinuation(tx, cmd.continuationToken);
      if (!flow || flow.phoneChallengeId !== cmd.phoneChallengeId || !flow.phone) return { error: 'flow' as const };
      if (!await this.store.checkCode(tx, flow, 'phone', cmd.code)) return { error: 'code' as const };
      const now = new Date();
      let client: Client;
      if (flow.mode === 'LINK_PHONE') {
        const candidate = await this.identity.classify(tx, flow.email);
        if (candidate.kind !== 'link' || candidate.user.id !== flow.boundUserId || candidate.client.id !== flow.boundClientId || candidate.user.phone !== flow.phone ||
            !isDeepStrictEqual(this.identity.snapshot(candidate.user, candidate.client), flow.identitySnapshot)) return { error: 'details' as const };
        if (!await this.store.consume(tx, flow)) return { error: 'code' as const };
        await tx.user.update({ where: { id: candidate.user.id }, data: { emailVerifiedAt: now } });
        client = await tx.client.update({ where: { id: candidate.client.id }, data: { email: flow.email, emailVerified: now } });
      } else if (flow.mode === 'REGISTER') {
        if (!flow.firstName || !flow.lastName || !flow.privacyAcceptedAt || flow.boundUserId || flow.boundClientId ||
            !await this.identity.contactsFree(tx, flow.email, flow.phone)) return { error: 'details' as const };
        if (!await this.store.consume(tx, flow)) return { error: 'code' as const };
        const name = `${flow.firstName} ${flow.lastName}`.trim();
        const user = await tx.user.create({ data: { name, firstName: flow.firstName, lastName: flow.lastName, email: flow.email, phone: flow.phone,
          role: 'CLIENT', isSuperAdmin: false, isActive: true, phoneVerifiedAt: now, emailVerifiedAt: now, passwordHash: null } });
        client = await tx.client.create({ data: { userId: user.id, name, firstName: flow.firstName, lastName: flow.lastName, email: flow.email, phone: flow.phone,
          isActive: true, phoneVerified: now, emailVerified: now, accountType: 'FULL', claimedAt: now, consentedAt: flow.privacyAcceptedAt, consentVersion: PRIVACY_POLICY_VERSION } });
      } else return { error: 'flow' as const };
      const pair = await this.tokens.issueTokenPair(client, tx);
      return { next: 'authenticated' as const, sessionKind: 'client' as const, tokens: { accessToken: pair.accessToken, refreshToken: pair.rawRefresh } };
    }).catch(translateConflict);
    if ('error' in result) throw result.error === 'code' ? invalidCode() : result.error === 'flow' ? invalidFlow() : detailsUnavailable();
    return result;
  }
}

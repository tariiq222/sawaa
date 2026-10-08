import { Injectable } from '@nestjs/common';
import { RefreshTokenSource } from '@prisma/client';
import { ClientTokenService } from '../shared/client-token.service';
import { TokenService } from '../shared/token.service';
import { VerifyEmailEntryDto } from './mobile-email-entry.dto';
import { EmailEntryVerified } from './mobile-email-entry.response';
import { MobileEmailFlowStore, hashContinuation, newContinuation } from './mobile-email-flow.store';
import { MobileEmailIdentity } from './mobile-email-identity';
import { invalidCode, translateConflict } from './mobile-email-errors';

@Injectable()
export class VerifyEmailEntryHandler {
  constructor(private readonly store: MobileEmailFlowStore, private readonly identity: MobileEmailIdentity, private readonly clientTokens: ClientTokenService, private readonly tokens: TokenService) {}
  async execute(cmd: VerifyEmailEntryDto): Promise<EmailEntryVerified> {
    const result = await this.store.transaction<EmailEntryVerified | null>(async tx => {
      const flow = await this.store.lock(tx, cmd.challengeId);
      if (!flow || !await this.store.checkCode(tx, flow, 'email', cmd.code)) return null;
      const candidate = await this.identity.classify(tx, flow.email);
      if (candidate.kind === 'register' || candidate.kind === 'link') {
        const continuationToken = newContinuation();
        const continuationExpiresAt = new Date(Math.min(Date.now() + 600000, flow.createdAt.getTime() + 900000));
        await tx.mobileEmailFlow.update({ where: { id: flow.id }, data: {
          state: 'DETAILS_PENDING', emailCodeHash: null, continuationHash: hashContinuation(continuationToken), continuationExpiresAt,
          mode: candidate.kind === 'register' ? 'REGISTER' : 'LINK_PHONE',
          ...(candidate.kind === 'link' ? { boundUserId: candidate.user.id, boundClientId: candidate.client.id, identitySnapshot: this.identity.snapshot(candidate.user, candidate.client) } : {}),
        } });
        return { next: candidate.kind === 'register' ? 'register' : 'verify_phone', continuationToken, email: flow.email, expiresIn: 600 };
      }
      if (!await this.store.consume(tx, flow)) return null;
      if (candidate.kind === 'unavailable') return { next: 'unavailable' };
      if (candidate.kind === 'staff') return { next: 'authenticated', sessionKind: 'staff', tokens: await this.tokens.issueTokenPair(candidate.user, { isSuperAdmin: candidate.user.isSuperAdmin }, tx, RefreshTokenSource.MOBILE) };
      const pair = await this.clientTokens.issueTokenPair(candidate.client, tx);
      return { next: 'authenticated', sessionKind: 'client', tokens: { accessToken: pair.accessToken, refreshToken: pair.rawRefresh } };
    }).catch(translateConflict);
    if (!result) throw invalidCode();
    return result;
  }
}

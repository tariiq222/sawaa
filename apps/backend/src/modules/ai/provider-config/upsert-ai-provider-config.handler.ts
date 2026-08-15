import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { ActivityAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { RlsTransactionService } from '../../../common/database/rls-transaction';
import { AiProviderCredentialsService } from '../../../infrastructure/ai/ai-provider-credentials.service';
import { AiConnectionStatus, assertProviderModel, toPublicAiProviderConfig } from './ai-provider-config.types';
import { UpsertAiProviderConfigDto } from './provider-config.dto';

@Injectable()
export class UpsertAiProviderConfigHandler {
  constructor(private readonly prisma: PrismaService, private readonly rls: RlsTransactionService, private readonly credentials: AiProviderCredentialsService) {}

  async execute(dto: UpsertAiProviderConfigDto, actor?: { id?: string; email?: string }) {
    try { assertProviderModel(dto.provider, dto.model); } catch { throw new BadRequestException('Invalid provider or model'); }
    return this.rls.withTransaction(async (tx) => {
      const current = await tx.aiProviderConfig.findUnique({ where: { singletonKey: 'singleton' } });
      if (!current) throw new BadRequestException('Test and save an AI provider credential before updating settings');
      const changed = current.provider !== dto.provider || current.model !== dto.model;
      if (dto.isEnabled === true) {
        let fingerprintMatches = false;
        try { fingerprintMatches = Boolean(current.credentialCiphertext && this.credentials.fingerprint(this.credentials.decrypt(current.credentialCiphertext), current.provider, current.model) === current.testedConfigHash); } catch { fingerprintMatches = false; }
        if (!current.credentialCiphertext || current.connectionStatus !== AiConnectionStatus.CONNECTED || current.lastTestOk !== true || !current.testedConfigHash || !fingerprintMatches) throw new BadRequestException('A successful test for the same provider and model is required before enabling AI');
      }
      const data = {
        provider: dto.provider,
        model: dto.model,
        ...(dto.temperature !== undefined ? { temperature: dto.temperature } : {}),
        ...(dto.maxTokens !== undefined ? { maxTokens: dto.maxTokens } : {}),
        ...(dto.isEnabled !== undefined ? { isEnabled: dto.isEnabled } : {}),
      };
      if (dto.isEnabled === true && (current.provider !== dto.provider || current.model !== dto.model || !current.testedConfigHash)) {
        throw new BadRequestException('A successful test for the same provider and model is required before enabling AI');
      }
      const updated = await tx.aiProviderConfig.updateMany({ where: { id: current.id, configVersion: current.configVersion }, data: { ...data, ...(changed ? { isEnabled: false, connectionStatus: AiConnectionStatus.RETEST_REQUIRED, lastTestOk: false, lastTestErrorCode: 'RETEST_REQUIRED', testedConfigHash: null } : {}), configVersion: { increment: 1 } } });
      if (updated.count !== 1) throw new ConflictException('Provider configuration changed; retry');
      const row = await tx.aiProviderConfig.findUniqueOrThrow({ where: { id: current.id } });
      await tx.activityLog.create({ data: { userId: actor?.id, userEmail: actor?.email, action: ActivityAction.UPDATE, entity: 'AiProviderConfig', entityId: row.id, description: 'AI provider configuration updated', metadata: { provider: row.provider, isEnabled: row.isEnabled } as Prisma.InputJsonValue } });
      try { return toPublicAiProviderConfig(row); } catch {
        return { provider: row.provider, model: row.model, temperature: row.temperature, maxTokens: row.maxTokens, isEnabled: false, connectionStatus: row.connectionStatus, lastTestedAt: row.lastTestedAt, lastTestOk: row.lastTestOk, lastTestErrorCode: row.lastTestErrorCode, hasCredential: false };
      }
    });
  }
}

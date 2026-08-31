import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { ActivityAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { AiProviderClientService } from '../../../infrastructure/ai/ai-provider-client.service';
import { AiProviderCredentialsService } from '../../../infrastructure/ai/ai-provider-credentials.service';
import { AiConnectionStatus, assertProviderModel } from './ai-provider-config.types';
import { RlsTransactionService } from '../../../common/database/rls-transaction';
import { TestAiProviderConfigDto } from './provider-config.dto';

const timeoutCode = (error: unknown): string => {
  const status = (error as { status?: number })?.status;
  if (status === 401 || status === 403) return 'RETEST_REQUIRED';
  if (status === 429) return 'PROVIDER_RATE_LIMIT';
  if (status && status >= 500) return 'PROVIDER_UNAVAILABLE';
  if ((error as { name?: string })?.name === 'AbortError' || (error as { code?: string })?.code === 'ETIMEDOUT') return 'PROVIDER_TIMEOUT';
  return 'PROVIDER_REQUEST_FAILED';
};

@Injectable()
export class TestAiProviderConfigHandler {
  constructor(private readonly prisma: PrismaService, private readonly clients: AiProviderClientService, private readonly credentials: AiProviderCredentialsService, private readonly rls: RlsTransactionService) {}

  async execute(dto: TestAiProviderConfigDto, actor?: { id?: string; email?: string }) {
    try { assertProviderModel(dto.provider, dto.model); } catch { throw new BadRequestException('Invalid provider or model'); }
    if ([...dto.candidateApiKey].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)) throw new BadRequestException('Invalid candidate credential');
    const testedAt = new Date();
    let ok = false;
    let errorCode: string | null = null;
    const current = await this.prisma.aiProviderConfig.findUnique({ where: { singletonKey: 'singleton' }, select: { id: true, configVersion: true, provider: true, model: true, credentialCiphertext: true, testedConfigHash: true, temperature: true, maxTokens: true } });
    const version = current?.configVersion ?? 0;
    for (let attempt = 0; attempt < 2 && !ok; attempt += 1) {
      try {
        const client = this.clients.createCandidateClient(dto.provider, dto.candidateApiKey);
        await client.chat.completions.create({ model: dto.model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1, temperature: 0 });
        ok = true;
      } catch (error) { errorCode = timeoutCode(error); if (!['PROVIDER_TIMEOUT', 'PROVIDER_UNAVAILABLE'].includes(errorCode)) break; }
    }

    if (!ok) {
      const candidateHash = this.credentials.fingerprint(dto.candidateApiKey, dto.provider, dto.model);
      await this.rls.withTransaction(async (tx) => {
        if (current && current.testedConfigHash === candidateHash && current.provider === dto.provider && current.model === dto.model) await tx.aiProviderConfig.updateMany({ where: { id: current.id, configVersion: version }, data: { connectionStatus: errorCode === 'RETEST_REQUIRED' ? AiConnectionStatus.RETEST_REQUIRED : AiConnectionStatus.FAILED, lastTestedAt: testedAt, lastTestOk: false, lastTestErrorCode: errorCode, configVersion: { increment: 1 } } });
        await tx.activityLog.create({ data: { action: ActivityAction.SYSTEM, entity: 'AiProviderConfig', entityId: current?.id, description: 'AI provider candidate test failed', metadata: { provider: dto.provider, errorCode, mutated: Boolean(current && current.testedConfigHash === candidateHash && current.provider === dto.provider && current.model === dto.model) } as Prisma.InputJsonValue } });
      });
      return { ok: false, errorCode, testedAt, persisted: false };
    }
    if (!dto.saveCredential) {
      await this.rls.withTransaction(async (tx) => tx.activityLog.create({ data: { userId: actor?.id, userEmail: actor?.email, action: ActivityAction.SYSTEM, entity: 'AiProviderConfig', entityId: current?.id, description: 'AI provider candidate tested', metadata: { provider: dto.provider, success: true, persisted: false } as Prisma.InputJsonValue } }));
      return { ok: true, errorCode: null, testedAt, persisted: false };
    }
    if (!current && !dto.saveCredential) return { ok: true, errorCode: null, testedAt, persisted: false };
    const ciphertext = this.credentials.encrypt(dto.candidateApiKey);
    const row = await this.rls.withTransaction(async (tx) => {
      if (!current) {
        try {
          const created = await tx.aiProviderConfig.create({ data: { singletonKey: 'singleton', provider: dto.provider, model: dto.model, temperature: dto.temperature ?? 0.4, maxTokens: dto.maxTokens ?? 800, isEnabled: dto.isEnabled ?? false, credentialCiphertext: ciphertext, testedConfigHash: this.credentials.fingerprint(dto.candidateApiKey, dto.provider, dto.model), connectionStatus: AiConnectionStatus.CONNECTED, lastTestedAt: testedAt, lastTestOk: true } });
          await tx.activityLog.create({ data: { userId: actor?.id, userEmail: actor?.email, action: ActivityAction.CREATE, entity: 'AiProviderConfig', entityId: created.id, description: 'AI provider connection tested and saved', metadata: { provider: created.provider, success: true } as Prisma.InputJsonValue } });
          return created;
        } catch (error) { if ((error as { code?: string })?.code === 'P2002') throw new ConflictException('Provider configuration changed; retry the test'); throw error; }
      }
      const latest = await tx.aiProviderConfig.findUnique({ where: { id: current.id }, select: { configVersion: true } });
      if (!latest || latest.configVersion !== version) throw new BadRequestException('Provider configuration changed; retry the test');
      const updated = await tx.aiProviderConfig.updateMany({ where: { id: current.id, configVersion: version }, data: { provider: dto.provider, model: dto.model, temperature: dto.temperature ?? current.temperature, maxTokens: dto.maxTokens ?? current.maxTokens, isEnabled: dto.isEnabled ?? false, credentialCiphertext: ciphertext, testedConfigHash: this.credentials.fingerprint(dto.candidateApiKey, dto.provider, dto.model), connectionStatus: AiConnectionStatus.CONNECTED, lastTestedAt: testedAt, lastTestOk: true, lastTestErrorCode: null, configVersion: { increment: 1 } } });
      if (updated.count !== 1) throw new ConflictException('Provider configuration changed; retry the test');
      const saved = await tx.aiProviderConfig.findUniqueOrThrow({ where: { id: current.id } });
      await tx.activityLog.create({ data: { userId: actor?.id, userEmail: actor?.email, action: ActivityAction.UPDATE, entity: 'AiProviderConfig', entityId: saved.id, description: 'AI provider connection tested and saved', metadata: { provider: saved.provider, success: true } as Prisma.InputJsonValue } });
      return saved;
    });
    void row;
    return { ok: true, errorCode: null, testedAt, persisted: true };
  }
}

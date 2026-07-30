import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../../infrastructure/database';
import { WhatsappCredentialsService } from '../../../infrastructure/whatsapp/whatsapp-credentials.service';
import { EvolutionApiClient } from '../../../infrastructure/whatsapp/evolution-api.client';
import { EvolutionUrlValidator } from '../../../infrastructure/whatsapp/evolution-url.validator';
import { UpsertWhatsappConfigDto } from './dto/upsert-whatsapp-config.dto';
import { DEFAULT_ORG_ID } from '../../../common/constants';

interface StoredCredentials {
  evolutionApiKey?: string;
  [key: string]: unknown;
}

@Injectable()
export class UpsertWhatsappConfigHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credentials: WhatsappCredentialsService,
    private readonly urlValidator: EvolutionUrlValidator,
    private readonly config: ConfigService,
  ) {}

  async execute(dto: UpsertWhatsappConfigDto) {
    if (dto.provider === 'EVOLUTION_API') {
      if (!dto.evolutionBaseUrl || !dto.evolutionInstanceName) {
        throw new BadRequestException(
          'evolutionBaseUrl and evolutionInstanceName are required for EVOLUTION_API',
        );
      }
    }

    // SSRF + secret-leak defense: validate the URL against the previous origin.
    // When the origin changes we REQUIRE a fresh API key so the previously
    // encrypted key cannot be exfiltrated to an attacker-controlled host.
    const existing = await this.prisma.whatsappAgentConfig.findFirst();
    const validation = await this.urlValidator.validate({
      newBaseUrl: dto.evolutionBaseUrl ?? existing?.evolutionBaseUrl ?? '',
      previousBaseUrl: existing?.evolutionBaseUrl ?? null,
    });

    let stored: StoredCredentials = {};
    if (existing?.credentialsCiphertext) {
      stored = this.credentials.decrypt<StoredCredentials>(
        existing.credentialsCiphertext,
        DEFAULT_ORG_ID,
      );
    }

    if (!validation.sameOriginAsBefore && !dto.evolutionApiKey) {
      throw new BadRequestException(
        'evolutionApiKey is required when changing the Evolution base URL (security: prevents API key reuse against a new origin)',
      );
    }

    const merged: StoredCredentials = {
      evolutionApiKey: dto.evolutionApiKey ?? stored.evolutionApiKey,
    };

    if (!merged.evolutionApiKey) {
      throw new BadRequestException(
        'evolutionApiKey is required (no prior stored key)',
      );
    }

    const encrypted = this.credentials.encrypt(merged, DEFAULT_ORG_ID);

    let webhookSecret = dto.webhookSecret;
    if (!webhookSecret && existing?.webhookSecretEnc) {
      webhookSecret = this.credentials.decrypt<{ webhookSecret?: string }>(
        existing.webhookSecretEnc,
        DEFAULT_ORG_ID,
      ).webhookSecret;
    }
    webhookSecret ??= randomBytes(32).toString('base64url');

    let webhookSecretEnc: string | null | undefined = existing?.webhookSecretEnc;
    if (dto.webhookSecret) {
      webhookSecretEnc = this.credentials.encrypt(
        { webhookSecret: dto.webhookSecret },
        DEFAULT_ORG_ID,
      );
    } else if (!webhookSecretEnc) {
      webhookSecretEnc = this.credentials.encrypt(
        { webhookSecret },
        DEFAULT_ORG_ID,
      );
    }

    const data = {
      provider: dto.provider,
      evolutionBaseUrl: dto.evolutionBaseUrl ?? existing?.evolutionBaseUrl ?? null,
      evolutionInstanceName:
        dto.evolutionInstanceName ?? existing?.evolutionInstanceName ?? null,
      credentialsCiphertext: encrypted,
      webhookSecretEnc: webhookSecretEnc ?? null,
      isActive: dto.isActive ?? true,
    };

    const upserted = existing
      ? await this.prisma.whatsappAgentConfig.update({
          where: { id: existing.id },
          data,
        })
      : await this.prisma.whatsappAgentConfig.create({
          data: { ...data, provider: dto.provider },
        });

    // Verify the connection in the same request so the dashboard can render
    // the result immediately.
    let verified = false;
    let verifiedPhone: string | undefined;
    let verifiedError: string | undefined;
    try {
      const client = new EvolutionApiClient({
        baseUrl: data.evolutionBaseUrl ?? '',
        apiKey: merged.evolutionApiKey!,
        instanceName: data.evolutionInstanceName ?? '',
      });
      const result = await client.verify();
      verified = result.ok;
      verifiedPhone = result.phone;
      verifiedError = result.error;
      if (verified && data.isActive) {
        const publicApiUrl =
          this.config.get<string>('API_PUBLIC_URL') ||
          this.config.get<string>('BACKEND_URL') ||
          'http://localhost:5200';
        const webhookUrl = `${publicApiUrl.replace(/\/$/, '')}/api/v1/public/whatsapp/webhook`;
        await client.setWebhook(webhookUrl, webhookSecret);
      }
    } catch (e: unknown) {
      verifiedError = e instanceof Error ? e.message : 'unknown';
    }

    await this.prisma.whatsappAgentConfig.update({
      where: { id: upserted.id },
      data: {
        lastTestAt: new Date(),
        lastTestOk: verified,
        lastTestError: verified ? null : verifiedError ?? null,
      },
    });

    return {
      configured: true,
      isActive: upserted.isActive,
      verified,
      verifiedPhone,
      verifiedError,
    };
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

@Injectable()
export class ListIntegrationsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute() {
    // SECURITY (P0-11): never return the `config` column over the wire. It
    // contains AES-GCM ciphertext for secrets (apiKey, webhookSecret, etc.).
    // The dashboard form is write-only by design — readers see only
    // (provider, isActive, hasConfig, updatedAt).
    const rows = await this.prisma.integration.findMany({
      where: { isActive: true },
      orderBy: { provider: 'asc' },
      select: { id: true, provider: true, isActive: true, config: true, updatedAt: true, createdAt: true },
    });
    return rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      isActive: r.isActive,
      hasConfig: r.config !== null && r.config !== undefined,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }
}

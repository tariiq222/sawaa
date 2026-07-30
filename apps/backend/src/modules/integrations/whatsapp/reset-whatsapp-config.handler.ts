import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

@Injectable()
export class ResetWhatsappConfigHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute() {
    const existing = await this.prisma.whatsappAgentConfig.findFirst();
    if (!existing) {
      return { reset: false };
    }

    await this.prisma.whatsappAgentConfig.update({
      where: { id: existing.id },
      data: {
        evolutionBaseUrl: null,
        evolutionInstanceName: null,
        credentialsCiphertext: null,
        webhookSecretEnc: null,
        isActive: false,
        isConnected: false,
        connectedPhone: null,
        connectedAt: null,
        disconnectedAt: new Date(),
        lastTestAt: null,
        lastTestOk: null,
        lastTestError: null,
        lastErrorAt: null,
        lastErrorMessage: null,
      },
    });

    return { reset: true };
  }
}

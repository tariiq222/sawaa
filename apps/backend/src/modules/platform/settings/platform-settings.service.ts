import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { decryptSecret, encryptSecret } from './crypto.util';

type PlatformSettingClient = {
  platformSetting: {
    findUnique: (args: { where: { key: string } }) => Promise<{ key: string; value: string } | null>;
    upsert: (args: {
      where: { key: string };
      create: { key: string; value: string; isSecret?: boolean; updatedBy?: string };
      update: { value: string; updatedBy?: string };
    }) => Promise<void>;
  };
};

@Injectable()
export class PlatformSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get<T = unknown>(key: string, envFallback?: string): Promise<T | null> {
    const row = await (this.prisma as unknown as PlatformSettingClient).platformSetting.findUnique({ where: { key } });
    if (row) {
      try {
        const decrypted = decryptSecret(row.value);
        try { return JSON.parse(decrypted) as T; } catch { return decrypted as unknown as T; }
      } catch {
        try { return JSON.parse(row.value) as T; } catch { return row.value as unknown as T; }
      }
    }
    if (envFallback !== undefined) {
      const envVal = process.env[envFallback] ?? envFallback;
      if (envVal) {
        try { return JSON.parse(envVal) as T; } catch { return envVal as unknown as T; }
      }
    }
    return null;
  }

  async set(key: string, value: unknown, actorSub?: string, isSecret = false): Promise<void> {
    const stored = encryptSecret(typeof value === 'string' ? value : JSON.stringify(value));
    await (this.prisma as unknown as PlatformSettingClient).platformSetting.upsert({
      where: { key },
      create: { key, value: stored, isSecret, updatedBy: actorSub },
      update: { value: stored, updatedBy: actorSub },
    });
  }

  invalidate(_key: string): void {
    // No-op — no cache in this implementation (reads are direct DB)
  }
}

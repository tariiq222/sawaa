import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';
import { decryptSecret } from '../crypto.util';

@Injectable()
export class GetPlatformSettingHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(key: string): Promise<{ key: string; value: string } | null> {
    const row = await (this.prisma as unknown as { platformSetting: { findUnique: (args: { where: { key: string } }) => Promise<{ key: string; value: string } | null> } }).platformSetting.findUnique({ where: { key } });
    if (!row) return null;
    try {
      const decrypted = decryptSecret(row.value);
      return { key: row.key, value: decrypted };
    } catch {
      return { key: row.key, value: row.value };
    }
  }
}

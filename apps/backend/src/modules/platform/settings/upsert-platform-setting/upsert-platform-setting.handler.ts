import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';
import { encryptSecret } from '../crypto.util';
import { UpsertPlatformSettingDto } from './upsert-platform-setting.dto';

type PlatformSettingClient = {
  platformSetting: {
    upsert: (args: {
      where: { key: string };
      create: { key: string; value: string; updatedBy: string };
      update: { value: string; updatedBy: string };
    }) => Promise<void>;
  };
};

@Injectable()
export class UpsertPlatformSettingHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: UpsertPlatformSettingDto, actorSub: string): Promise<void> {
    const stored = dto.secret ? encryptSecret(dto.secret) : encryptSecret(dto.value);
    await (this.prisma as unknown as PlatformSettingClient).platformSetting.upsert({
      where: { key: dto.key },
      create: { key: dto.key, value: stored, updatedBy: actorSub },
      update: { value: stored, updatedBy: actorSub },
    });
  }
}

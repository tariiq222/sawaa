import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { BulkUpsertSiteSettingsDto } from './bulk-upsert-site-settings.dto';

@Injectable()
export class BulkUpsertSiteSettingsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTx: RlsTransactionService,
  ) {}

  async execute(dto: BulkUpsertSiteSettingsDto): Promise<{ updated: number }> {
    await this.rlsTx.withTransaction((tx) =>
      Promise.all(dto.entries.map((e) =>
        tx.siteSetting.upsert({
          where: { key: e.key },
          create: {
            key: e.key,
            valueText: e.valueText ?? null,
            valueAr: e.valueAr ?? null,
            valueEn: e.valueEn ?? null,
            valueJson: (e.valueJson ?? Prisma.DbNull) as Prisma.InputJsonValue,
            valueMedia: e.valueMedia ?? null,
          },
          update: {
            valueText: e.valueText ?? null,
            valueAr: e.valueAr ?? null,
            valueEn: e.valueEn ?? null,
            valueJson: (e.valueJson ?? Prisma.DbNull) as Prisma.InputJsonValue,
            valueMedia: e.valueMedia ?? null,
          },
        }),
      )),
    );
    return { updated: dto.entries.length };
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface SiteSettingRow {
  key: string;
  valueText: string | null;
  valueAr: string | null;
  valueEn: string | null;
  valueJson: unknown;
  valueMedia: string | null;
}

@Injectable()
export class ListSiteSettingsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(params?: { prefix?: string }): Promise<SiteSettingRow[]> {
    const where = params?.prefix ? { key: { startsWith: params.prefix } } : {};
    const rows = await this.prisma.siteSetting.findMany({
      where,
      orderBy: { key: 'asc' },
    });
    return rows.map((r) => ({
      key: r.key,
      valueText: r.valueText,
      valueAr: r.valueAr,
      valueEn: r.valueEn,
      valueJson: r.valueJson,
      valueMedia: r.valueMedia,
    }));
  }
}

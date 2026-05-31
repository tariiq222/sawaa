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

/**
 * Key prefixes that are safe to expose on the unauthenticated public surface.
 * Anything outside this allowlist (e.g. internal/ops/integration settings) is
 * never returned when `publicOnly` is set, so private settings cannot leak
 * through the public GET endpoint.
 */
export const PUBLIC_SETTING_PREFIXES = ['home.', 'content.', 'site.'] as const;

function isPublicKey(key: string): boolean {
  return PUBLIC_SETTING_PREFIXES.some((p) => key.startsWith(p));
}

@Injectable()
export class ListSiteSettingsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(params?: {
    prefix?: string;
    publicOnly?: boolean;
  }): Promise<SiteSettingRow[]> {
    const where = params?.prefix ? { key: { startsWith: params.prefix } } : {};
    const rows = await this.prisma.siteSetting.findMany({
      where,
      orderBy: { key: 'asc' },
    });
    const visible = params?.publicOnly
      ? rows.filter((r) => isPublicKey(r.key))
      : rows;
    return visible.map((r) => ({
      key: r.key,
      valueText: r.valueText,
      valueAr: r.valueAr,
      valueEn: r.valueEn,
      valueJson: r.valueJson,
      valueMedia: r.valueMedia,
    }));
  }
}

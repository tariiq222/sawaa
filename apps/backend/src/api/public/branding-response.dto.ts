import { ApiProperty } from '@nestjs/swagger';
import type { PublicBranding } from '@sawaa/shared';

/**
 * Swagger response shape for GET /public/branding.
 *
 * Mirrors the shared `PublicBranding` contract (the single source of truth);
 * `implements PublicBranding` makes the compiler enforce that this DTO never
 * drifts from the type the handler actually returns. Documentation-only —
 * the runtime payload is produced by GetPublicBrandingHandler.
 */
export class PublicBrandingDto implements PublicBranding {
  @ApiProperty({ example: 'مركز سواء', description: 'Organization name (Arabic)' })
  organizationNameAr!: string;

  @ApiProperty({ nullable: true, example: 'Sawa Center', description: 'Organization name (English)' })
  organizationNameEn!: string | null;

  @ApiProperty({ nullable: true, example: 'للاستشارات الأسرية', description: 'Product tagline' })
  productTagline!: string | null;

  @ApiProperty({ nullable: true, example: null, description: 'Logo URL (currently fixed in-app, always null)' })
  logoUrl!: string | null;

  @ApiProperty({ nullable: true, example: null, description: 'Favicon URL (currently fixed in-app, always null)' })
  faviconUrl!: string | null;

  @ApiProperty({ nullable: true, example: '#1f6f5c', description: 'Primary brand color' })
  colorPrimary!: string | null;

  @ApiProperty({ nullable: true, example: '#2f8f78', description: 'Primary color (light variant)' })
  colorPrimaryLight!: string | null;

  @ApiProperty({ nullable: true, example: '#13503f', description: 'Primary color (dark variant)' })
  colorPrimaryDark!: string | null;

  @ApiProperty({ nullable: true, example: '#d8a657', description: 'Accent color' })
  colorAccent!: string | null;

  @ApiProperty({ nullable: true, example: '#b9863f', description: 'Accent color (dark variant)' })
  colorAccentDark!: string | null;

  @ApiProperty({ nullable: true, example: '#f7f5f0', description: 'Background color' })
  colorBackground!: string | null;

  @ApiProperty({ nullable: true, example: 'Handicrafts', description: 'Font family' })
  fontFamily!: string | null;

  @ApiProperty({ nullable: true, example: null, description: 'Font URL (currently fixed in-app, always null)' })
  fontUrl!: string | null;

  @ApiProperty({ enum: ['12h', '24h'], example: '12h', description: 'Display time format preference' })
  timeFormat!: '12h' | '24h';

  @ApiProperty({ nullable: true, example: '+966500000000', description: 'Public contact phone' })
  contactPhone!: string | null;

  @ApiProperty({ nullable: true, example: 'info@sawaa.app', description: 'Public contact email' })
  contactEmail!: string | null;
}

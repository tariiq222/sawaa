export interface SiteSettingRow {
  key: string;
  valueText: string | null;
  valueAr: string | null;
  valueEn: string | null;
  valueJson: unknown;
  valueMedia: string | null;
}

export type SiteSettingsMap = Map<string, SiteSettingRow>;

export interface HeroContent {
  badgeText: string;
  titlePrefix: string;
  titleHighlight: string;
  titleSuffix: string;
  subtitle: string;
  ctaPrimaryText: string;
  ctaPrimaryHref: string;
  ctaSecondaryText: string;
  ctaSecondaryHref: string;
  heroImageUrl: string;
  badgeFloatTopLabel: string;
  badgeFloatTopValue: string;
  badgeFloatBottomLabel: string;
  badgeFloatBottomValue: string;
}

export interface StatsItem {
  num: string;
  label: string;
}

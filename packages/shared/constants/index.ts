export * from "./roles";
export * from "./config";
export * from "./permissions-catalog";

// Tiered feature-gating enum — the single source of truth for billing-gated
// features. Consumed by FeatureGuard (backend), GetMyFeaturesHandler,
// useBillingFeatures + useSidebarNav (dashboard), and the admin Plans tab.
export { FeatureKey } from "./feature-keys";

// Bilingual feature catalog — single source of AR/EN labels, tier, group, kind.
export { FEATURE_CATALOG } from "./feature-catalog";
export type { FeatureCatalogEntry, FeatureGroup } from "./feature-catalog";

export { PLATFORM_BRAND, LEGACY_BRAND_STRINGS } from "./brand";

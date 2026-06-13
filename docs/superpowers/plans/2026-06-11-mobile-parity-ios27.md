# Mobile Parity + iOS 27 Liquid Glass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Sawa mobile app (apps/mobile) to feature parity with the website for clinics, therapists, and support groups, and migrate its chrome to native iOS 26/27 Liquid Glass.

**Architecture:** Phase 1 swaps custom glass chrome for system components (NativeTabs, expo-glass-effect) behind the existing `Glass`/`GlassSurface` abstractions, splits typography (brand font for headings, system font for body), and wires dark mode through `ThemeProvider`. Phase 2 consumes the website's existing public endpoints (`/public/bookings/group-sessions`, `/public/services`, `/public/employees`) from the mobile axios client — the mobile Bearer token is accepted by `ClientSessionGuard` (verified), so no backend changes.

**Tech Stack:** Expo SDK 55, expo-router NativeTabs (`expo-router/unstable-native-tabs`), expo-glass-effect, expo-symbols, TanStack Query v5, Jest (jest-expo).

**Spec:** `docs/superpowers/specs/2026-06-11-mobile-parity-ios27-design.md`

---

## Ground rules for every task

- Repo root: `/Users/tariq/code/sawaa`. Mobile commands run as `pnpm --dir apps/mobile <cmd>` (mobile is NOT in the root workspace filters).
- The working tree already contains unrelated uncommitted changes (backend package.json, website pages, seeds). **Stage only the files your task touched — never `git add -A` or `git add .`**
- Commit messages end with: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- Mobile CLAUDE.md rules apply: no `any`, no hardcoded strings (use i18n), no hex colors in components (use `sawaaColors`/`sawaaTokens`), 350-line max per file, styles use `start`/`end` never `left`/`right` for anything directional.
- After every code change: `pnpm --dir apps/mobile typecheck` must pass before commit.

## File structure (created/modified)

```
apps/mobile/
├── app/(client)/
│   ├── (tabs)/_layout.tsx            MODIFY — NativeTabs
│   ├── (tabs)/home.tsx               MODIFY — route refs + groups section wiring
│   ├── notifications.tsx             MOVE from (tabs)/
│   ├── profile.tsx                   MOVE from (tabs)/
│   ├── clinics.tsx                   CREATE — clinics list screen
│   ├── therapists.tsx                MODIFY — clinicId filter param
│   └── groups/
│       ├── index.tsx                 CREATE — group sessions list
│       └── [id].tsx                  CREATE — group session detail + book
├── components/features/home/
│   ├── FeaturedClinics.tsx           MODIFY — real catalog data
│   ├── SupportSessions.tsx           MODIFY — real group sessions
│   └── HomeTopBar.tsx                MODIFY — route refs
├── lib/clinics.ts                    CREATE — deriveClinics pure function
├── lib/__tests__/clinics.test.ts     CREATE
├── services/client/
│   ├── catalog.ts                    MODIFY — raw catalog + category names
│   ├── employees.ts                  MODIFY — isBookable + serviceIds
│   ├── group-sessions.ts             CREATE
│   ├── __tests__/group-sessions.test.ts  CREATE
│   └── index.ts                      MODIFY — exports
├── hooks/queries/
│   ├── useGroupSessions.ts           CREATE
│   ├── useClinics.ts                 CREATE
│   ├── useTherapists.ts              MODIFY — isBookable filter
│   └── index.ts                      MODIFY — exports
├── theme/
│   ├── fonts.ts                      MODIFY — system body font
│   ├── components/Glass.tsx          MODIFY — expo-glass-effect adapter
│   ├── components/ThemedText.tsx     MODIFY — heading/body font split
│   ├── sawaa/GlassSurface.tsx        MODIFY — expo-glass-effect adapter
│   ├── ThemeProvider.tsx             MODIFY — dark mode
│   └── tokens.ts                     MODIFY — dark palette
├── i18n/ar.json + en.json            MODIFY — groups/clinics keys
packages/shared/
├── catalog/find-department.ts        CREATE (moved from website)
├── catalog/index.ts                  CREATE
├── package.json                      MODIFY — ./catalog export
├── index.ts                          MODIFY — re-export
└── tsconfig.json                     MODIFY — include catalog/
apps/website/features/public-catalog/find-department.ts   MODIFY — re-export from shared
```

---

# Phase 1 — iOS 27 design foundation

### Task 1: Install Liquid Glass dependencies

**Files:**
- Modify: `apps/mobile/package.json` (via expo install)

- [ ] **Step 1: Install**

Run: `cd /Users/tariq/code/sawaa/apps/mobile && npx expo install expo-glass-effect expo-symbols`
Expected: both packages added to dependencies with SDK-55-compatible versions.

- [ ] **Step 2: Verify**

Run: `grep -E "expo-glass-effect|expo-symbols" /Users/tariq/code/sawaa/apps/mobile/package.json`
Expected: two lines.
Run: `pnpm --dir apps/mobile typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
cd /Users/tariq/code/sawaa
git add apps/mobile/package.json pnpm-lock.yaml
git commit -m "chore(mobile): add expo-glass-effect + expo-symbols for Liquid Glass

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 2: Move hidden tab routes out of the tabs group

NativeTabs cannot host hidden-but-routable screens (`hidden` makes a tab non-navigable entirely), so `notifications` and `profile` must become plain stack screens.

**Files:**
- Move: `apps/mobile/app/(client)/(tabs)/notifications.tsx` → `apps/mobile/app/(client)/notifications.tsx`
- Move: `apps/mobile/app/(client)/(tabs)/profile.tsx` → `apps/mobile/app/(client)/profile.tsx`
- Modify: `apps/mobile/app/(client)/(tabs)/home.tsx` (line ~103), `apps/mobile/components/features/home/HomeTopBar.tsx` (lines ~36, ~57), `apps/mobile/app/(client)/(tabs)/_layout.tsx`

- [ ] **Step 1: Move files**

```bash
cd /Users/tariq/code/sawaa
git mv "apps/mobile/app/(client)/(tabs)/notifications.tsx" "apps/mobile/app/(client)/notifications.tsx"
git mv "apps/mobile/app/(client)/(tabs)/profile.tsx" "apps/mobile/app/(client)/profile.tsx"
```

- [ ] **Step 2: Update route references**

In `home.tsx` and `HomeTopBar.tsx` replace `'/(client)/(tabs)/notifications'` → `'/(client)/notifications'` and `'/(client)/(tabs)/profile'` → `'/(client)/profile'`.
In `(tabs)/_layout.tsx` delete the two `<Tabs.Screen ... href: null />` lines for notifications and profile.

- [ ] **Step 3: Verify no stale references**

Run: `grep -rn "(tabs)/notifications\|(tabs)/profile" apps/mobile/app apps/mobile/components`
Expected: no matches.
Run: `pnpm --dir apps/mobile typecheck` — exit 0.

- [ ] **Step 4: Commit**

```bash
git add "apps/mobile/app/(client)/notifications.tsx" "apps/mobile/app/(client)/profile.tsx" "apps/mobile/app/(client)/(tabs)/_layout.tsx" "apps/mobile/app/(client)/(tabs)/home.tsx" apps/mobile/components/features/home/HomeTopBar.tsx
git commit -m "refactor(mobile): move notifications + profile out of tabs group

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 3: Migrate client tab bar to NativeTabs

**Files:**
- Rewrite: `apps/mobile/app/(client)/(tabs)/_layout.tsx`
- Maybe delete: `apps/mobile/components/GlassTabBar.tsx` (only if unreferenced)

- [ ] **Step 1: Rewrite the layout**

Replace the entire file with:

```tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { NativeTabs } from 'expo-router/unstable-native-tabs';

export default function ClientTabsLayout() {
  const { t } = useTranslation();

  return (
    <NativeTabs minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="home">
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
        <NativeTabs.Trigger.Label>{t('tabs.home')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="chat">
        <NativeTabs.Trigger.Icon sf={{ default: 'message', selected: 'message.fill' }} md="chat" />
        <NativeTabs.Trigger.Label>{t('tabs.assistant')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="records">
        <NativeTabs.Trigger.Icon sf={{ default: 'doc.text', selected: 'doc.text.fill' }} md="description" />
        <NativeTabs.Trigger.Label>{t('tabs.records')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="appointments">
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
        <NativeTabs.Trigger.Label>{t('tabs.sessions')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
```

Note: if `minimizeBehavior` fails typecheck, check the exact prop name in `node_modules/expo-router/build/native-tabs/types.d.ts` (`NativeTabsTabBarMinimizeBehavior`) and use the documented one. Do not silence with a cast.

- [ ] **Step 2: Check GlassTabBar usage**

Run: `grep -rn "GlassTabBar" apps/mobile --include="*.tsx" --include="*.ts" | grep -v node_modules`
If the only hits are `components/GlassTabBar.tsx` itself, delete that file. If other screens import it, leave it.

- [ ] **Step 3: Typecheck + manual check**

Run: `pnpm --dir apps/mobile typecheck` — exit 0.
Manual (cannot be automated): on an iOS 26+ simulator the tab bar must render as a floating system Liquid Glass capsule with SF Symbols icons and minimize on scroll. RTL order is mirrored automatically.

- [ ] **Step 4: Commit**

```bash
git add "apps/mobile/app/(client)/(tabs)/_layout.tsx"
git rm -q apps/mobile/components/GlassTabBar.tsx 2>/dev/null || true
git commit -m "feat(mobile): native Liquid Glass tab bar via expo-router NativeTabs

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 4: expo-glass-effect adapter in Glass + GlassSurface

**Files:**
- Modify: `apps/mobile/theme/components/Glass.tsx`
- Modify: `apps/mobile/theme/sawaa/GlassSurface.tsx`

- [ ] **Step 1: Glass.tsx — native glass branch**

Read the full file first. Add imports:

```tsx
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
```

Inside the `Glass` component, after the a11y hooks, add:

```tsx
const useNativeGlass =
  Platform.OS === 'ios' && isLiquidGlassAvailable() && !reduceTransparency;
```

In the `body` JSX, where the iOS `BlurView` + tint + border stack renders today (the `Platform.OS === "web" ? null : (...)` block), branch:

```tsx
{Platform.OS === 'web' ? null : useNativeGlass ? (
  <GlassView
    style={[StyleSheet.absoluteFillObject, { borderRadius: radius }]}
    glassEffectStyle={variant === 'clear' ? 'clear' : 'regular'}
    isInteractive={Boolean(interactive || onPress)}
  />
) : (
  <>
    {/* existing BlurView + tint overlay + border views, unchanged */}
  </>
)}
```

Keep the existing non-native stack byte-identical inside the else branch (it remains the fallback for Android, older iOS, and Reduce Transparency).

- [ ] **Step 2: GlassSurface.tsx — same branch**

Replace the iOS `BlurView` block (lines with `{Platform.OS === 'ios' && (<BlurView .../>)}`) and the gradient with:

```tsx
{Platform.OS === 'ios' && nativeGlass ? (
  <GlassView
    style={StyleSheet.absoluteFill}
    glassEffectStyle={variant === 'soft' ? 'clear' : 'regular'}
    tintColor={isDark ? sawaaColors.glass.darkBg : undefined}
  />
) : (
  <>
    {Platform.OS === 'ios' && (
      <BlurView intensity={intensityMap[variant]} tint={tintMap[variant]} style={StyleSheet.absoluteFill} />
    )}
    <View style={[StyleSheet.absoluteFill, { backgroundColor: fillMap[variant] }]} pointerEvents="none" />
    <LinearGradient ... (existing gradient unchanged) ... />
  </>
)}
```

with `const nativeGlass = isLiquidGlassAvailable();` at the top of the component. When `nativeGlass` is true, skip the white fill + gradient overlays entirely (the system material provides the specular highlight).

- [ ] **Step 3: Typecheck + visual fallback check**

Run: `pnpm --dir apps/mobile typecheck` — exit 0.
Manual: iOS 26+ simulator → cards/surfaces show native glass; toggle Reduce Transparency in simulator a11y settings → surfaces fall back to the opaque tinted style (existing `applyA11y` path).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/theme/components/Glass.tsx apps/mobile/theme/sawaa/GlassSurface.tsx
git commit -m "feat(mobile): adopt native UIGlassEffect with blur fallback in glass surfaces

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 4b: Unified AppIcon (SF Symbols on iOS, Lucide fallback) + concentric radii helper

Covers spec §1.3 and §1.6. Later tasks (10, 12) must use `AppIcon` and `concentricRadius` in their new cards.

**Files:**
- Create: `apps/mobile/components/ui/AppIcon.tsx`
- Modify: `apps/mobile/theme/sawaa/tokens.ts`
- Modify: `apps/mobile/components/features/home/*.tsx` (icon migration)

- [ ] **Step 1: AppIcon component**

`apps/mobile/components/ui/AppIcon.tsx`:

```tsx
import React from 'react';
import { Platform } from 'react-native';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { LucideIcon } from 'lucide-react-native';

interface AppIconProps {
  /** SF Symbol name used on iOS. */
  sf: SymbolViewProps['name'];
  /** Lucide icon rendered on Android/web. */
  fallback: LucideIcon;
  size?: number;
  color: string;
  strokeWidth?: number;
}

export function AppIcon({ sf, fallback: Fallback, size = 20, color, strokeWidth = 1.7 }: AppIconProps) {
  if (Platform.OS === 'ios') {
    return <SymbolView name={sf} tintColor={color} style={{ width: size, height: size }} />;
  }
  return <Fallback size={size} color={color} strokeWidth={strokeWidth} />;
}
```

- [ ] **Step 2: concentricRadius helper**

Append to `apps/mobile/theme/sawaa/tokens.ts`:

```ts
/** iOS 27 concentric radii: a nested rounded element shares the parent's center,
 *  so its radius = outer radius − inset padding (floored at 4). */
export function concentricRadius(outer: number, padding: number): number {
  return Math.max(4, outer - padding);
}
```

- [ ] **Step 3: Migrate home feature icons**

Run: `grep -rn "from 'lucide-react-native'" apps/mobile/components/features/home`
For each decorative icon usage in those files, replace the direct Lucide render with `AppIcon` using this mapping (keep the Lucide import as the `fallback` prop):

| Lucide | SF Symbol |
|---|---|
| `Users` | `person.3.fill` |
| `Building2` | `building.2.fill` |
| `Star` | `star.fill` |
| `Bell` | `bell.fill` |
| `MessageCircle` | `message.fill` |
| `Calendar` | `calendar` |
| `FileText` | `doc.text` |

Example: `<Users size={18} color={c} strokeWidth={1.75} />` → `<AppIcon sf="person.3.fill" fallback={Users} size={18} color={c} strokeWidth={1.75} />`. Icons without a mapping stay Lucide.

- [ ] **Step 4: Typecheck + commit**

Run: `pnpm --dir apps/mobile typecheck` — exit 0.

```bash
git add apps/mobile/components/ui/AppIcon.tsx apps/mobile/theme/sawaa/tokens.ts apps/mobile/components/features/home
git commit -m "feat(mobile): unified AppIcon (SF Symbols/Lucide) + concentric radius helper

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 5: Typography split — brand headings, system body

**Files:**
- Modify: `apps/mobile/theme/fonts.ts`
- Modify: `apps/mobile/theme/components/ThemedText.tsx`
- Sweep: every `f300(`/`f400(`/`f500(`/`f600(` call site

- [ ] **Step 1: fonts.ts**

Add at top: `import { Platform, type TextStyle } from 'react-native';`

```ts
/** System font family — resolves to SF (SF Arabic for ar) on iOS, Roboto on Android. */
export const SYSTEM_FONT = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }) as string;
```

Change `weightMap` so body weights use the system font; headings keep the brand cut:

```ts
const weightMap: Record<Weight, string> = {
  '300': SYSTEM_FONT,
  '400': SYSTEM_FONT,
  '500': SYSTEM_FONT,
  '600': SYSTEM_FONT,
  '700': 'Handicrafts_700Bold',
  '900': 'Handicrafts_900Black',
};

/** Brand (heading) font regardless of weight split — for display text. */
export function getHeadingFont(weight: '600' | '700' | '900' = '700'): string {
  return weight === '900' ? 'Handicrafts_900Black' : weight === '600' ? 'Handicrafts_600SemiBold' : 'Handicrafts_700Bold';
}

/** System fonts encode weight via fontWeight, not family name. Pair with fNNN(). */
export function fontWeightFor(weight: string): TextStyle['fontWeight'] | undefined {
  return weight === '300' || weight === '400' || weight === '500' || weight === '600'
    ? (weight as TextStyle['fontWeight'])
    : undefined;
}
```

Update the doc comment at the top of the file to describe the split (headings = Handicrafts, body = system).

- [ ] **Step 2: ThemedText.tsx**

Heading variants keep the brand font; body variants use the system font. Replace the `fontFamily` computation:

```tsx
import { getHeadingFont, SYSTEM_FONT } from '../fonts';

const HEADING_VARIANTS: ReadonlySet<TextVariant> = new Set(['display', 'displaySm', 'heading', 'subheading']);

const fontFamily = HEADING_VARIANTS.has(variant)
  ? getHeadingFont(variant === 'heading' || variant === 'subheading' ? '600' : '700')
  : SYSTEM_FONT;
```

For heading variants remove `fontWeight` from `variantStyles` (the family encodes it); body variants keep their `fontWeight`.

- [ ] **Step 3: Sweep raw body-weight call sites**

Run: `grep -rn "f[3-6]00(" apps/mobile/app apps/mobile/components --include="*.tsx"`
For every style that uses `fontFamily: fNNN(...)` with N in 3..6, add a sibling `fontWeight: 'N00'` (e.g. `{ fontFamily: f600(locale), fontWeight: '600' }`) so emphasis survives the system-font switch. `f700`/`f900` call sites stay untouched. This is mechanical — do every hit.

- [ ] **Step 4: Typecheck + tests + commit**

Run: `pnpm --dir apps/mobile typecheck` — exit 0.
Run: `pnpm --dir apps/mobile test` — existing theme tests must pass (update snapshots only if a failure is exactly the intended font change).

```bash
git add apps/mobile/theme/fonts.ts apps/mobile/theme/components/ThemedText.tsx
git add -u apps/mobile/app apps/mobile/components
git commit -m "feat(mobile): split typography — brand font for headings, system font for body

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 6: Wire dark mode

**Files:**
- Modify: `apps/mobile/theme/ThemeProvider.tsx`, `apps/mobile/theme/tokens.ts`, `apps/mobile/app/(client)/settings.tsx`

- [ ] **Step 1: ThemeProvider**

```tsx
import { I18nManager, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';
const THEME_MODE_KEY = 'sawaa.themeMode';
```

Inside `ThemeProvider`:

```tsx
const systemScheme = useColorScheme();
const [mode, setMode] = useState<ThemeMode>('system');

useEffect(() => {
  AsyncStorage.getItem(THEME_MODE_KEY).then((v) => {
    if (v === 'light' || v === 'dark' || v === 'system') setMode(v);
  });
}, []);

const scheme: 'light' | 'dark' = mode === 'system' ? (systemScheme ?? 'light') : mode;

const setThemeMode = (next: ThemeMode) => {
  setMode(next);
  void AsyncStorage.setItem(THEME_MODE_KEY, next);
};

const theme = useMemo(() => buildTheme(branding ?? null, scheme), [branding, scheme]);
```

Extend `ThemeContextValue` and the provider value with `{ scheme, mode, setThemeMode }`, and update the default context value (`scheme: 'light', mode: 'system', setThemeMode: () => {}`).

- [ ] **Step 2: tokens.ts dark palette**

`buildTheme` gains a second parameter `scheme: 'light' | 'dark' = 'light'`. Read the file to see the `colors` object it spreads, then add a dark override applied when `scheme === 'dark'`:

```ts
const darkColorOverrides = {
  surface: '#0c2424',
  surfaceElevated: '#11302f',
  background: '#0a1f1e',
  textPrimary: '#e8f4f2',
  textSecondary: '#9fbcba',
  border: 'rgba(255,255,255,0.14)',
} as const;
```

Apply with `colors: { ...colors, ...(scheme === 'dark' ? pickExisting(colors, darkColorOverrides) : {}) }` where `pickExisting` only overrides keys that actually exist in the light `colors` object (write it as a 4-line helper in the same file). Any semantic key not listed above keeps its light value — do not invent more overrides.

- [ ] **Step 3: settings.tsx toggle**

The dark-mode `Switch` (near line 178) currently flips dead local state. Wire it:

```tsx
const { theme, isRTL, language, scheme, setThemeMode } = useTheme();
...
<Switch
  value={scheme === 'dark'}
  onValueChange={(v) => setThemeMode(v ? 'dark' : 'light')}
/>
```

Remove the now-unused local `darkMode` state if present in this screen.

- [ ] **Step 4: Verify + commit**

Run: `pnpm --dir apps/mobile typecheck` — exit 0.
Run: `pnpm --dir apps/mobile test` — theme tests pass (extend `theme/__tests__` with one test: `buildTheme(null, 'dark').colors.textPrimary` differs from light — write it).
Manual: toggle in settings flips surface/text colors and survives an app reload; system mode follows simulator appearance.

```bash
git add apps/mobile/theme/ThemeProvider.tsx apps/mobile/theme/tokens.ts "apps/mobile/app/(client)/settings.tsx" apps/mobile/theme/__tests__
git commit -m "feat(mobile): wire dark mode — system scheme + persisted override

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

Known limitation (accepted in spec): screens that hardcode `sawaaColors.ink.*` directly are not re-themed in this pass; ThemedText/ThemedCard/AquaBackground-driven surfaces are.

---

# Phase 2 — service parity with the website

### Task 7: Move findDepartment to @sawaa/shared

**Files:**
- Create: `packages/shared/catalog/find-department.ts`, `packages/shared/catalog/index.ts`
- Modify: `packages/shared/package.json`, `packages/shared/index.ts`, `packages/shared/tsconfig.json`
- Modify: `apps/website/features/public-catalog/find-department.ts` (becomes a re-export)

- [ ] **Step 1: Create the shared module**

`packages/shared/catalog/find-department.ts`:

```ts
export interface DepartmentKeywords {
  /** Arabic substrings — matches when `nameAr` contains any of them. */
  ar: string[];
  /** English substrings — matches when `nameEn` contains any of them (case-insensitive). */
  en: string[];
}

export interface DepartmentNameLike {
  nameAr: string;
  nameEn?: string | null;
}

/**
 * Finds a department by keyword instead of exact name. Department names differ
 * between environments (e.g. local "عيادات سواء" vs production "عيادات"), so
 * exact-match lookups silently find nothing in one of them.
 */
export function findDepartment<T extends DepartmentNameLike>(
  departments: T[],
  keywords: DepartmentKeywords,
): T | undefined {
  return departments.find((d) => {
    if (keywords.ar.some((kw) => d.nameAr.includes(kw))) return true;
    const nameEn = d.nameEn?.toLowerCase();
    if (!nameEn) return false;
    return keywords.en.some((kw) => nameEn.includes(kw.toLowerCase()));
  });
}
```

`packages/shared/catalog/index.ts`:

```ts
export * from './find-department';
```

- [ ] **Step 2: Wire the package**

- `packages/shared/package.json` → add to `exports`: `"./catalog": { "types": "./dist/catalog/index.d.ts", "default": "./dist/catalog/index.js" }`
- `packages/shared/index.ts` → add `export * from './catalog';`
- `packages/shared/tsconfig.json` → add `"catalog/**/*.ts"` to `include`.

Run: `pnpm --filter=@sawaa/shared build` — exit 0, `dist/catalog/index.js` exists.

- [ ] **Step 3: Re-export from the website**

Replace the body of `apps/website/features/public-catalog/find-department.ts` with:

```ts
export { findDepartment, type DepartmentKeywords } from '@sawaa/shared/catalog';
```

The existing website test (`find-department.test.ts`) keeps importing from `./find-department` and must still pass unchanged.

- [ ] **Step 4: Verify + commit**

Run: `pnpm --filter=@sawaa/website test -- features/public-catalog/find-department.test.ts` — PASS.
Run: `pnpm typecheck` (repo root) — exit 0.

```bash
git add packages/shared/catalog packages/shared/package.json packages/shared/index.ts packages/shared/tsconfig.json apps/website/features/public-catalog/find-department.ts apps/website/features/public-catalog/find-department.test.ts apps/website/features/public-catalog/public.ts
git commit -m "refactor(shared): move findDepartment to @sawaa/shared/catalog for website+mobile reuse

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

(Stage `public.ts` / the test only if they needed touch-ups; both currently exist untracked/modified from the previous session — include them since they are part of this feature.)

### Task 8: Mobile catalog service — expose the raw catalog

**Files:**
- Modify: `apps/mobile/services/client/catalog.ts`

- [ ] **Step 1: Extend types + add getCatalog**

Make the category row public and complete, and expose the raw response (keep `listDepartments` working):

```ts
export interface PublicCatalogCategory {
  id: string;
  departmentId: string | null;
  nameAr: string;
  nameEn: string | null;
  sortOrder: number;
}

export interface PublicCatalogRaw {
  departments: PublicCatalogDepartmentRow[];
  categories: PublicCatalogCategory[];
  services: PublicService[];
}
```

Rename the private `PublicCatalogDepartmentRow` to exported, update `PublicCatalogResponse` to `PublicCatalogRaw`, and add to `publicCatalogService`:

```ts
async getCatalog(): Promise<PublicCatalogRaw> {
  const response = await api.get<PublicCatalogRaw>('/public/services');
  return response.data;
},
```

- [ ] **Step 2: Typecheck + commit**

Run: `pnpm --dir apps/mobile typecheck` — exit 0.

```bash
git add apps/mobile/services/client/catalog.ts
git commit -m "feat(mobile): expose raw public catalog (departments/categories/services)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 9: Therapists parity — isBookable + serviceIds

**Files:**
- Modify: `apps/mobile/services/client/employees.ts`, `apps/mobile/hooks/queries/useTherapists.ts`

- [ ] **Step 1: Extend PublicEmployeeItem**

Add to the interface (backend already returns these — the website filters on them in `apps/website/features/therapists/therapists.api.ts`):

```ts
  serviceIds: string[];
  isBookable: boolean;
```

- [ ] **Step 2: Filter in the list hook**

In `useTherapists`:

```ts
queryFn: async () => {
  const all = await publicEmployeesService.list();
  return all.filter((e) => e.isBookable);
},
```

- [ ] **Step 3: Verify against backend + commit**

Run (backend must be up: `pnpm dev:backend` / docker): `curl -s http://localhost:5200/api/v1/public/employees | head -c 600`
Expected: items contain `"isBookable"` and `"serviceIds"`. If they don't, STOP and report — do not fake the fields.
Run: `pnpm --dir apps/mobile typecheck` — exit 0.

```bash
git add apps/mobile/services/client/employees.ts apps/mobile/hooks/queries/useTherapists.ts
git commit -m "feat(mobile): therapist directory shows bookable therapists only (website parity)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 10: Clinics parity — deriveClinics + real FeaturedClinics + clinics screen

**Files:**
- Create: `apps/mobile/lib/clinics.ts`, `apps/mobile/lib/__tests__/clinics.test.ts`, `apps/mobile/hooks/queries/useClinics.ts`, `apps/mobile/app/(client)/clinics.tsx`
- Modify: `apps/mobile/components/features/home/FeaturedClinics.tsx`, `apps/mobile/app/(client)/therapists.tsx`, `apps/mobile/hooks/queries/index.ts`, `apps/mobile/i18n/ar.json`, `apps/mobile/i18n/en.json`

- [ ] **Step 1: Write the failing test**

`apps/mobile/lib/__tests__/clinics.test.ts`:

```ts
import { deriveClinics } from '../clinics';

const catalog = {
  departments: [
    { id: 'dep-clinics', nameAr: 'عيادات سواء', nameEn: null },
    { id: 'dep-groups', nameAr: 'جلسات جماعية', nameEn: null },
  ],
  categories: [
    { id: 'cat-1', departmentId: 'dep-clinics', nameAr: 'عيادة القلق', nameEn: 'Anxiety Clinic', sortOrder: 2 },
    { id: 'cat-2', departmentId: 'dep-clinics', nameAr: 'عيادة الأسرة', nameEn: null, sortOrder: 1 },
    { id: 'cat-empty', departmentId: 'dep-clinics', nameAr: 'فارغة', nameEn: null, sortOrder: 3 },
    { id: 'cat-other', departmentId: 'dep-groups', nameAr: 'مجموعة', nameEn: null, sortOrder: 1 },
  ],
  services: [
    { id: 'svc-1', categoryId: 'cat-1', nameAr: 'جلسة قلق', nameEn: null, price: 30000, currency: 'SAR' },
    { id: 'svc-2', categoryId: 'cat-2', nameAr: 'جلسة أسرية', nameEn: null, price: 30000, currency: 'SAR' },
    { id: 'svc-3', categoryId: 'cat-other', nameAr: 'جلسة جماعية', nameEn: null, price: 10000, currency: 'SAR' },
  ],
};

const therapists = [
  { id: 'e1', serviceIds: ['svc-1'], isBookable: true },
  { id: 'e2', serviceIds: ['svc-1', 'svc-2'], isBookable: true },
];

describe('deriveClinics', () => {
  it('returns clinic categories sorted by sortOrder with counts, hiding empty ones', () => {
    const clinics = deriveClinics(catalog as never, therapists as never);
    expect(clinics.map((c) => c.id)).toEqual(['cat-2', 'cat-1']);
    expect(clinics[0]).toMatchObject({ nameAr: 'عيادة الأسرة', therapistCount: 1, serviceCount: 1 });
    expect(clinics[1]).toMatchObject({ nameAr: 'عيادة القلق', therapistCount: 2, serviceCount: 1 });
  });

  it('returns [] when no clinics department matches', () => {
    expect(deriveClinics({ departments: [], categories: [], services: [] } as never, [] as never)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it — must fail**

Run: `pnpm --dir apps/mobile test -- lib/__tests__/clinics.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement deriveClinics**

`apps/mobile/lib/clinics.ts` — mirrors `apps/website/themes/sawaa/pages/clinics.tsx` lines 56-84:

```ts
import { findDepartment } from '@sawaa/shared/catalog';
import type { PublicCatalogRaw } from '@/services/client/catalog';
import type { PublicEmployeeItem } from '@/services/client/employees';

export interface ClinicEntry {
  id: string;
  nameAr: string;
  nameEn: string | null;
  therapistCount: number;
  serviceCount: number;
  serviceIds: string[];
}

/** Website-parity clinic derivation: categories of the "عيادات" department that
 *  have at least one service and one bookable therapist. */
export function deriveClinics(
  catalog: PublicCatalogRaw,
  therapists: Pick<PublicEmployeeItem, 'serviceIds' | 'isBookable'>[],
): ClinicEntry[] {
  const clinicsDept = findDepartment(catalog.departments, { ar: ['عيادات'], en: ['clinic'] });
  if (!clinicsDept) return [];
  const bookable = therapists.filter((t) => t.isBookable);

  return catalog.categories
    .filter((c) => c.departmentId === clinicsDept.id)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => {
      const serviceIds = catalog.services.filter((s) => s.categoryId === c.id).map((s) => s.id);
      const serviceIdSet = new Set(serviceIds);
      const therapistCount = bookable.filter((t) => t.serviceIds.some((id) => serviceIdSet.has(id))).length;
      return { id: c.id, nameAr: c.nameAr, nameEn: c.nameEn, therapistCount, serviceCount: serviceIds.length, serviceIds };
    })
    .filter((c) => c.serviceCount > 0 && c.therapistCount > 0);
}
```

- [ ] **Step 4: Run the test — must pass**

Run: `pnpm --dir apps/mobile test -- lib/__tests__/clinics.test.ts` — PASS.

- [ ] **Step 5: useClinics hook**

`apps/mobile/hooks/queries/useClinics.ts`:

```ts
import { useQuery } from '@tanstack/react-query';

import { publicCatalogService } from '@/services/client/catalog';
import { publicEmployeesService } from '@/services/client/employees';
import { deriveClinics, type ClinicEntry } from '@/lib/clinics';

export const clinicKeys = { list: ['clinics', 'list'] as const };

export function useClinics() {
  return useQuery<ClinicEntry[]>({
    queryKey: clinicKeys.list,
    queryFn: async () => {
      const [catalog, employees] = await Promise.all([
        publicCatalogService.getCatalog(),
        publicEmployeesService.list(),
      ]);
      return deriveClinics(catalog, employees);
    },
  });
}
```

Export from `hooks/queries/index.ts` (match the file's existing export style).

- [ ] **Step 6: FeaturedClinics with real data**

Rewrite `components/features/home/FeaturedClinics.tsx`: delete the `CLINICS` mock array; use `useClinics()`; render up to 6 entries with the existing card visuals (LinearGradient icon, Glass card). Name: `dir.isRTL ? c.nameAr : (c.nameEn ?? c.nameAr)`. Meta row shows `c.therapistCount` + i18n key `clinics.therapistsCount`. Card press → `router.push({ pathname: '/(client)/therapists', params: { clinicId: c.id } })`. While loading or when the list is empty, return `null` (the section header stays — acceptable) — actually: export a boolean by rendering nothing; keep it simple and return `null`.

- [ ] **Step 7: Clinics list screen**

`apps/mobile/app/(client)/clinics.tsx` — full-list screen. Mirror the header pattern of `app/(client)/settings.tsx` (back button + title using ThemedText) over `AquaBackground`; body = `FlatList` of `useClinics()` entries, each a `Glass` card (variant "strong", `sawaaRadius.xl`) with name, therapist/service counts, press → therapists with `clinicId`. Empty state: centered ThemedText `clinics.empty`. All strings via i18n keys below.

- [ ] **Step 8: therapists screen filter**

In `app/(client)/therapists.tsx`: read `const { clinicId } = useLocalSearchParams<{ clinicId?: string }>();`, call `useClinics()`, find the matching entry, and when present filter the therapist list to those whose `serviceIds` intersect the clinic's `serviceIds` (build a `Set` once). When `clinicId` is present show the clinic name in the screen title/header area. Follow the screen's existing filtering structure (`therapistsFilter.ts`).

- [ ] **Step 9: Home "see all" link + i18n**

In `home.tsx`, the «العيادات المميزة» section header: replace hardcoded strings with i18n keys and add a "see all" press → `/(client)/clinics` (follow the existing `home.seeAll` key + SectionHeader pattern used elsewhere on the screen).

i18n — `ar.json` add under a new `clinics` object and reuse existing keys where noted:

```json
"clinics": {
  "title": "العيادات",
  "therapistsCount": "{{count}} معالج",
  "servicesCount": "{{count}} خدمة",
  "empty": "لا توجد عيادات متاحة حالياً"
}
```

`en.json`:

```json
"clinics": {
  "title": "Clinics",
  "therapistsCount": "{{count}} therapists",
  "servicesCount": "{{count}} services",
  "empty": "No clinics available right now"
}
```

- [ ] **Step 10: Verify + commit**

Run: `pnpm --dir apps/mobile test -- lib/__tests__/clinics.test.ts` — PASS.
Run: `pnpm --dir apps/mobile typecheck` — exit 0.
Manual: home featured clinics shows real categories; tapping one opens therapists filtered to that clinic.

```bash
git add apps/mobile/lib apps/mobile/hooks/queries/useClinics.ts apps/mobile/hooks/queries/index.ts "apps/mobile/app/(client)/clinics.tsx" "apps/mobile/app/(client)/therapists.tsx" apps/mobile/components/features/home/FeaturedClinics.tsx "apps/mobile/app/(client)/(tabs)/home.tsx" apps/mobile/i18n/ar.json apps/mobile/i18n/en.json
git commit -m "feat(mobile): real clinics from public catalog — list screen + home rail + therapist filter

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 11: Group sessions service + query hooks

**Files:**
- Create: `apps/mobile/services/client/group-sessions.ts`, `apps/mobile/services/client/__tests__/group-sessions.test.ts`, `apps/mobile/hooks/queries/useGroupSessions.ts`
- Modify: `apps/mobile/services/client/index.ts`, `apps/mobile/hooks/queries/index.ts`

- [ ] **Step 1: Write the failing service test**

`apps/mobile/services/client/__tests__/group-sessions.test.ts` — mirror the mocking style of the existing `apps/mobile/services/client/payments.test.ts` (read it first; it mocks `../api`). Test cases:

```ts
import { groupSessionsService } from '../group-sessions';
import api from '../../api';

jest.mock('../../api');
const mockedApi = api as jest.Mocked<typeof api>;

const session = { id: 'g1', title: 'مجموعة القلق', scheduledAt: '2026-07-01T18:00:00.000Z', maxCapacity: 10, enrolledCount: 4, spotsLeft: 6, isFull: false, isWaitlistOnly: false, waitlistEnabled: true, waitlistCount: 0, price: 10000, currency: 'SAR', durationMins: 60, status: 'SCHEDULED', employeeId: 'e1', serviceId: 's1', descriptionAr: null, descriptionEn: null };

describe('groupSessionsService', () => {
  it('list unwraps enveloped responses', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { success: true, data: [session] } } as never);
    await expect(groupSessionsService.list()).resolves.toEqual([session]);
  });

  it('list passes raw array responses through', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [session] } as never);
    await expect(groupSessionsService.list()).resolves.toEqual([session]);
  });

  it('book posts to the book endpoint and unwraps', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { type: 'WAITLISTED', waitlistPosition: 2 } } as never);
    await expect(groupSessionsService.book('g1')).resolves.toEqual({ type: 'WAITLISTED', waitlistPosition: 2 });
    expect(mockedApi.post).toHaveBeenCalledWith('/public/bookings/group-sessions/g1/book');
  });
});
```

Run: `pnpm --dir apps/mobile test -- services/client/__tests__/group-sessions.test.ts` — FAIL (module not found).

- [ ] **Step 2: Implement the service**

`apps/mobile/services/client/group-sessions.ts` — types copied from `apps/website/features/support-groups/support-groups.api.ts` (`SupportGroup`/`BookGroupSessionResponse`); endpoints are the same the website uses, and the mobile Bearer token passes `ClientSessionGuard`:

```ts
import api from '../api';

export interface GroupSession {
  id: string;
  title: string;
  descriptionAr: string | null;
  descriptionEn: string | null;
  scheduledAt: string;
  durationMins: number;
  maxCapacity: number;
  enrolledCount: number;
  price: number;
  currency: string;
  status: string;
  waitlistEnabled: boolean;
  waitlistCount: number;
  employeeId: string;
  serviceId: string;
  spotsLeft: number;
  isFull: boolean;
  isWaitlistOnly: boolean;
}

export interface BookGroupSessionResponse {
  type: 'BOOKED' | 'WAITLISTED';
  bookingId?: string;
  waitlistPosition?: number;
}

/** Public endpoints answer raw or `{ success, data }`-enveloped depending on
 *  interceptors — tolerate both, like the website's `json.data ?? json`. */
function unwrap<T>(body: unknown): T {
  if (body && typeof body === 'object' && 'data' in (body as Record<string, unknown>)) {
    return (body as { data: T }).data;
  }
  return body as T;
}

export const groupSessionsService = {
  async list(branchId?: string): Promise<GroupSession[]> {
    const response = await api.get<unknown>('/public/bookings/group-sessions', {
      params: branchId ? { branchId } : undefined,
    });
    return unwrap<GroupSession[]>(response.data);
  },

  async get(id: string): Promise<GroupSession> {
    const response = await api.get<unknown>(`/public/bookings/group-sessions/${id}`);
    return unwrap<GroupSession>(response.data);
  },

  async book(id: string): Promise<BookGroupSessionResponse> {
    const response = await api.post<unknown>(`/public/bookings/group-sessions/${id}/book`);
    return unwrap<BookGroupSessionResponse>(response.data);
  },
};
```

Export from `services/client/index.ts` following its existing style.

- [ ] **Step 3: Run the test — PASS**

Run: `pnpm --dir apps/mobile test -- services/client/__tests__/group-sessions.test.ts` — PASS.

- [ ] **Step 4: Query hooks**

`apps/mobile/hooks/queries/useGroupSessions.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  groupSessionsService,
  type BookGroupSessionResponse,
  type GroupSession,
} from '@/services/client/group-sessions';

export const groupSessionKeys = {
  all: ['group-sessions'] as const,
  lists: () => [...groupSessionKeys.all, 'list'] as const,
  detail: (id: string) => [...groupSessionKeys.all, 'detail', id] as const,
};

export function useGroupSessions() {
  return useQuery<GroupSession[]>({
    queryKey: groupSessionKeys.lists(),
    queryFn: () => groupSessionsService.list(),
  });
}

export function useGroupSession(id: string | undefined) {
  return useQuery<GroupSession>({
    queryKey: groupSessionKeys.detail(id ?? ''),
    queryFn: () => groupSessionsService.get(id as string),
    enabled: Boolean(id),
  });
}

export function useBookGroupSession() {
  const queryClient = useQueryClient();
  return useMutation<BookGroupSessionResponse, Error, string>({
    mutationFn: (id) => groupSessionsService.book(id),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: groupSessionKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: groupSessionKeys.detail(id) });
    },
  });
}
```

Export all from `hooks/queries/index.ts`.

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm --dir apps/mobile typecheck` — exit 0.

```bash
git add apps/mobile/services/client/group-sessions.ts apps/mobile/services/client/__tests__/group-sessions.test.ts apps/mobile/services/client/index.ts apps/mobile/hooks/queries/useGroupSessions.ts apps/mobile/hooks/queries/index.ts
git commit -m "feat(mobile): group sessions service + query hooks (website public endpoints)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 12: Group screens + real home rail

**Files:**
- Create: `apps/mobile/app/(client)/groups/index.tsx`, `apps/mobile/app/(client)/groups/[id].tsx`
- Modify: `apps/mobile/components/features/home/SupportSessions.tsx`, `apps/mobile/app/(client)/(tabs)/home.tsx`, `apps/mobile/i18n/ar.json`, `apps/mobile/i18n/en.json`

Display rules (mirror the website — read `apps/website/features/support-groups/support-group-card.tsx` before building the cards):
- Money is stored in **halalas** — display `price / 100` with the `home.sar` riyal glyph.
- Date/time: format `scheduledAt` with `Intl.DateTimeFormat(dir.isRTL ? 'ar-SA' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })` (Gregorian: pass `calendar: 'gregory'` for ar-SA).
- States: `isFull && waitlistEnabled` → waitlist badge + CTA «انضم لقائمة الانتظار»; `isFull && !waitlistEnabled` → disabled «مكتمل»; otherwise CTA «انضم» + `spotsLeft` badge.

- [ ] **Step 1: i18n keys**

`ar.json`:

```json
"groups": {
  "title": "مجموعات الدعم",
  "empty": "لا توجد جلسات جماعية متاحة حالياً",
  "spotsLeft": "متبقي {{count}} مقاعد",
  "full": "مكتمل",
  "waitlist": "قائمة انتظار",
  "join": "انضم",
  "joinWaitlist": "انضم لقائمة الانتظار",
  "booked": "تم تسجيلك في المجموعة بنجاح",
  "waitlisted": "تمت إضافتك لقائمة الانتظار — ترتيبك {{position}}",
  "bookError": "تعذر إتمام الانضمام، حاول مرة أخرى",
  "duration": "{{count}} دقيقة",
  "enrolled": "{{count}} / {{max}} مشارك",
  "seeAll": "عرض الكل"
}
```

`en.json`: equivalent English values (`"title": "Support Groups"`, `"booked": "You're in — enrollment confirmed"`, `"waitlisted": "Added to waitlist — position {{position}}"`, etc.).

- [ ] **Step 2: Groups list screen**

`apps/mobile/app/(client)/groups/index.tsx`: AquaBackground + settings.tsx-style header (back chevron + ThemedText title `groups.title`) + `FlatList` over `useGroupSessions()`. Each item: `Glass` card (variant "strong", radius `sawaaRadius.xl`) with title, formatted date/time, `groups.enrolled` line, price, state badge per the display rules, press → `router.push(`/(client)/groups/${item.id}`)`. Loading: `ActivityIndicator`; error: ThemedText `common`-namespace error key if one exists, else `groups.bookError`; empty: `groups.empty`. Use `useDir()` for direction and i18n `t()` for every string; fonts via ThemedText or `f600/f700` helpers (with the Task-5 fontWeight pairing for f600).

- [ ] **Step 3: Group detail screen**

`apps/mobile/app/(client)/groups/[id].tsx`: `useLocalSearchParams<{ id: string }>()` + `useGroupSession(id)`. Layout: AquaBackground, header back, Glass hero card (title, description `dir.isRTL ? descriptionAr : descriptionEn ?? descriptionAr`, date/time, duration, enrolled/capacity, price), `PrimaryButton` CTA wired to `useBookGroupSession()`:

```tsx
const book = useBookGroupSession();
const onJoin = () => {
  book.mutate(id, {
    onSuccess: (res) => {
      if (res.type === 'BOOKED') Alert.alert(t('groups.title'), t('groups.booked'));
      else Alert.alert(t('groups.title'), t('groups.waitlisted', { position: res.waitlistPosition ?? '-' }));
    },
    onError: () => Alert.alert(t('groups.title'), t('groups.bookError')),
  });
};
```

CTA disabled while `book.isPending` or when `isFull && !waitlistEnabled`; label switches between `groups.join` / `groups.joinWaitlist` / `groups.full` per the display rules.

- [ ] **Step 4: Real SupportSessions rail on home**

Rewrite `components/features/home/SupportSessions.tsx`: delete the `SESSIONS` mock; use `useGroupSessions()`; show the first 3 upcoming (`scheduledAt >= now`, sorted ascending); card title = `s.title`, meta = formatted date/time; accent colors: cycle `[sawaaColors.accent.violet, sawaaColors.accent.rose, sawaaColors.teal[500]]` by index. «انضم» press → `router.push(`/(client)/groups/${s.id}`)`. If the list is empty return `null`.
In `home.tsx`: replace the hardcoded «جلسات الدعم» header strings with `t('groups.title')` and add a see-all press → `/(client)/groups` (same pattern as the clinics header from Task 10).

- [ ] **Step 5: Verify + commit**

Run: `pnpm --dir apps/mobile typecheck` — exit 0.
Run: `pnpm --dir apps/mobile test` — all green.
Manual flow (backend + seed required):

```bash
pnpm docker:up
pnpm --filter=backend run seed:group-programs   # seeds "جلسات جماعية" department programs
pnpm dev:backend
```

Then in the simulator: home shows real support sessions → see-all → list → detail → «انضم» books (check booking appears in backend) → on a full session the CTA becomes waitlist.

```bash
git add "apps/mobile/app/(client)/groups" apps/mobile/components/features/home/SupportSessions.tsx "apps/mobile/app/(client)/(tabs)/home.tsx" apps/mobile/i18n/ar.json apps/mobile/i18n/en.json
git commit -m "feat(mobile): support groups — list/detail/enroll + live home rail (website parity)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

### Task 13: Final verification sweep

- [ ] **Step 1: Full checks**

```bash
pnpm --dir apps/mobile typecheck      # exit 0
pnpm --dir apps/mobile test           # all suites pass
pnpm typecheck                        # root turbo — website/shared/api-client
pnpm --filter=@sawaa/website test     # website vitest incl. find-department + support-groups
pnpm --filter=@sawaa/shared build     # dist/catalog emitted
```

- [ ] **Step 2: Manual smoke matrix (simulator)**

| Check | Expected |
|---|---|
| iOS 26+ tab bar | native Liquid Glass capsule, SF icons, minimizes on scroll, RTL order |
| Reduce Transparency ON | glass surfaces fall back to opaque tint |
| Dark mode toggle | flips theme, persists across reload, system mode follows OS |
| Typography | headings = Handicrafts, body = SF Arabic |
| Home rails | real clinics + real group sessions (no mock names like «عيادة النور») |
| Groups flow | list → detail → join → booked/waitlisted states |
| Therapists | only bookable therapists; clinic filter works from clinic card |
| Notifications/profile | still reachable from home top bar |

- [ ] **Step 3: Report**

Report results honestly — any failing check is reported, not papered over. Do not push; pushing deploys production (`sawa-deploy-mechanism`) and stays owner-triggered.

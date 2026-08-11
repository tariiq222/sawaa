# Website Home Luxury Colors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebalance the public homepage into the approved “Luxury Containment” direction with a warm hero-to-features overlap, a dimensional navy/mint/sand palette, and a clearer dark/light section rhythm without changing content or routes.

**Architecture:** Keep the existing Sawaa theme and section order. Add homepage-scoped color and surface hooks in `theme.css`, then consume those hooks from the hero, navbar, features, support-groups, and CTA components. Use real-browser geometry and computed-style assertions for visual TDD, plus a focused component test for the new inverse `SectionHeader` behavior.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind CSS 4 utilities, theme CSS custom properties, Vitest + Testing Library, Playwright/Chromium from the dashboard workspace for local visual verification.

## Global Constraints

- Homepage scope only; booking, auth, and internal pages must not visually change.
- Preserve the existing Arabic/English copy, data flow, routes, image, font, and section order.
- Use palette values exactly: midnight `#071F2C`, deep green `#0E4B43`, mint `#55CCB0`, sand `#D9BE8A`, ivory `#FBF6ED`, white `#FFFFFF`.
- Desktop hero/features overlap is `72px`; mobile overlap is `36px`.
- Do not add dependencies, images, sections, API calls, or generic decorative blobs.
- Keep visible focus states, WCAG AA contrast, and `prefers-reduced-motion` behavior.
- Do not edit `apps/website/features/branding/branding-style.tsx` fixed global variables; homepage roles live under `.theme-sawaa`.
- Preserve unrelated local commits and changes; no push or deploy without a separate explicit decision.

---

### Task 1: Homepage palette, hero, navbar, and feature overlap

**Files:**
- Modify: `apps/website/themes/sawaa/theme.css`
- Modify: `apps/website/themes/sawaa/components/sections/hero.tsx`
- Modify: `apps/website/themes/sawaa/components/sections/features.tsx`
- Modify: `apps/website/themes/sawaa/components/layout/navbar.tsx`

**Interfaces:**
- Consumes: existing `.theme-sawaa` tokens, `HeroContent`, `FeatureCards`, and navbar scroll state.
- Produces: homepage CSS roles `--sw-home-midnight`, `--sw-home-deep-green`, `--sw-home-sand`, `--sw-home-ivory`; hooks `.sw-home-hero-overlay`, `.sw-home-feature-bridge`, `.sw-home-feature-card`, `.sw-home-nav`.

- [ ] **Step 1: Start an isolated website preview on a verified free port**

Run:

```bash
lsof -nP -iTCP:5215 -sTCP:LISTEN
pnpm --filter=@sawaa/website exec next dev --port 5215
```

Expected: the first command prints no listener. Keep the second command running and verify `http://localhost:5215` returns `200`.

- [ ] **Step 2: Run the visual geometry check and verify it fails before implementation**

Run from the repository root:

```bash
pnpm --filter=dashboard exec node - <<'NODE'
const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto('http://localhost:5215', { waitUntil: 'networkidle' });
  const hero = await page.locator('#hero').boundingBox();
  const features = await page.locator('#features').boundingBox();
  const overlap = hero.y + hero.height - features.y;
  console.log({ overlap });
  await browser.close();
  if (overlap < 64 || overlap > 80) process.exit(1);
})();
NODE
```

Expected: FAIL with `overlap: 0`; this proves the current hard section cut is reproduced.

- [ ] **Step 3: Add the homepage palette and surface hooks**

In `.theme-sawaa`, add:

```css
--sw-home-midnight: #071F2C;
--sw-home-deep-green: #0E4B43;
--sw-home-mint: #55CCB0;
--sw-home-sand: #D9BE8A;
--sw-home-ivory: #FBF6ED;
--sw-home-white: #FFFFFF;
```

Add homepage-only rules:

```css
.theme-sawaa .sw-home-hero-overlay {
  background:
    linear-gradient(to top, rgba(7, 31, 44, 0.94) 0%, rgba(7, 31, 44, 0.58) 48%, rgba(7, 31, 44, 0.28) 100%),
    linear-gradient(115deg, rgba(217, 190, 138, 0.10), transparent 45%);
}

.theme-sawaa .sw-home-feature-bridge {
  position: relative;
  z-index: 20;
  margin-top: -72px;
  padding-top: calc(6rem + 72px);
  border-radius: 42px 42px 0 0;
  background: linear-gradient(180deg, #FBF6ED 0%, #FFFDF9 100%);
  border-top: 1px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 -24px 60px -32px rgba(7, 31, 44, 0.42);
}

@media (max-width: 767px) {
  .theme-sawaa .sw-home-feature-bridge {
    margin-top: -36px;
    padding-top: calc(5rem + 36px);
    border-radius: 28px 28px 0 0;
  }
}
```

Add `.sw-home-nav` warm glass colors and `.sw-home-feature-card` shadow/border rules using only the approved palette.

- [ ] **Step 4: Move inline visual styling onto the new hooks**

In `hero.tsx`:

- Add `sw-home-hero-overlay` to the full overlay div and remove its inline `background`.
- Change the badge border to a sand-tinted glass ring.
- Keep the title white and highlight mint.
- Keep the booking link contract unchanged.
- Remove the bottom “discover” anchor and its now-unused `ChevronDown`, locale, and dictionary imports so it cannot collide with the overlap.

In `features.tsx`:

- Change the section class to `sw-home-feature-bridge` and remove `sw-section-cream`.
- Replace the single `TONE` object with a literal three-tone array:

```ts
const TONES: readonly Tone[] = [
  { bg: 'var(--sw-primary-50)', text: 'var(--sw-primary-700)', ring: 'color-mix(in srgb, var(--primary) 18%, transparent)' },
  { bg: 'color-mix(in srgb, var(--sw-home-sand) 24%, white)', text: 'color-mix(in srgb, var(--sw-home-sand) 58%, var(--sw-home-midnight))', ring: 'color-mix(in srgb, var(--sw-home-sand) 25%, transparent)' },
  { bg: 'color-mix(in srgb, var(--sw-home-midnight) 8%, white)', text: 'var(--sw-home-midnight)', ring: 'color-mix(in srgb, var(--sw-home-midnight) 12%, transparent)' },
];
```

- Select `TONES[i % TONES.length]` and add `sw-home-feature-card` to each card.

In `navbar.tsx`:

- Add `sw-home-nav` to the nav.
- Use warm ivory alpha values for unscrolled/scrolled backgrounds.
- Keep all links, focus states, mobile dialog, and auth behavior unchanged.

- [ ] **Step 5: Re-run the visual geometry check**

Run the Step 2 command again.

Expected: PASS with desktop overlap between `64` and `80` pixels.

- [ ] **Step 6: Verify mobile overlap and critical resources**

Run:

```bash
pnpm --filter=dashboard exec node - <<'NODE'
const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const failures = [];
  page.on('requestfailed', request => {
    if (['stylesheet', 'script', 'image', 'font'].includes(request.resourceType())) failures.push(request.url());
  });
  await page.goto('http://localhost:5215', { waitUntil: 'networkidle' });
  const hero = await page.locator('#hero').boundingBox();
  const features = await page.locator('#features').boundingBox();
  const overlap = hero.y + hero.height - features.y;
  console.log({ overlap, failures });
  await browser.close();
  if (overlap < 30 || overlap > 42 || failures.length) process.exit(1);
})();
NODE
```

Expected: PASS with overlap between `30` and `42` pixels and `failures: []`.

- [ ] **Step 7: Run focused website checks**

Run:

```bash
pnpm --filter=@sawaa/website exec vitest run themes/sawaa/components/layout/navbar.test.tsx
pnpm --filter=@sawaa/website typecheck
```

Expected: all navbar tests pass and TypeScript exits `0`.

- [ ] **Step 8: Commit Task 1**

```bash
git add apps/website/themes/sawaa/theme.css \
  apps/website/themes/sawaa/components/sections/hero.tsx \
  apps/website/themes/sawaa/components/sections/features.tsx \
  apps/website/themes/sawaa/components/layout/navbar.tsx
git commit -m "feat(website): add luxury hero and feature overlap"
```

### Task 2: Inverse section-header contract and midnight support-groups section

**Files:**
- Create: `apps/website/themes/sawaa/components/ui/section-header.test.tsx`
- Modify: `apps/website/themes/sawaa/components/ui/section-header.tsx`
- Modify: `apps/website/themes/sawaa/components/sections/support-groups.tsx`
- Modify: `apps/website/themes/sawaa/theme.css`

**Interfaces:**
- Consumes: homepage palette tokens from Task 1.
- Produces: `SectionHeader` prop `tone?: 'default' | 'inverse'` and `.sw-section-midnight` surface for dark homepage sections.

- [ ] **Step 1: Write the failing inverse-header test**

Create `section-header.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { SectionHeader } from './section-header';

describe('SectionHeader', () => {
  it('exposes the inverse tone for headings placed on dark sections', () => {
    render(<SectionHeader tag="مساحة آمنة" title="مجموعات الدعم" subtitle="دعم مهني" tone="inverse" />);
    const wrapper = screen.getByRole('heading', { name: 'مجموعات الدعم' }).parentElement;
    expect(wrapper).toHaveAttribute('data-tone', 'inverse');
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm --filter=@sawaa/website exec vitest run themes/sawaa/components/ui/section-header.test.tsx
```

Expected: FAIL because `tone` is not part of `Props` and no `data-tone` is rendered.

- [ ] **Step 3: Implement the inverse header contract**

Update `SectionHeader`:

```ts
interface Props {
  tag: string;
  tagIcon?: ReactNode;
  title: ReactNode;
  subtitle?: string;
  tone?: 'default' | 'inverse';
}
```

Default `tone` to `default`, add `data-tone={tone}` to the wrapper, and derive tag/heading/subtitle colors from the tone. In inverse mode use white heading text, `var(--sw-secondary-100)` subtitle text, mint tag text, and a translucent white/mint tag surface. Default mode must render exactly as before.

- [ ] **Step 4: Add the midnight section surface**

Add to `theme.css`:

```css
.theme-sawaa .sw-section-midnight {
  position: relative;
  overflow: hidden;
  isolation: isolate;
  background:
    radial-gradient(ellipse 720px 420px at 85% 15%, rgba(85, 204, 176, 0.16), transparent 64%),
    radial-gradient(ellipse 620px 380px at 12% 88%, rgba(217, 190, 138, 0.10), transparent 66%),
    linear-gradient(145deg, #071F2C 0%, #0A2E3F 58%, #0E4B43 100%);
}
```

No continuous animation is added to this dark surface.

- [ ] **Step 5: Apply the inverse surface to support groups**

In `support-groups.tsx`:

- Replace `sw-section-sky` with `sw-section-midnight`.
- Pass `tone="inverse"` to `SectionHeader`.
- Keep cards white/ivory and change their border to translucent white/sand with a larger navy shadow.
- Keep every link, image, label, and locale branch unchanged.

- [ ] **Step 6: Run focused tests and browser contrast checks**

Run:

```bash
pnpm --filter=@sawaa/website exec vitest run themes/sawaa/components/ui/section-header.test.tsx
pnpm --filter=dashboard exec node - <<'NODE'
const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto('http://localhost:5215', { waitUntil: 'networkidle' });
  const section = page.locator('#support-groups');
  const background = await section.evaluate(el => getComputedStyle(el).backgroundImage);
  const heading = await section.getByRole('heading', { level: 2 }).evaluate(el => getComputedStyle(el).color);
  console.log({ background, heading });
  await browser.close();
  if (!background.includes('rgb(7, 31, 44)') || heading !== 'rgb(255, 255, 255)') process.exit(1);
})();
NODE
```

Expected: the Vitest file passes; browser output contains the midnight gradient and a white section heading.

- [ ] **Step 7: Commit Task 2**

```bash
git add apps/website/themes/sawaa/components/ui/section-header.test.tsx \
  apps/website/themes/sawaa/components/ui/section-header.tsx \
  apps/website/themes/sawaa/components/sections/support-groups.tsx \
  apps/website/themes/sawaa/theme.css
git commit -m "feat(website): add midnight support section"
```

### Task 3: Warm section rhythm and premium final CTA

**Files:**
- Modify: `apps/website/themes/sawaa/theme.css`
- Modify: `apps/website/themes/sawaa/components/sections/cta.tsx`

**Interfaces:**
- Consumes: homepage palette and midnight surface from Tasks 1–2.
- Produces: richer `sw-section-cream`, `sw-section-mint`, and `sw-section-sky` backgrounds plus `.sw-home-cta` for the closing conversion section.

- [ ] **Step 1: Record the current section backgrounds as the RED baseline**

Run:

```bash
pnpm --filter=dashboard exec node - <<'NODE'
const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto('http://localhost:5215', { waitUntil: 'networkidle' });
  const result = {};
  for (const id of ['team', 'testimonials', 'blog', 'faq', 'cta']) {
    result[id] = await page.locator(`#${id}`).evaluate(el => getComputedStyle(el).backgroundImage);
  }
  console.log(result);
  await browser.close();
  if (result.cta.includes('rgb(7, 31, 44)')) process.exit(0);
  process.exit(1);
})();
NODE
```

Expected: FAIL because the current CTA section has no midnight background.

- [ ] **Step 2: Rebalance the existing light surfaces**

In `theme.css`:

- Make `sw-section-cream` use an ivory base `#FBF6ED` with sand at 10–14% and mint no higher than 5%.
- Make `sw-section-mint` use a near-white base with mint at 8–10% and a small midnight shadow tone.
- Make `sw-section-sky` a quiet blue-gray reading surface for FAQ only.
- Lower animated-orb opacity and remove any decorative orb that dominates card contrast.
- Add subtle `#D9BE8A` border/shadow depth to `#blog article` and stronger navy quote hierarchy under `#testimonials` without changing markup.

- [ ] **Step 3: Build the final CTA surface**

In `cta.tsx`:

- Add `sw-home-cta` to the section.
- Keep the two CTA cards and content.
- Change the booking card to a deep-green-to-mint gradient with a sand-tinted icon ring.
- Change the app card to midnight with a subtle sand radial highlight.
- Add explicit focus-visible rings to the booking link.
- Preserve the disabled/coming-soon semantics and store labels.

Add to `theme.css`:

```css
.theme-sawaa .sw-home-cta {
  background:
    radial-gradient(ellipse 640px 360px at 82% 18%, rgba(85, 204, 176, 0.14), transparent 66%),
    radial-gradient(ellipse 520px 320px at 15% 88%, rgba(217, 190, 138, 0.10), transparent 68%),
    linear-gradient(145deg, #071F2C 0%, #0A2E3F 60%, #0E4B43 100%);
}
```

- [ ] **Step 4: Re-run the section-background browser check**

Run the Step 1 command again.

Expected: PASS because the CTA computed background contains `rgb(7, 31, 44)`.

- [ ] **Step 5: Check mobile CTA fit**

Use Chromium at `390×844`, scroll `#cta` into view, and assert both CTA cards have `scrollWidth <= clientWidth`; also assert the booking link is visible and focusable.

- [ ] **Step 6: Run package checks**

```bash
pnpm --filter=@sawaa/website test
pnpm --filter=@sawaa/website typecheck
pnpm --filter=@sawaa/website lint
```

Expected: all tests and typecheck pass; lint has no new errors and does not increase the known warning count.

- [ ] **Step 7: Commit Task 3**

```bash
git add apps/website/themes/sawaa/theme.css \
  apps/website/themes/sawaa/components/sections/cta.tsx
git commit -m "feat(website): refine homepage color rhythm"
```

### Task 4: Full visual, accessibility, and production verification

**Files:**
- Modify only if verification exposes a scoped defect in files already named above.

**Interfaces:**
- Consumes: completed homepage design from Tasks 1–3.
- Produces: fresh desktop/mobile screenshots and verification evidence; no new runtime interface.

- [ ] **Step 1: Capture desktop and mobile screenshots**

Capture full-page screenshots at `1440×1000` and `390×844`, plus first-viewport screenshots. Compare against `/tmp/sawaa-home-desktop-current.png` and `/tmp/sawaa-home-mobile-current.png` when those files are available.

Expected visual review:

- Hero transitions into the ivory feature surface by exactly the intended overlap.
- Navbar glass is warm, not gray.
- Feature cards have three distinct tones.
- Support groups form the single dark midpoint.
- CTA closes the page with a deliberate dark surface.
- Arabic text has no clipping or overlap.

- [ ] **Step 2: Run browser layout assertions**

For both viewports assert:

```js
document.documentElement.scrollWidth === document.documentElement.clientWidth
```

Also assert every `h1`, `h2`, primary booking link, and support-group card has a non-zero bounding box, and no critical stylesheet/script/image/font request fails.

- [ ] **Step 3: Run the full website verification gate**

```bash
pnpm --filter=@sawaa/website test
pnpm --filter=@sawaa/website typecheck
pnpm --filter=@sawaa/website lint
pnpm --filter=@sawaa/website build
git diff --check
```

Expected: test suite passes with zero failures; typecheck and build exit `0`; lint has zero errors; `git diff --check` is clean.

- [ ] **Step 4: Review the final diff for scope**

Run:

```bash
git status --short
git diff --stat HEAD~3..HEAD
git diff HEAD~3..HEAD -- apps/website/themes/sawaa
```

Expected: only the approved homepage/theme files and the focused `SectionHeader` test changed. No API, data, booking, auth, migration, or deployment files changed.

- [ ] **Step 5: Commit any verification-only correction**

If Step 1 or Step 2 required a correction, stage only the affected approved files and commit:

```bash
git commit -m "fix(website): polish luxury homepage responsive fit"
```

If no correction was needed, do not create an empty commit.

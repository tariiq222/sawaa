# Mobile UI Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax. The user selected multiple agents; the coordinator reviews this prerequisite batch before parallel screen migration.

**Goal:** توحيد المكونات التي تستهلكها واجهات سواء، ثم هجرة الصفحات دون تغيير رحلة الدفع أو المصادقة.

**Architecture:** طبقة Sawaa الحالية تملك اللون والسطح والخط. تنفيذ زر واحد وأغلفة توافق وقياس إجراءات مشتركة تسبق ثلاث حزم مستقلة للصفحات؛ المنسق يملك الترجمة والصادرات المشتركة والدمج والتحقق النهائي.

**Tech Stack:** Expo 55، React Native 0.83، Expo Router، TypeScript، Jest وReact Native Testing Library.

**Spec:** [المواصفة المعتمدة](../specs/2026-10-07-mobile-ui-unification-design.md).

## Global Constraints

- يبقى اختيار المستخدم للوضع محفوظًا؛ لا نفرض الوضع الداكن على التطبيق.
- تظل رحلة التأكيد الحالية: ملخص ثم اختيار وسيلة الدفع ثم الإجمالي ثم زر المتابعة.
- يبقى `GlassSurface` تنفيذ السطوح المشترك و`Glass` غلاف توافق؛ بطاقات المحتوى تستخدم `material="surface"` المصمت، ولا تتحول إلى زجاج شفاف.
- لا تتغير عقود الخادم أو قواعد الحجز أو التوكنات أو الصلاحيات أو مواعيد أهلية الدفع والإلغاء.
- يظل كل ملف كود ضمن حد 350 سطرًا.
- لا تتضمن المواصفة commit أو push أو merge أو نشرًا أو بناء TestFlight أو تعديل بيانات إنتاجية.
- العمال يحافظون على تعديلات الآخرين ولا ينشئون وكلاء أبناء؛ التشخيص المركّز ينفذ عند طلبه صراحة، والفحص الشامل لدى المنسق بعد الدمج المحلي للدفعة.
- المنسق وحده يكتب `apps/mobile/i18n/` وفهارس الصادرات ووثائق الإصدارات؛ يسلم العمال قائمة المفاتيح المطلوبة إليه.

## Review Focus

1. إجراء طويل أو خط 200 بالمئة: ينمو الزر والملخص والرأس دون قص؛ قبول بصري في Task 5 وTask 8، وليس مقارنة قيمة height في اختبار.
2. ضغط أثناء المعالجة أو غياب onPress: لا ينفذ الإجراء وتعلن حالة busy/disabled؛ Task 2.
3. طلب لون صريح للنص أو خطأ حقل في الفاتح: يحترم اللون ويقرأ الخطأ؛ Task 1 وTask 3.
4. تغير حجم شريط الإجراءات أو حجم القائمة بعد التفاعل: يحجز التمرير ارتفاعًا صحيحًا ويحافظ الأفقي على موضع المستخدم؛ Task 4.
5. اختلاف iOS وAndroid أو غياب بيانات الإصدار: يعرض البناء الصحيح أو علامة عدم توفر، بلا رقم مختلق؛ Task 6.

## ترتيب التنفيذ

بعد مراجعة المالك لهذه الخطط، يطبق المنسق مهارة using-git-worktrees ويفحص المرفقات ليختار مساحة معزولة من المصدر الذي شمله التدقيق. ينقل فقط وثائق هذه المهمة غير المتتبعة إلى المساحة الجديدة؛ يحافظ على وثائق الإصدار المحلية الأخرى. تثبت الاعتماديات من القفل الحالي داخل مساحة التنفيذ، مع تسجيل أي فشل. لا ينشئ commit لنقل العمل بين الحزم؛ تستخدم فروق محددة وتراجع قبل تطبيقها.

Tasks 1–6 هي الأساس. بعد مراجعة فروقه، تعمل [حزمة العميل](2026-10-07-mobile-ui-client.md) و[حزمة الحساب](2026-10-07-mobile-ui-account.md) و[حزمة الموظف](2026-10-07-mobile-ui-employee.md) بالتوازي في موارد كتابة معزولة. Task 7 يدمج الترجمة والمخرجات وTask 8 يتحقق من الدفعة المكتملة.

## Task 1: Semantic Colors and Canonical Typography

**Files:** Modify `apps/mobile/theme/sawaa/tokens.ts`, `apps/mobile/theme/tokens.ts`, `apps/mobile/theme/components/ThemedText.tsx`, `apps/mobile/components/ui/StatusPill.tsx`, `apps/mobile/components/ui/Avatar.tsx`; Test `apps/mobile/theme/sawaa/__tests__/contrast.test.ts`, `apps/mobile/theme/__tests__/arabic-typography.test.tsx`.

**Interfaces:** `getSawaaRoles(scheme)` adds `danger: {fill,foreground}` and `scrim: string`; existing roles remain. `sawaaType` adds action17/24/600 and bodySm13/20/400. ThemedText keeps its existing props, extends nonconflicting React Native TextProps, maps displaySm→heading and label→micro, and honors `style.color > color > role`. Forward native accessibilityRole/accessibilityLiveRegion/accessibilityLabel/testID and remaining TextProps to Text; destructure owned props first and apply controlled style afterwards.

- [ ] Add failing contract tests. Reuse the existing contrast function in its test file; add this case for both appearances:

```tsx
it.each(['light', 'dark'] as const)('danger text is readable in %s', scheme => {
  const { danger } = getSawaaRoles(scheme);
  expect(contrast(danger.fill, danger.foreground)).toBeGreaterThanOrEqual(4.5);
});
```

In the existing typography render harness add:

```tsx
it.each(['bodySm', 'label'] as const)('honors explicit %s color', variant => {
  const view = render(<ThemedText variant={variant} color="rebeccapurple">Explicit</ThemedText>);
  expect(view.getByText('Explicit')).toHaveStyle({ color: 'rebeccapurple' });
});
it('forwards native announcement semantics', () => {
  const view = render(<ThemedText accessibilityRole="alert" accessibilityLiveRegion="polite">Offline</ThemedText>);
  expect(view.getByRole('alert').props.accessibilityLiveRegion).toBe('polite');
});
```

- [ ] Coordinator or expressly assigned foundation worker runs `pnpm --dir apps/mobile exec jest --runInBand --coverage=false theme/sawaa/__tests__/contrast.test.ts theme/__tests__/arabic-typography.test.tsx`. Expected new cases fail before implementation; record actual failure.
- [ ] Add scheme-aware danger fill/foreground from the token palette; scrim derives from backdrop.base with token-layer alpha. Replace ThemedText's local metric table with `sawaaType`, resolve locale/weight using `getFontName`, apply explicit color after role color. Keep legacy theme key names while aliasing radius/spacing equivalents to Sawaa; do not rewrite shared package tokens.

```tsx
const role = variant === 'displaySm' ? 'heading' : variant === 'label' ? 'micro' : variant;
const metric = sawaaType[role];
// Order in the rendered Text style: metric + default ink, explicit color, caller style.
```

- [ ] Use locale font aliases in StatusPill and Avatar without changing their status mapping; rerun the same focused cases, expected pass. Check larger typography in the final visual matrix.

## Task 2: One Action Renderer and Compatibility Wrappers

**Files:** Create `apps/mobile/components/ui/AppButton.tsx`; Modify `apps/mobile/theme/sawaa/PrimaryButton.tsx`, `apps/mobile/components/ui/SecondaryButton.tsx`, `apps/mobile/theme/components/ThemedButton.tsx`, `apps/mobile/components/features/employee/OutlineButton.tsx`, `apps/mobile/components/ui/StateMessage.tsx`, `apps/mobile/components/ui/EmptyState.tsx`; Test Create `apps/mobile/components/ui/__tests__/AppButton.test.tsx`, retain `apps/mobile/theme/__tests__/accessible-controls.test.tsx`.

**Interfaces:** AppButton props are label ReactNode, onPress optional, variant primary/secondary/danger/ghost, size sm/md/lg, disabled/loading/icon/accessibilityLabel/style/minHeight, and `tone?: 'brand'|'neutral'` for secondary actions (default brand). Extend legacy wrappers with optional loading; preserve their current props and neutral outline tone. `height` maps to minHeight, with touch size >=44. Legacy secondary/outline both map to the visible outlined secondary action; danger remains semantically explicit. PrimaryButton preserves an explicit fontFamily by passing its label as a nested Text with that family into AppButton's label node.

- [ ] Add test using the existing primitive harness theme/gradient mocks and locale hook. Test public behavior rather than fixed styles:

```tsx
it('blocks action while busy, then enables it when ready', () => {
  const onPress = jest.fn();
  const view = render(<AppButton label="Continue" loading onPress={onPress} />);
  const button = view.getByRole('button', { name: 'Continue' });
  expect(button).toBeDisabled();
  expect(button.props.accessibilityState.busy).toBe(true);
  fireEvent.press(button);
  expect(onPress).not.toHaveBeenCalled();
  view.rerender(<AppButton label="Continue" onPress={onPress} />);
  fireEvent.press(view.getByRole('button', { name: 'Continue' }));
  expect(onPress).toHaveBeenCalledTimes(1);
});
```

- [ ] Run `pnpm --dir apps/mobile exec jest --runInBand --coverage=false components/ui/__tests__/AppButton.test.tsx theme/__tests__/accessible-controls.test.tsx`, expecting the missing renderer/new busy cases to fail first.
- [ ] Implement one Pressable with semantic roles, translated/accessibly named label, wrapped text, ActivityIndicator, logical icon row and press opacity. Use minimum heights44/56/64 and vertical padding instead of fixed height. Respect reduceMotion for any scale. Keep filled gradient and outlined variant distinct.

```tsx
const inactive = Boolean(disabled || loading || !onPress);
// Pressable: disabled=inactive; onPress=inactive ? undefined : onPress;
// accessibilityState={disabled:inactive,busy:Boolean(loading)}.
// Label remains mounted during loading; icon is replaced by ActivityIndicator.
```

- [ ] Delegate wrappers to AppButton; migrate EmptyState/StateMessage action rendering without changing callback contracts. Secondary tone neutral uses palette.ink[900] foreground and palette.ink[500] border; brand uses palette.teal[700] for both. OutlineButton passes its existing tone to this prop; do not reintroduce a second button renderer. Rerun focused checks; inspect each wrapper's real consumers before changing visual precedence.

## Task 3: Locale-Aware Accessible Input

**Files:** Modify `apps/mobile/components/ui/LabeledInput.tsx`, `apps/mobile/theme/components/ThemedInput.tsx`; Create Test `apps/mobile/components/ui/__tests__/LabeledInput.test.tsx`.

**Interfaces:** Keep label/value/onChangeText/dir and visibility props. Add nonconflicting TextInputProps forwarding, disabled/editable and inputStyle; use inputStyle for LTR email/phone. ThemedInput becomes a compatible field adapter if consumed; leave an unconsumed adapter documented rather than creating another style engine. Parent adds common.showPassword/common.hidePassword translations.

- [ ] Add failing test in a light/dark + mocked locale harness:

```tsx
import { buildDirState } from '@/hooks/useDir';
const dir = buildDirState('en');
it('names the visibility action and announces validation failure', () => {
  const toggle = jest.fn();
  const view = render(<LabeledInput label="Password" value="secret" onChangeText={jest.fn()}
    dir={dir} secureTextEntry showVisibilityToggle isVisible={false}
    onToggleVisibility={toggle} error="Required" />);
  fireEvent.press(view.getByRole('button', { name: 'Show password' }));
  expect(toggle).toHaveBeenCalledTimes(1);
  expect(view.getByText('Required').props.accessibilityLiveRegion).toBe('polite');
});
```

Use the existing exported buildDirState function; mock t to return the two English action labels. Do not invent a production direction helper.

- [ ] Run `pnpm --dir apps/mobile exec jest --runInBand --coverage=false components/ui/__tests__/LabeledInput.test.tsx`; confirm failure reflects current missing naming/live status.
- [ ] Use theme.colors.error for text/border, locale getFontName, focus feedback from roles.focus, 44-point eye target and a meaningful show/hide accessible name/state. Forward input props before controlled value/onChangeText so caller cannot override control ownership. Apply inputStyle after default direction when fields explicitly request LTR.

```tsx
<TextInput {...inputProps} value={value} onChangeText={onChangeText}
  editable={!disabled && inputProps.editable !== false}
  style={[defaultInputStyle, localeDirection, inputStyle]} />
```

- [ ] Rerun focused test, expected pass. Final visual matrix tests long error wrapping, keyboard and native field autofill; unit assertions do not prove geometry.

## Task 4: Footer Measurement and Stable Horizontal Position

**Files:** Modify `apps/mobile/components/ui/FloatingCta.tsx`, `apps/mobile/components/ui/FloatingActionBar.tsx`, `apps/mobile/components/ui/LocalizedHorizontalScroll.tsx`; Test `apps/mobile/components/ui/__tests__/redesign-primitives.test.tsx`; Create Test `apps/mobile/components/ui/__tests__/LocalizedHorizontalScroll.test.tsx`.

**Interfaces:** FloatingCta adds `onHeightChange?: (height:number)=>void`; label its full wrapper with testID `floating-cta`. Existing children-only calls remain valid. FloatingActionBar delegates compatible presentation; any independent offset option remains explicitly adapted. Horizontal scroll starts at the locale edge once per mount or locale change, not every content size change.

- [ ] Add contract test to the existing harness:

```tsx
it('reports changing footer height including its full wrapper', () => {
  const onHeightChange = jest.fn();
  const view = render(<FloatingCta onHeightChange={onHeightChange}><Text>Continue</Text></FloatingCta>);
  fireEvent(view.getByTestId('floating-cta'), 'layout', { nativeEvent: { layout: { width: 320, height: 140, x: 0, y: 0 } } });
  fireEvent(view.getByTestId('floating-cta'), 'layout', { nativeEvent: { layout: { width: 320, height: 200, x: 0, y: 0 } } });
  expect(onHeightChange.mock.calls).toEqual([[140], [200]]);
});
```

Add a ScrollView ref mock exposing scrollTo/scrollToEnd in the horizontal test; trigger contentSizeChange twice. Assert the initialization scroll occurs once, then change locale and assert exactly one new initialization.

- [ ] Run `pnpm --dir apps/mobile exec jest --runInBand --coverage=false components/ui/__tests__/redesign-primitives.test.tsx components/ui/__tests__/LocalizedHorizontalScroll.test.tsx`; expected new height/position cases fail.
- [ ] Forward layout height from FloatingCta's outer wrapper; ignore invalid nonpositive values. Preserve safe area/fade. Track horizontal initialization via ref keyed to locale, retain caller callbacks. Screen lanes reserve measured footer height plus16, with initial180 before first measurement; they do not add bottom inset again after measurement.

```tsx
const [footerHeight, setFooterHeight] = useState(180);
<ScrollView contentContainerStyle={{ paddingBottom: footerHeight + sawaaSpacing.lg }} />
<FloatingCta onHeightChange={setFooterHeight}>{actions}</FloatingCta>
```

- [ ] Rerun focused checks; visually verify one/two wrapped actions, safe-area changes and user-scrolled carousels in Task8.

## Task 5: Adaptive Header, Summary and Selection Primitives

**Files:** Modify `apps/mobile/components/ui/ScreenHeader.tsx`, `apps/mobile/components/ui/SectionHeader.tsx`, `apps/mobile/components/ui/InfoRows.tsx`, `apps/mobile/components/ui/GlassSegmented.tsx`, `apps/mobile/components/ui/EmailVerificationBanner.tsx`, `apps/mobile/theme/components/ThemedCard.tsx`.

**Interfaces:** Existing public props unchanged. The banner retains callbacks but exposes dismiss/resend names, processing and outcomes where currently available. Reduce Motion applies to ThemedCard press effects; shared role/font paths remain authoritative.

- [ ] Capture pre-change component examples with long service/date labels and 200-percent font. Do not add tests that merely assert flexShrink/height values; the acceptance is readable rendering and accessible selection.
- [ ] Use subheading in headers, allow two lines, keep back slot >=44. InfoRows gives icon nonshrinking space, value shrink/wrap/locale alignment and bounded label; use existing stacked layout for dense summaries. Segments have >=44 targets and wrap rather than truncating active label. Use useDir once, locale IBM font and shared AppButton feedback in banner actions. Honor reduceMotion in ThemedCard.

```tsx
// InfoRows value: flexShrink:1, minWidth:0; label and value share available row space.
// Both text nodes carry textAlign/writingDirection from dir; money/IDs keep their natural direction.
// ScreenHeader: numberOfLines={2}; minHeight44, not a fixed text-height cap.
```

- [ ] Reuse current selected-state and back callback tests; coordinator final suite protects existing API. Capture post-change same examples and compare all text/action availability in Task8. Record F03/F08/F09/F11 as visually verified only when observed.

## Task 6: Shared Tabs and Real Build Information

**Files:** Modify `apps/mobile/theme/sawaa/useTabBarStyle.ts`; Create `apps/mobile/lib/app-version.ts`, `apps/mobile/components/features/settings/AboutSection.tsx`; Create Tests `apps/mobile/lib/__tests__/app-version.test.ts`, `apps/mobile/components/features/settings/AboutSection.test.tsx`.

**Interfaces:** useTabBarStyle returns its existing colors plus `labelStyle.fontFamily=getFontName(useDir().locale,'500')`. AboutSection() takes no props and owns locale/Constants display. `getAppVersion(constants: Pick<typeof Constants,'nativeApplicationVersion'|'nativeBuildVersion'|'expoConfig'>, platform?: typeof Platform.OS): {version:string;buildNumber:string}` resolves native first, then platform-specific Expo config, then '—'. Account/employee lanes consume AboutSection only.

- [ ] Add failing pure helper test:

```ts
it('uses Android configured build when native metadata is unavailable', () => {
  const config = { nativeApplicationVersion: null, nativeBuildVersion: null,
    expoConfig: { version: '2.0.0', ios: { buildNumber: '31' }, android: { versionCode: 42 } } };
  expect(getAppVersion(config as Parameters<typeof getAppVersion>[0], 'android'))
    .toEqual({ version: '2.0.0', buildNumber: '42' });
});
```

Also test native metadata outranks configuration and null configuration gives two dashes. AboutSection render test mocks Constants/t and asserts both native fields displayed in AR/EN, without asserting fixed font sizes.

- [ ] Run `pnpm --dir apps/mobile exec jest --runInBand --coverage=false lib/__tests__/app-version.test.ts components/features/settings/AboutSection.test.tsx`; confirm missing modules fail first.
- [ ] Extract existing AboutRow display into AboutSection, keeping SectionHeader and Glass. Remove fabricated version/build fallback; select ios/android config by platform. Publish no new root index unless needed; consumers import exact file. Add hook labelStyle while preserving tint/icon mapping.

```ts
const configuredBuild = platform === 'ios' ? constants.expoConfig?.ios?.buildNumber
  : platform === 'android' ? constants.expoConfig?.android?.versionCode?.toString() : undefined;
return { version: constants.nativeApplicationVersion ?? constants.expoConfig?.version ?? '—',
  buildNumber: constants.nativeBuildVersion ?? configuredBuild ?? '—' };
```

- [ ] Rerun focused tests; compare native tab labels on simulator in final matrix. These producers land before either consumer lane.

## Task 7: Parallel Screen Migration and Translation Integration

**Files:** Three companion plan-owned route/component sets; coordinator owns the verified locale files `apps/mobile/i18n/ar.json` and `apps/mobile/i18n/en.json`. Source paths in each companion plan are authoritative.

**Interfaces:** Freeze AppButton/LabeledInput/FloatingCta/AboutSection/useTabBarStyle contracts above. Account/employee/client workers never write the same product file; parent incorporates their translation key request tables into actual locale resources.

- [ ] Review the foundation diff and focused evidence before dispatch. Pass the accepted spec, all shared API signatures, owned paths and prohibition on mutation logic/full suites. Use isolated mutable resources; no child agents, commits or deployment.
- [ ] Implement the three companion plans in parallel, each with its explicitly requested focused diagnostics. Parent supplies Arabic/English keys early so worker rendered behavior can be tested; no English key literal falls through silently.
- [ ] Apply and inspect each lane's actual diff. Check source routes against the70-file audit; aliases/layouts can remain unchanged when their shared consumer fixes suffice. Every audit finding gets resolved/verification-pending/out-of-scope with evidence and reason.
- [ ] Fix source/CLAUDE documentation of fixed Sawaa palette without changing PublicBranding behavior. Keep dormant video F13/R18-R20 dispositions explicit; do not claim every finding is fixed.

## Task 8: Final Acceptance and Mobile Record

**Files:** Update `docs/mobile-app/audits/2026-10-07-mobile-ui-audit.json`; Create dated `docs/mobile-app/releases/2026-10-07-ui-unification.md`; minimally update `docs/mobile-app/README.md` preserving its unrelated existing edits. Runbook changes only if procedure actually changes.

- [ ] Coordinator installs locked dependencies in the chosen execution workspace with `pnpm --dir apps/mobile install --frozen-lockfile`, checks `git diff` for unintended lock/package changes, then runs the integrated checks below once. Dependency restoration failure is recorded, never hidden by stubs.

```sh
pnpm --dir apps/mobile exec jest --runInBand --coverage=false
pnpm --dir apps/mobile typecheck
pnpm --dir apps/mobile lint
```

- [ ] Classify failure as existing/environment/new regression; repair only scoped causes and rerun affected checks. Inspect actual diff for auth/payment/hook semantics changes. Payment UI modifications receive dashboard smoke plus Moyasar sandbox verification required by project policy; if provider access is unavailable, keep those flows unaccepted and report the concrete blocker.
- [ ] On a freshly bound local app render AR/EN × light/dark × small/large phone, plus 200-percent fonts/keyboard/reduced motion. Use synthetic display data in local fixture memory for unavailable roles/catalog; never change production data or claim fixtures prove provider flows. Verify field error, large summary, result page scroll, native checkout chrome, empty/error/retry, pending button, tabs and cold-link back. Record each observed screen/state; list unrendered routes.
- [ ] One independent Sol6.1 reviewer examines the actual integrated diff and evidence. Preserve manual/device limitations, and write Git state/check commands/screenshots/build-delivery absence in dated release record. No commit/push/merge/deploy/TestFlight is performed without separate authorization.
- [ ] Present changed files, validated improvements and remaining acceptance gaps. Whole-task tokens stay unknown if baselines/participants/final counters are incomplete; do not substitute account allowance for task consumption.

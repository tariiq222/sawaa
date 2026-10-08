# Mobile Account and Auth UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify auth, client account/settings/history/inbox, and guest sign-in prompts without changing identity, permissions, continuations, or request contracts.

**Architecture:** This lane consumes the approved foundation first; then its route changes can run alongside the discovery and employee lanes. Keep local form/controller logic and existing read/mutation hooks in their current files; extract only the reusable auth scaffold and guest prompt. The parent supplies translations, shared exports, AboutSection and final validation.

**Tech Stack:** Expo SDK 55, React Native 0.83, Expo Router, React Hook Form/Zod, TanStack Query, i18next, Jest/jest-expo and React Native Testing Library.

**Spec:** [Approved design](../specs/2026-10-07-mobile-ui-unification-design.md); findings in `docs/mobile-app/audits/2026-10-07-mobile-ui-audit.json`.

## Global Constraints

- النطاق هو العرض والتفاعل المحلي: الثيم، الخطوط، الأزرار، الحقول، البطاقات، رؤوس الصفحات، مساحات التمرير، إظهار التحميل والأخطاء، وإمكانية إعادة المحاولة بالطلبات الموجودة. لا تتغير عقود الخادم أو قواعد الحجز أو التوكنات أو الصلاحيات أو مواعيد أهلية الدفع والإلغاء.
- لا تتضمن المواصفة commit أو push أو merge أو نشرًا أو بناء TestFlight أو تعديل بيانات إنتاجية.
- يبقى `ThemeProvider` المالك الوحيد لوضع العرض، وتظل `getSawaaColors` و`getSawaaRoles` مصدر الألوان.
- يظل `GlassSurface` تنفيذ السطوح المشترك و`Glass` غلاف توافق؛ بطاقات المحتوى تستخدم `material="surface"` المصمت، ولا تتحول إلى زجاج شفاف.
- تظل قيم `sawaaSpacing` و`sawaaRadius` المرجع.
- لا يُعدل اتجاه الجذر أو تتضاعف عملية عكس RTL.
- تستخدم الصفحات `useReduceMotion` الموجود. لا تُؤخر قوائم السجلات الطويلة بتسلسل حركة يجعل الوصول للعناصر المتأخرة بطيئًا. يظل ترتيب البيانات كما وصل من الطلب الحالي.
- المنسق يملك ملفات i18n وفهارس الصادرات المشتركة ووثائق الإصدارات ومراجعة الفروق والتحقق النهائي.
- يظل كل ملف كود ضمن حد 350 سطرًا. العمال يحافظون على تعديلات الآخرين ولا ينشئون وكلاء أبناء؛ التشخيص المركّز ينفذ عند طلبه صراحة، والفحص الشامل لدى المنسق بعد الدمج المحلي للدفعة.
- لا يخلط دليل web أو المحاكي بتجربة جهاز حقيقي.

## Review Focus

1. Small phone at 200% text with the keyboard open: final profile field, error and Save remain reachable (Task 1 visual acceptance on iOS/Android simulator).
2. Native OTP paste/autofill and expired email-entry: retain one four-digit login/register input, six-digit email-entry input, expiry and continuation behavior (Task 2).
3. Summary refetch failure after successful data: preserve integer-halalas formatting and stale values, explain failure and offer read-only retry (Task 3).
4. Long Arabic/English record names and 50 records with Reduce Motion: labels wrap, accessibility names contain service/date/practitioner, and late rows have no entrance delay (Task 3).
5. Pending, failed or unavailable preference/verification/deletion operations: distinguish them from an off preference or success and preserve disabled/request/visibility rules (Tasks 4 and 5).

## Ownership and prerequisite gate

Read `AGENTS.md` and `apps/mobile/CLAUDE.md` before execution. Preserve unrelated dirty release documents. The lane owns only the source/test paths named below; no `_layout.tsx`, auth service/session stores, payment code, translation JSON or release documents. `app/(auth)/register.tsx` remains the existing email-entry re-export.

Consume the foundation's `AppButton` (`label: ReactNode`, `variant: 'primary'|'secondary'|'danger'|'ghost'`, `size: 'sm'|'md'|'lg'`, `disabled`, `loading`, `icon`, `accessibilityLabel`, `style`, `minHeight`, `onPress`); compatibility wrappers retain current props. `LabeledInput` retains `dir` and forwards `TextInputProps` excluding its own conflicting props, adding `inputStyle: StyleProp<TextStyle>` for field-specific LTR/centering. Consume `ThemedText` with explicit-color priority and forwarded RN `TextProps` including accessibilityRole/accessibilityLiveRegion; consume `ScreenHeader`, `Glass`, `EmptyState`, `sawaaType`, and `useReduceMotion` from `@/hooks/useA11y`. The foundation also supplies `AboutSection()` in `components/features/settings/AboutSection.tsx` and semantic danger/scrim roles. No route lane implements these shared contracts.

Review foundation actual diffs and focused results before starting this lane. Within the lane Tasks 1→2 and 1→4 are dependent; Task 3 and Task 5 are independent after foundation; Task 6 depends only on foundation. One account writer owns these tasks in this batch. Every task follows red→minimal change→focused green→diff review; parent performs full Jest/types/lint once after integrating all lanes. Commands below are future execution instructions, not evidence that they ran while planning; do not commit at task boundaries.

### Task 1: Keyboard-safe settings scaffold and profile fields — R04, R09, client R10

**Files:** Modify `apps/mobile/components/features/settings/SettingsScaffold.tsx`, `SettingsProfileSection.tsx`, `apps/mobile/app/(client)/settings-profile.tsx`; extend `SettingsProfileSection.test.tsx`; create `apps/mobile/components/features/settings/SettingsScaffold.test.tsx`.

**Interfaces:** Consume `LabeledInput`, `AppButton`, `goBackOrHome(router, Href): void`. Produce `SettingsScaffold({title, children, keyboardSafe = false}: {title: string; children: ReactNode; keyboardSafe?: boolean})`. Its back callback always uses `/(client)/(tabs)/account`; it does not choose auth or employee destinations.

- [ ] Add tests below to the existing profile suite (its `mockUser`, `mockUpdate`, `baseUser` and RTL theme setup exist). Add `useDir` mock using `buildDirState('ar')`; keep real LabeledInput rather than replacing it with a fake field.

```tsx
it('keeps save unavailable during the existing save request', async () => {
  let finish!: (value: typeof baseUser) => void;
  mockUpdate.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const view = render(<SettingsProfileSection />);
  fireEvent.changeText(view.getByLabelText('settings.fullName'), 'Sara New');
  await act(async () => { fireEvent.press(view.getByText('settings.saveProfile')); });
  expect(view.getByRole('button', { name: 'settings.saveProfile' }).props.accessibilityState).toMatchObject({ busy: true, disabled: true });
  await act(async () => finish(baseUser));
});
```

- [ ] In the new scaffold suite mock router `{back, replace, canGoBack: () => false}`, insets `{top: 24,bottom: 12}`, and AquaBackground as `View`; render `<SettingsScaffold title="Profile" keyboardSafe><Text>Last field</Text></SettingsScaffold>`. Press `a11y.buttonBack` and assert `replace('/(client)/(tabs)/account')` with no `back`; add a history-present case that invokes back and no replace. Run red: `pnpm --dir apps/mobile exec jest --runInBand --coverage=false --runTestsByPath components/features/settings/SettingsScaffold.test.tsx components/features/settings/SettingsProfileSection.test.tsx`; expected failure on new cold-link fallback/busy behavior. Keyboard layout and text direction are visual simulator acceptance, not component-structure/style assertions.
- [ ] Wrap the existing settings ScrollView only when requested, without adding a second bottom inset. Enable `keyboardSafe` only in `settings-profile.tsx`. Keep the schema, readonly-email explanation, canonical response/reset, Haptics and mutation payload intact. Replace all three `Field`/raw-TextInput combinations with Controller-rendered LabeledInput; remove the duplicate Field renderer. Use existing errorText unchanged and `onChangeText={emailReadOnly ? () => undefined : onChange}` for assigned email.

```tsx
const scroll = <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.scroll, { flexGrow: 1, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}>
  <View style={styles.header}><ScreenHeader title={title} onBack={() => goBackOrHome(router, '/(client)/(tabs)/account')} /></View>
  {children}
</ScrollView>;
return <AquaBackground>{keyboardSafe ? <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>{scroll}</KeyboardAvoidingView> : scroll}</AquaBackground>;
// In SettingsProfileSection, after const dir = useDir(), inside phone Controller:
<LabeledInput label={t('settings.phone')} value={value ?? ''} onChangeText={onChange} onBlur={onBlur} error={errorText(errors.phone?.message)} dir={dir} keyboardType="phone-pad" inputStyle={{ writingDirection: 'ltr', textAlign: 'left' }} />
// Replace only the existing save control:
<AppButton label={t('settings.saveProfile')} onPress={onSave} loading={saving} disabled={!isDirty || saving} />
```

- [ ] Run the same focused command green; existing assigned/missing-email and canonical-name tests must still pass. Visual simulator acceptance: on iOS and Android small phone at 200% text, focus last field, show validation error, scroll to and activate Save, dismiss keyboard, and verify no blank double-safe-area tail. Inspect Arabic-name direction and LTR email/phone in both locales. Record platform/device; simulator evidence does not prove physical-device visibility.

### Task 2: Auth forms and scrollable status screens — R06, R08, R09, auth R14

**Files:** Create `apps/mobile/components/features/auth/AuthFormScaffold.tsx` and `AuthFormScaffold.test.tsx`; modify `apps/mobile/app/(auth)/login.tsx`, `review-login.tsx`, `forgot-password.tsx`, `reset-password.tsx`, `otp-verify.tsx`, `suspended.tsx`, `email-entry.tsx`; modify `apps/mobile/components/features/auth/email-entry/EmailForm.tsx`, `CodeForm.tsx`, `PhoneForm.tsx`. Extend `apps/mobile/app/(auth)/__tests__/otp-verify.test.tsx` and `review-login-booking.test.tsx`; create `recovery-ui.test.tsx` there.

**Interfaces:** Consume foundation fields/buttons and Task 1's keyboard pattern. Produce `AuthFormScaffold({children,title,onBack}: {children: ReactNode;title?: string;onBack?: () => void})`, owning AquaBackground→KeyboardAvoidingView→ScrollView, safe padding once and optional ScreenHeader. Caller supplies every back/exit handler; this component never changes redirects, tokens or flow state.

- [ ] Preserve the OTP suite's existing single-field native-autofill assertions below and verification/duplicate-submit/session-supersession tests. In review-login suite use its existing mock router/API to assert email `textContentType="username"`, password `onSubmitEditing` still invokes existing submit, and both fields remain disabled while its request is pending. Create scaffold test with `<AuthFormScaffold title="Code" onBack={back}><Text>Resend</Text></AuthFormScaffold>`; press its back action and assert only the supplied callback is invoked. Scrollability/handled taps/keyboard layout are visual simulator acceptance.

```tsx
it('keeps one native autofill field with its existing code contract', () => {
  const view = render(<OtpVerifyScreen />);
  expect(view.UNSAFE_getAllByType(TextInput)).toHaveLength(1);
  expect(view.getByLabelText('auth.otp.code').props).toMatchObject({ maxLength: 4, textContentType: 'oneTimeCode', autoComplete: 'sms-otp' });
});
```

- [ ] For `recovery-ui.test.tsx`, use the existing auth-suite theme/insets/router mocks, a real i18next instance with ar/en JSON and `DirContext.Provider value={buildDirState(locale)}`. Mock `authService.requestPasswordResetOtp`, `verifyPasswordResetOtp`, `resetClientPassword`; local search params supply `{email:'a@example.com', booking:'preserved', redirect:'/(client)/records'}`. For each locale render ForgotPassword, assert `getByText(resources.auth.forgotPassword.title)`, change the email field to `bad`, press send, and assert localized invalid-email error with zero service calls. Render ResetPassword, enter `'1234'`, press verify and assert `verifyPasswordResetOtp('a@example.com','1234')`; resolve `{sessionToken:'s'}`, submit a seven-character password and assert password-length error with zero reset calls. Test mismatch with eight-character unequal inputs too. Red command: `pnpm --dir apps/mobile exec jest --runInBand --coverage=false --runTestsByPath 'app/(auth)/__tests__/recovery-ui.test.tsx' 'app/(auth)/__tests__/otp-verify.test.tsx' components/features/auth/AuthFormScaffold.test.tsx`.
- [ ] Implement scaffold with `flexGrow:1`, 16-point token page gutter, safe padding, handled taps and Platform keyboard behavior. Migrate outer wrappers and type roles; retain login logo/intro, suspended no-back presentation and every existing auth callback. Use LabeledInput for login/email-entry email, review email/password, recovery fields and PhoneForm; explicit LTR for email/phone/code, locale font for names/password. CodeForm keeps six-character native oneTimeCode field, existing phone-dependent autoComplete and disabled pending/expired behavior. OTP's single overlay input and four visual boxes remain; replace its non-scroll content View with scaffold content, use minHeight for visual boxes and no `allowFontScaling={false}`. Keep registration's re-export untouched.

```tsx
<AuthFormScaffold title={t('auth.review.title')} onBack={() => router.back()}>
  <ThemedText>{t('auth.review.subtitle')}</ThemedText>
  <LabeledInput label={t('auth.email')} value={email} onChangeText={setEmail} dir={dir} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="username" editable={!loading} inputStyle={{ textAlign:'left', writingDirection:'ltr' }} />
  <LabeledInput label={t('auth.password')} value={password} onChangeText={setPassword} dir={dir} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="password" textContentType="password" editable={!loading} onSubmitEditing={submit} />
  <AppButton label={t('auth.review.submit')} loading={loading} disabled={loading || !email.trim() || !password} onPress={submit} />
</AuthFormScaffold>
```

- [ ] Parent merges new keys into the existing `auth.forgotPassword` and `auth.resetPassword` dictionaries; never replaces either dictionary. Reuse forgotPassword `title/subtitle/emailLabel/submit/back/linkLabel` and resetPassword `title/passwordStepSubtitle/codeLabel/newPasswordLabel/verifyCode/submit/success/invalidCode/weakPassword`. Add only forgotPassword `remembered` تذكرت كلمة المرور؟ / Remember your password?; resetPassword `verifyTitle` التحقق من الرمز / Verify code, `newTitle` كلمة مرور جديدة / New password, `confirmPasswordLabel` تأكيد كلمة المرور / Confirm password, `mismatch` كلمتا المرور غير متطابقتين / Passwords do not match, and `failed` تعذر تغيير كلمة المرور / Could not change password. Preserve existing `otpStepSubtitle` key but adjust its AR/EN value to أدخل رمز التحقق المرسل إلى {{email}} / Enter the verification code sent to {{email}}; adjust English forgotPassword.subtitle to Enter your email and we'll send a verification code. These generic labels remove a misleading literal six-digit claim without changing any code rule. Existing auth.email/common.loading keys supply field/loading labels; forgotPassword.back supplies the return action. Replace only copy/styles, leaving reset's current minimum-four code rule, eight-character password rule, sessionToken flow, Alert button continuation and request arguments intact. Use `common.success` for success Alert title after checking existing key; parent merges it if absent.
- [ ] Replace duplicated login/suspended outline actions with AppButton secondary, preserving login's `booking ? null` condition and exact guest replacements. Pass existing loading flags into action `loading`; keep cooldown, consent, retries, purpose, flow.exit and auto-submit unchanged. Green runs include the red command plus `pnpm --dir apps/mobile exec jest --runInBand --coverage=false --runTestsByPath 'app/(auth)/__tests__/review-login-booking.test.tsx' 'app/(auth)/__tests__/login-back.test.tsx' 'app/(auth)/__tests__/suspended-escape.test.tsx' features/auth/email-entry-state.test.ts features/auth/complete-native-session.test.ts`. Native acceptance checks keyboard/200% OTP, expired email-entry and supplied back/exit paths; no real identity account is modified by the UI tests.

### Task 3: Account summary, history and inbox presentation — R05, R07, R13, R15, client R10

**Files:** Modify `apps/mobile/app/(client)/profile.tsx`, `records.tsx`, `notifications.tsx`; extend `apps/mobile/app/(client)/__tests__/profile-summary.test.tsx`, `profile-back.test.tsx`, `records-states.test.tsx`, `notifications-display.test.tsx`, `notifications-back.test.tsx`. Keep existing `app/(client)/(tabs)/account.tsx` wrapper unchanged.

**Interfaces:** Consume `useSummary()`, `useClientBookings({status:'completed',limit:50})`, `useNotifications()` unchanged; consume `goBackOrHome`, `useReduceMotion`, AppButton/EmptyState/ThemedText. Produce only presentation; no new hook or read/write contract.

- [ ] Change profile-summary suite's existing summary mock into mutable `mockSummaryQuery={data:summary,isPending:false,isError:false,refetch:mockRefetch}`. Add tests: undefined+pending displays common.loading and no fabricated amount; undefined+error displays profile.summaryLoadError and retry; `data:summary,isError:true` retains `formatCurrencyAmount(12000,'SAR',true)`, shows error and calls mockRefetch exactly once. Add following history test to its existing fixture setup, with `mockQuery` containing the current b-1 fixture and a long service/name; preserve request params and order assertions.

```tsx
it('exposes record details as a complete navigation action', () => {
  mockQuery = { data: { items: [{ id:'b-1', scheduledAt:'2026-09-01T10:00:00.000Z', deliveryType:'IN_PERSON', employee:{nameAr:'سارة اسم طويل',nameEn:'Sara Long Name'}, service:{nameAr:'إرشاد أسري طويل',nameEn:'Long Family Counseling'} }] }, isPending:false, isError:false };
  const view = render(<RecordsScreen />);
  const row = view.getByRole('button', { name: /سارة اسم طويل.*إرشاد أسري طويل/ });
  fireEvent.press(row);
  expect(mockPush).toHaveBeenCalledWith('/(client)/appointment/b-1');
});
```

- [ ] Extend existing Reanimated test mocks to capture Animated.View `entering` while forwarding remaining View props; mock `@/hooks/useA11y` with mutable `mockReduceMotion`. Render 50 records in response order with true and assert every captured entering value undefined; with false assert the maximum recorded FadeInDown.delay argument ≤240 ms. Apply the same no-entering test to profile and notifications. Keep inbox content/stale-page/filter tests; replace existing formatting assertions (`toHaveStyle`, `numberOfLines`) with AR/EN long-text simulator evidence. Red: `pnpm --dir apps/mobile exec jest --runInBand --coverage=false --runTestsByPath 'app/(client)/__tests__/profile-summary.test.tsx' 'app/(client)/__tests__/records-states.test.tsx' 'app/(client)/__tests__/notifications-display.test.tsx'`.
- [ ] Branch profile stats on pending with no data, error, and actual data independently: skeleton/loading message for first load; neutral em dash for missing lastVisit; error/retry even with stale summary. Retry uses existing summaryQuery.refetch/onRefresh, preserves stale values and money formatting. Move inline summary labels to parent-owned `profile.summarySessions` جلسة / Sessions, `summaryLastVisit` آخر زيارة / Last visit, `summaryOutstanding` مبلغ مستحق / Outstanding, `summaryLoadError` تعذر تحميل ملخص الحساب / Could not load account summary. Keep month/date formatting and data semantics intact. Replace edit control with AppButton ghost size sm, minHeight 44 and existing settings-profile push; tab header stays backless; pushed profile and notifications use explicit client account fallback.

```tsx
const reduceMotion = useReduceMotion();
// All account/inbox/history entrance animations use this decision; cap history delay.
<Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(Math.min(i,6)*40).duration(500)} />
<ScreenHeader title={t('notifications.title')} onBack={() => goBackOrHome(router,'/(client)/(tabs)/account')} />
// In the existing record Pressable:
accessibilityRole="button"
accessibilityLabel={[therapistName, serviceName, formatDate(b.scheduledAt,dir.isRTL), formatTime(b.scheduledAt,dir.isRTL)].filter(Boolean).join('. ')}
```

- [ ] Replace record error/empty blocks with EmptyState and retry AppButton through its foundation implementation. Replace inbox loadMore/retry with AppButton using current loadingMore and callbacks (retry remains loadMore, not a new pagination API); keep loaded cards on loadError. Apply type roles: subtitle/body→body/bodySm; dates/hints→caption; video badge→micro; names→body/subheading; normal titles→heading, with getFontName locale fonts for remaining raw Text. Remove one-line truncation from profile names/stats and record service; use flexShrink/minWidth and wrap dense date rows. Use withAlpha instead of appending hex alpha strings. Green includes the red command and focused profile-back/notifications-back suites; manual 200% checks include a long name, three summary values, 50 records and stale inbox page without changing response ordering.

### Task 4: Preference read states and common About consumer — R11, client half of R17

**Files:** Modify `apps/mobile/app/(client)/settings.tsx` and extend `apps/mobile/app/(client)/__tests__/settings-navigation.test.tsx`. Foundation owns `AboutSection.tsx`, its tests and `lib/app-version.ts`; employee lane owns its About consumer.

**Interfaces:** Consume `usePushPreference(): {query,mutation,clientId}` unchanged and foundation `AboutSection(): ReactElement`. Produce loading/error/retry presentation only; preserve locale storage, server locale sync, restart Alert, theme choice and privacy URL.

- [ ] In existing settings test setup replace hardcoded query mock with `mockPushQuery={data:{enabled:false,permitted:true},isPending:false,isError:false,refetch:jest.fn()}` and return it from usePushPreference; reset between cases. Add behavioral cases, then run red `pnpm --dir apps/mobile exec jest --runInBand --coverage=false --runTestsByPath 'app/(client)/__tests__/settings-navigation.test.tsx'`.

```tsx
it('explains failed preference reading and retries the read only', () => {
  mockPushQuery.isError = true;
  const view = render(<SettingsScreen />);
  expect(view.getByText('settings.pushLoadError')).toBeTruthy();
  expect(view.getByRole('switch',{name:'settings.pushNotifications'}).props.accessibilityState.disabled).toBe(true);
  fireEvent.press(view.getByRole('button',{name:'common.retry'}));
  expect(mockPushQuery.refetch).toHaveBeenCalledTimes(1);
  expect(mockMutatePush).not.toHaveBeenCalled();
});
```

- [ ] Add pending case asserting common.loading and disabled switch, successful off case asserting no load error, and success permitted=false case asserting settings.pushPermissionRequired without automatically requesting permission. Parent copy: `pushLoadError` تعذر تحميل تفضيلات الإشعارات / Could not load notification preferences; `pushPermissionRequired` إذن الإشعارات غير مفعّل على الجهاز / Notification permission is not enabled on this device. Show status below preference row with polite live region; error offers AppButton ghost size sm `onPress={() => void pushPreference.refetch()}`. Keep original disabled expression and permitted/enabled switch calculation, mutation and permission logic. Replace duplicated version/AboutRow implementation with `<AboutSection />`; keep group/layout tokens and shared switch/segmented contracts.

```tsx
{pushPreference.isPending ? <View accessibilityLiveRegion="polite"><ActivityIndicator /><ThemedText>{t('common.loading')}</ThemedText></View> :
 pushPreference.isError ? <View><ThemedText accessibilityRole="alert" color={theme.colors.error}>{t('settings.pushLoadError')}</ThemedText><AppButton label={t('common.retry')} variant="ghost" size="sm" onPress={() => void pushPreference.refetch()} /></View> :
 pushPreference.data?.permitted === false ? <ThemedText accessibilityLiveRegion="polite">{t('settings.pushPermissionRequired')}</ThemedText> : null}
<AboutSection />
```

- [ ] Green same command; existing theme/notification/privacy tests pass, preference retry never calls mutation. Parent foundation tests verify real native version/build fallback precedence in both roles. Native check pending→failure→retry→off/blocked, AR/EN and large text; do not make a real preference write solely to test presentation.

### Task 5: Destructive sheet and email-verification feedback — R01, R16

**Files:** Modify `apps/mobile/components/features/settings/DeleteAccountButton.tsx`, `DeleteAccountButton.test.tsx`, `apps/mobile/components/features/auth/UnverifiedEmailBanner.tsx`; create `apps/mobile/components/features/auth/UnverifiedEmailBanner.test.tsx`.

**Interfaces:** Consume `getSawaaRoles(useTheme().scheme).danger: {fill:string;foreground:string}` and `.scrim: string`, AppButton, ThemedText, useReduceMotion; useRequestEmailVerification unchanged. Backdrop uses roles.scrim directly with no extra alpha; do not assume a theme.colors.scrim field. Produce local banner states and sheet presentation; the account-deletion service, ref guard, modal-closing order and role conditions remain intact.

- [ ] Extend deletion suite only for behavior: cancel/backdrop still issue zero requests, trigger stays disabled/busy during request, and existing duplicate-confirm test remains. Verify danger fill/foreground, modal scrollability and large text visually on the simulator; do not assert AppButton variant, ScrollView structure or height styles. Foundation contrast suite, not a duplicated color algorithm here, proves semantic fill/foreground ≥4.5:1 and dark scrim.
- [ ] New banner test setup mocks useAppSelector to staff user `{role:'EMPLOYEE',emailVerifiedAt:null}`, useRequestEmailVerification to `{mutateAsync:mockSend,isPending:false}`, translation to key and useTheme to existing buildTheme; mock Haptics. Test following failure→retry behavior and separate CLIENT/already-verified absence, pending busy/disabled and success feedback cases. Run red: `pnpm --dir apps/mobile exec jest --runInBand --coverage=false --runTestsByPath components/features/settings/DeleteAccountButton.test.tsx components/features/auth/UnverifiedEmailBanner.test.tsx`.

```tsx
it('announces request failure and allows a retry', async () => {
  mockSend.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
  const view = render(<UnverifiedEmailBanner />);
  await act(async () => fireEvent.press(view.getByRole('button',{name:'settings.sendVerification'})));
  expect(view.getByRole('alert').props.children).toBe('settings.verificationError');
  await act(async () => fireEvent.press(view.getByRole('button',{name:'common.retry'})));
  expect(view.getByText('settings.verificationSent')).toBeTruthy();
  expect(mockSend).toHaveBeenCalledTimes(2);
});
```

- [ ] Delete sheet gets semantic scrim, modal accessibility and internal scroll capped to available height, AppButton danger confirm and secondary cancel, ThemedText locale roles. Reduced motion sets Modal animationType none; use minHeight, wrapping and one safe bottom inset. Preserve `confirm()` closing before request and ref duplicate guard, with busy state visible on trigger. Verification banner retains `if (!user || user.role === 'CLIENT' || user.emailVerifiedAt) return null`; add local `failed`, clear it on retry, set it in catch, and keep existing sent=true success branch. Render localized alert and AppButton ghost size sm using original mutateAsync; pending disables and announces busy, success uses polite live region. Parent key `settings.verificationError` تعذر إرسال رابط التحقق. حاول مرة أخرى / Could not send the verification link. Try again.

```tsx
// In UnverifiedEmailBanner, before its unchanged role guard:
const [failed, setFailed] = useState(false);
const handleSend = async () => {
  setFailed(false);
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  try { await requestVerification.mutateAsync(); setSent(true); }
  catch { setFailed(true); }
};
// In its unsent branch:
{failed && <ThemedText accessibilityRole="alert" color={theme.colors.error}>{t('settings.verificationError')}</ThemedText>}
<AppButton variant="ghost" size="sm" label={t(failed ? 'common.retry' : 'settings.sendVerification')} loading={requestVerification.isPending} disabled={requestVerification.isPending} onPress={handleSend} />
// In the existing delete sheet, preserve confirm/close callbacks:
const { scheme } = useTheme();
const roles = getSawaaRoles(scheme);
// Apply roles.scrim to existing backdrop style, not withAlpha(colors.ink[900],0.45).
<AppButton variant="danger" label={t('profile.deleteAccountAction')} onPress={confirm} disabled={busy} loading={busy} />
<AppButton variant="secondary" label={t('profile.deleteAccountCancel')} onPress={() => setOpen(false)} />
```

- [ ] Green same command; foundation danger contrast tests stay required at integrated gate. Native sheet at 200% on small phone exposes confirm/cancel and correct modal focus; UI tests mock requestAccountDeletion and never delete a live account.

### Task 6: Guest account and appointments prompts — R14

**Files:** Create `apps/mobile/components/features/guest/GuestSignInPrompt.tsx` and `GuestSignInPrompt.test.tsx`; modify `apps/mobile/app/(guest)/guest-account.tsx`, `appointments.tsx`; extend `apps/mobile/app/__tests__/guest-account.test.tsx`. No guest layout edits.

**Interfaces:** Produce `GuestSignInPrompt({title,description,actionLabel,onPress,variant='primary'}: {title?:string;description:string;actionLabel:string;onPress:()=>void;variant?:'primary'|'secondary'})`; consumes Glass/ThemedText/AppButton/useDir, owns no router or auth hook. Guest account passes secondary; appointments passes primary; both retain `router.push('/(auth)/login')`.

- [ ] Create focused real-component test with translation/theme/dir mocks used by existing guest account suite. Render prompt with long description and `variant="secondary"`; press the named button and assert callback once and complete text present. Render primary variant too; existing guest-account test must still show both visitor introduction and appointment prompt and never authenticated account actions. Button size, wrapping and emphasis are visual simulator acceptance. Red: `pnpm --dir apps/mobile exec jest --runInBand --coverage=false --runTestsByPath components/features/guest/GuestSignInPrompt.test.tsx app/__tests__/guest-account.test.tsx`.
- [ ] Implement one surface-card renderer with token radius/gap/padding, locale heading/body and AppButton. Route page gutters become sawaaSpacing.lg (16); card padding/gaps use existing spacing tokens; keep account visitor-introduction card and tab title. The shared appointment prompt renders CalendarDays icon; reuse this exact prompt on both routes without inventing booking/user data.

```tsx
// GuestSignInPrompt's render; colors from useSawaaColors(), dir from useDir():
<Glass variant="strong" radius={sawaaRadius.lg} style={{ padding:sawaaSpacing.lg, gap:sawaaSpacing.md }}>
  <View style={{ flexDirection:dir.row, alignItems:'center', gap:sawaaSpacing.sm }}>
    <CalendarDays size={30} color={colors.teal[700]} />
    {title && <ThemedText variant="subheading" style={{ flex:1, flexShrink:1 }}>{title}</ThemedText>}
  </View>
  <ThemedText variant="body">{description}</ThemedText>
  <AppButton label={actionLabel} variant={variant} onPress={onPress} />
</Glass>
// Guest account consumer:
<GuestSignInPrompt title={t('tabs.myAppointments')} description={t('guest.accountAppointmentsHint')} actionLabel={t('guest.signInForAppointments')} variant="secondary" onPress={() => router.push('/(auth)/login')} />
```

- [ ] Green same command; compare AR/EN light/dark at 200%, long sign-in label and safe tab footer. Actions retain their intentionally different hierarchy; current guest browsing remains accessible.

## Integration acceptance and exclusions

Account lane coverage: R01, R04–R09, R10's visible client settings/profile/notifications portion, R11, R13–R16, and client About consumer for R17. Employee lane owns R02/R03/R12, employee R10/R17 and R21. R18–R20 and video R10 remain latent/out of scope while videoCalls=false; this lane does not enable or refactor video eligibility.

Parent merges translation requests centrally, reviews actual diff/350-line limits, runs the full mobile Jest/types/lint gate from foundation plan once after integration, and records native/device limitations and findings states in dated release/audit documents. Existing auth, email-entry, push/deeplink and account deletion tests are preservation evidence. Manual matrix must name each screen/status AR/EN, light/dark, small/large phone, 200%, keyboard, Reduce Motion and cold-link fallback; unrendered cases stay unverified. No commits, push, deployment or TestFlight are implied. Human reviews all plan files before product implementation begins using the already selected multi-agent method.

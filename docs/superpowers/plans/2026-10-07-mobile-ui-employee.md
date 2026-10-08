# Mobile Employee UI and Native Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify employee presentation, expose recoverable read failures and pending actions, and use the same localized native tabs and actual app version across roles.

**Architecture:** Consume the foundation batch's existing surface implementation and shared button/header/text contracts. Keep employee services, mutations, permissions and route names intact. This lane writes employee screens/components and the three native tab layouts; the coordinator alone writes shared primitives, translations and About/version implementation.

**Tech Stack:** Expo SDK 55, React Native 0.83, Expo Router NativeTabs, TanStack Query v5, react-i18next, React Native Testing Library/Jest.

**Spec:** [Approved design](../specs/2026-10-07-mobile-ui-unification-design.md); [audited evidence](../../mobile-app/audits/2026-10-07-mobile-ui-audit.json), especially R02/R03/R10/R12/R17/R21.

## Global Constraints

- النطاق هو العرض والتفاعل المحلي: الثيم، الخطوط، الأزرار، الحقول، البطاقات، رؤوس الصفحات، مساحات التمرير، إظهار التحميل والأخطاء، وإمكانية إعادة المحاولة بالطلبات الموجودة.
- لا تتغير عقود الخادم أو قواعد الحجز أو التوكنات أو الصلاحيات أو مواعيد أهلية الدفع والإلغاء.
- لا تتضمن المواصفة commit أو push أو merge أو نشرًا أو بناء TestFlight أو تعديل بيانات إنتاجية.
- يبقى `ThemeProvider` المالك الوحيد لوضع العرض، وتظل `getSawaaColors` و`getSawaaRoles` مصدر الألوان.
- يظل `GlassSurface` تنفيذ السطوح المشترك و`Glass` غلاف توافق؛ بطاقات المحتوى تستخدم `material="surface"` المصمت، ولا تتحول إلى زجاج شفاف.
- يظل تباين النص العادي 4.5 إلى 1 على الأقل على سطحه الفعلي، ويُحسب التباين بعد مزج الشفافية.
- تظل قيم `sawaaSpacing` و`sawaaRadius` المرجع.
- يختار `getFontName(locale, weight)` عائلة IBM الملائمة لكل لغة ووزن.
- لا تمنع الأزرار والعناوين القابلة للتمدد تكبير الخط.
- لا يُعدل اتجاه الجذر أو تتضاعف عملية عكس RTL.
- إعادة المحاولة تستدعي refetch أو دالة القراءة الموجودة ولا تكتب بيانات أو تحفظ جدولًا افتراضيًا.
- لا تغير مسارات mutation أو شروط صلاحياتها.
- يظل كل ملف كود ضمن حد 350 سطرًا.
- العمال يحافظون على تعديلات الآخرين ولا ينشئون وكلاء أبناء؛ التشخيص المركّز ينفذ عند طلبه صراحة، والفحص الشامل لدى المنسق بعد الدمج المحلي للدفعة.

The canonical clinic/service contract, fixed encryption AAD and zero-VAT rules remain untouched. R18/R19/R20 and `app/(employee)/video-call.tsx`, `JoinVideoCallButton`, `VideoCallScreen`, and `FEATURE_FLAGS.videoCalls` are deferred: no activation or eligibility/mechanism repairs.

## Review Focus

1. Same-search refetch failure retains valid current-search results with a retry notice; first-read failure has error EmptyState, and previous-search placeholder data is never presented as new-search success (Task 1).
2. Rejected availability read, then successful retry containing multiple windows/exceptions, must prevent editing/saving until success and preserve the exact returned payload (Task 2).
3. Any of four employee mutations pending must block conflicting footer actions, retain eligibility, and recover after request rejection (Task 3).
4. Cold-link back remains behavior-tested; long Arabic names/contact values, 200% text and reduced motion require a native visual matrix proving last-row/footer reachability (Task 4; measured footer behavior test in Task 3).
5. Arabic/English role tabs and missing native version/build metadata must remain localized without changing route order or inventing version `1.0.0` (Task 5).

## Ownership, Interfaces and Execution Gate

- Prerequisite: foundation contracts reviewed and available before this lane runs. No worker edits `theme/`, `components/ui/`, `components/features/employee/OutlineButton.tsx`, i18n, shared exports, AboutSection or `lib/app-version.ts`.
- Consume `AppButton` with `label: ReactNode`, `onPress`, `variant: 'primary'|'secondary'|'danger'|'ghost'`, `size: 'sm'|'md'|'lg'`, `disabled`, `loading`, `icon`, `accessibilityLabel`, `style`, `minHeight`. Existing `PrimaryButton` and `OutlineButton` keep callers and accept optional `loading?: boolean`.
- Consume `FloatingCta({ children, onHeightChange?: (height: number) => void })`: measured height includes gradient and bottom inset; page padding adds only reading gap, never that inset twice.
- Consume `useTabBarStyle()` returning its existing color props plus `labelStyle: { fontFamily: getFontName(dir.locale, '500') }`. This shared hook is coordinator-owned; do not add another role-specific label helper.
- Consume no-props `AboutSection()` from `components/features/settings/AboutSection.tsx`, rendered as `<AboutSection />`; it owns localized about/version display using coordinator-owned `lib/app-version.ts` (`getAppVersion(constants, platform?)`, native first, platform-specific Expo config fallback, `—` when unknown).
- Coordinator translation requests: `doctor.clientsLoadFailed`, `doctor.clientsLoadFailedHint`, `availability.loadError`, `availability.loadErrorHint`; use existing `common.retry`, `availability.save`, doctor action labels and AboutSection keys.
- Owned production paths: `app/(employee)/(tabs)/{clients,today,calendar,profile}.tsx`, `app/(employee)/{availability,appointment/[id],client/[id]}.tsx`, `components/features/employee/{AppointmentClientCard,EmployeeAppointmentCard,WeekStrip}.tsx`, `components/features/employee-appointment-styles.ts`, and the three tab layouts in Task 5. Auth/client-account/guest prompt routes belong to the account lane.
- Owned tests are listed below. No product edits during planning. At execution write failing tests first; a worker runs only a task's listed focused command when explicitly dispatched to do so. Coordinator runs final integrated checks once. No commits without separate authorization.

### Task 1: Distinguish employee clients failure, retry and successful empty

**Files:** Modify `apps/mobile/app/(employee)/(tabs)/clients.tsx`; create `apps/mobile/app/(employee)/(tabs)/__tests__/clients-load-failure.test.tsx`.
**Interfaces:** Consume `useEmployeeClients({ search: debouncedSearch })` unchanged, including `isError`/`isFetching`/`isPlaceholderData`/`refetch`. Produce visible first-read error, retained valid current-search results after refetch failure, and same-search retry; no service/hook signature changes.

- [ ] Write the new test using the actual QueryClientProvider and `useEmployeeClients`. Mock `clientsService.getAll` at `@/services/clients`; reuse the complete theme/router/reanimated/safe-area mock declarations from `today-load-failure.test.tsx`, replacing only the today query mock with the service mock. Use an independent QueryClient `{ queries: { retry: false, gcTime: 0 } }` per test and i18n English for this test:
```tsx
const mockGetAll = jest.fn();
jest.mock('@/services/clients', () => ({ clientsService: { getAll: (...args: unknown[]) => mockGetAll(...args) } }));
it('retries the failed search without rendering success-empty copy', async () => {
  await act(async () => { await i18n.changeLanguage('en'); });
  mockGetAll.mockResolvedValueOnce({ data: [] }).mockRejectedValueOnce(new Error('offline'));
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const view = render(<QueryClientProvider client={queryClient}><ClientsScreen /></QueryClientProvider>);
  await waitFor(() => expect(view.getByText(i18n.t('doctor.noClients'))).toBeTruthy());
  fireEvent.changeText(view.getByPlaceholderText(i18n.t('doctor.searchClients')), 'Nora');
  await waitFor(() => expect(view.getByText(i18n.t('doctor.clientsLoadFailed'))).toBeTruthy());
  expect(view.queryByText(i18n.t('common.noResults'))).toBeNull();
  mockGetAll.mockResolvedValueOnce({ data: [] });
  fireEvent.press(view.getByText(i18n.t('common.retry')));
  await waitFor(() => expect(view.getByText(i18n.t('common.noResults'))).toBeTruthy());
  expect(mockGetAll).toHaveBeenLastCalledWith({ search: 'Nora', limit: 50 });
});
```
- [ ] Add the distinct same-search refetch contract test below, importing `employeeClientsKeys` from `@/hooks/queries/useEmployeeClients`. Mock source objects must use the current `ClientRecord` shape; this minimal service mock supplies the fields mapped by the screen:
```tsx
it('retains current-search results after refetch fails and retries the same key', async () => {
  mockGetAll.mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce({ data: [{ id: 'nora', name: 'Nora', avatarUrl: null }] });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const view = render(<QueryClientProvider client={queryClient}><ClientsScreen /></QueryClientProvider>);
  await waitFor(() => expect(view.getByText(i18n.t('doctor.noClients'))).toBeTruthy());
  fireEvent.changeText(view.getByPlaceholderText(i18n.t('doctor.searchClients')), 'Nora');
  await waitFor(() => expect(view.getByText('Nora')).toBeTruthy());
  mockGetAll.mockRejectedValueOnce(new Error('offline'));
  await act(async () => { await queryClient.invalidateQueries({ queryKey: employeeClientsKeys.list('Nora', 50) }); });
  await waitFor(() => expect(view.getByText(i18n.t('doctor.clientsLoadFailed'))).toBeTruthy());
  expect(view.getByText('Nora')).toBeTruthy();
  expect(view.queryByText(i18n.t('common.noResults'))).toBeNull();
  mockGetAll.mockResolvedValueOnce({ data: [{ id: 'nora', name: 'Nora', avatarUrl: null }] });
  fireEvent.press(view.getByText(i18n.t('common.retry')));
  await waitFor(() => expect(view.queryByText(i18n.t('doctor.clientsLoadFailed'))).toBeNull());
  expect(view.getByText('Nora')).toBeTruthy();
  expect(mockGetAll).toHaveBeenLastCalledWith({ search: 'Nora', limit: 50 });
});
```
- [ ] Add a changed-search test: initial successful `Nora` results, change text to `Omar`, keep the new read unresolved and assert Nora is not shown as current results; reject it and assert error EmptyState without Nora/noResults. Retry must call `{ search: 'Omar', limit: 50 }`; resolve with Omar and assert only Omar. Add first-read failure with no data, successful empty initial load, successful empty search, and same-search refetch failure after successful empty data. Keep the existing query keys, request parameters and 400ms debounce.
- [ ] Focused red command: `pnpm --dir apps/mobile exec jest --runInBand --coverage=false --runTestsByPath 'app/(employee)/(tabs)/__tests__/clients-load-failure.test.tsx'`. Expected pre-change failure: error/retry copy absent. Fix only after observing that failure.
- [ ] Use query-owned current-search data separately from TanStack `keepPreviousData` placeholders. `data !== undefined && !isPlaceholderData` means the current key has a valid response, including `[]`; do not blanket clear the list on `isError`. With current-key data, render a persistent retry notice above the retained list/valid empty result. With no current-key data, render error EmptyState; during a new-search placeholder read show loading, not previous-search results or successful empty copy:
```tsx
const { data, isLoading, isFetching, isError, isPlaceholderData, refetch } = useEmployeeClients({ search: debouncedSearch });
const hasCurrentData = data !== undefined && !isPlaceholderData;
const displayedClients = hasCurrentData ? clients : [];
const retry = () => { void refetch(); };
const firstReadError = isError && !hasCurrentData;
const retainedReadError = isError && hasCurrentData;
const showLoading = !hasCurrentData && (isLoading || isFetching || isPlaceholderData);
// Above FlatList; leave displayedClients intact when the same query refetch fails:
{retainedReadError && <View accessibilityRole="alert">
  <Text>{t('doctor.clientsLoadFailed')}</Text>
  <AppButton variant="ghost" size="sm" label={t('common.retry')} onPress={retry} />
</View>}
// FlatList receives displayedClients; precedence for ListEmptyComponent:
// showLoading => existing skeletons; firstReadError => error EmptyState;
// hasCurrentData => existing successful noClients/noResults; otherwise no success copy.
```
- [ ] For first-read error use existing `EmptyState` with `cloud-offline-outline`, `tone="danger"`, the two doctor load-error keys and `common.retry` calling the same `refetch`. Apply theme/localized text styles to the retry notice through foundation contracts; do not change services, search parameters or debounce.
- [ ] Run the same command: PASS for first-read failure, retained current-search results on refetch failure, changed-search placeholder isolation, retry recovery and genuine empty. Review that no service or authorization change entered the diff; hand the four requested translation keys to coordinator.

### Task 2: Persistent availability read error and safe recovery

**Files:** Modify `apps/mobile/app/(employee)/availability.tsx`; create `apps/mobile/app/(employee)/__tests__/availability-states.test.tsx`.
**Interfaces:** Consume existing `employeesService.getAvailabilitySchedule(): Promise<{ windows; exceptions }>` and `updateAvailabilitySchedule({ windows, exceptions })`, `toggleAvailabilityDay`, shared `EmptyState`, `PrimaryButton.loading`, `FloatingCta.onHeightChange`. Produce a retryable read state, successful existing editor and unchanged save payload.

- [ ] Mock both employee service calls; retain the real `toggleAvailabilityDay` export. Use the theme/router/reanimated/safe-area setup from `today-load-failure.test.tsx`, provide `expo-router` `Stack.Screen` and `router.back/replace/canGoBack` mocks. Render real GlassSwitch/action wrappers so disabled and selected state assertions exercise production presentation.
```tsx
const windows = [{ dayOfWeek: 0, startTime: '08:00', endTime: '10:00', isActive: true },
  { dayOfWeek: 0, startTime: '13:00', endTime: '15:00', isActive: true }];
const exceptions = [{ startDate: '2026-10-08', endDate: '2026-10-09', reason: 'Leave' }];
it('keeps failed read blocked, retries and saves returned windows and exceptions', async () => {
  mockGetAvailabilitySchedule.mockRejectedValueOnce(new Error('offline'));
  const view = render(<AvailabilityScreen />);
  await waitFor(() => expect(view.getByText(i18n.t('availability.loadError'))).toBeTruthy());
  expect(view.queryAllByRole('switch')).toHaveLength(0);
  expect(view.queryByText(i18n.t('availability.save'))).toBeNull();
  expect(mockUpdateAvailabilitySchedule).not.toHaveBeenCalled();
  mockGetAvailabilitySchedule.mockResolvedValueOnce({ windows, exceptions });
  fireEvent.press(view.getByText(i18n.t('common.retry')));
  await waitFor(() => expect(view.getByText('13:00')).toBeTruthy());
  fireEvent.press(view.getByText(i18n.t('availability.save')));
  await waitFor(() => expect(mockUpdateAvailabilitySchedule).toHaveBeenCalledWith({ windows, exceptions }));
});
```
- [ ] Type `windows` as `EmployeeAvailability[]` and `exceptions` as `AvailabilityException[]` imported from `services/employees.ts`, preserving every returned exception field. Add repeated read rejection, pending retry, successful empty schedule and saving-disabled tests. No update is called during read/retry.
- [ ] Red command: `pnpm --dir apps/mobile exec jest --runInBand --coverage=false --runTestsByPath 'app/(employee)/__tests__/availability-states.test.tsx'`. Expected current failure: no persistent load-error/retry; seven switches render after rejection.
- [ ] Extract the existing read into a local `loadSchedule` callback, call it on mount and retry. Set loading/error before each read; on success group returned windows and retain returned exceptions, then clear error. On rejection set `loadFailed` without replacing schedule with seven fabricated off days. Render `loading ? skeletons : loadFailed ? persistentError : editor`; keep editor hidden on failure. Use `if (loading || loadFailed || saving) return` before existing save handler; keep its update payload, alerts and return behavior.
```tsx
<EmptyState icon="cloud-offline-outline" tone="danger" title={t('availability.loadError')}
  description={t('availability.loadErrorHint')} actionLabel={t('common.retry')}
  onAction={() => { void loadSchedule(); }} />
// Within the existing successfully-loaded footer only:
<PrimaryButton label={t('availability.save')} disabled={saving} loading={saving} onPress={handleSave} fontFamily={f600} />
```
- [ ] Apply measured footer padding using Task 3 contract, then same focused command: PASS including preserved two windows/exceptions. Review that retry is read-only and the default schedule never becomes a successful failure result.

### Task 3: Employee mutation pending presentation and measured action footer

**Files:** Modify `apps/mobile/app/(employee)/appointment/[id].tsx`, `apps/mobile/components/features/employee-appointment-styles.ts`; extend `apps/mobile/components/__tests__/employee-appointment-states.test.tsx` and `employee-appointment-back.test.tsx`.
**Interfaces:** Consume existing four mutation `.isPending` flags, wrappers' `loading/disabled`, and `FloatingCta.onHeightChange`; retain all `hasBookingPermission`, `resolveCancellationMode` and eligibility expressions. Produce no exported helper or changed mutation contract.

- [ ] Extend existing hook mocks with mutable `mockStartPending`, `mockCompletePending`, `mockCancelPending`, `mockRequestPending`; return each as the matching mutation's `isPending`. Make the existing PrimaryButton mock return `<Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }} disabled={!!disabled || !!loading} onPress={onPress}><Text>{label}</Text></Pressable>` and include optional `disabled/loading` in its local prop type; foundation tests exercise real AppButton behavior. Test all four flags and eligibility separately:
```tsx
it.each(['start', 'complete', 'cancel', 'request'] as const)('blocks actions while %s is pending', (pending) => {
  mockStartPending = pending === 'start'; mockCompletePending = pending === 'complete';
  mockCancelPending = pending === 'cancel'; mockRequestPending = pending === 'request';
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const view = render(<EmployeeAppointmentDetail />);
  fireEvent.press(view.getByText('doctor.startSession'));
  expect(alert).not.toHaveBeenCalled();
  expect(view.getByRole('button', { name: 'doctor.startSession' }).props.accessibilityState.disabled).toBe(true);
  alert.mockRestore();
});
```
- [ ] In action-specific cases set checked-in/status/permissions so each pending action is visible; assert its busy state and all visible actions disabled. Rerender with flags false after failure and confirm one normal alert/unchanged mutation ID. Retain every existing permission, direct-vs-request cancellation and cold/warm back assertion.
- [ ] Red command: `pnpm --dir apps/mobile exec jest --runInBand --coverage=false --runTestsByPath 'components/__tests__/employee-appointment-states.test.tsx' 'components/__tests__/employee-appointment-back.test.tsx'`. Expected current failure: pending doesn't disable UI.
- [ ] Bind flags to UI only; retain existing handlers, confirmations, haptics and mutation payloads. Read footer measurement state before early loading/error returns:
```tsx
const actionBusy = startSession.isPending || markCompleted.isPending || cancelBooking.isPending || requestCancelBooking.isPending;
const [footerHeight, setFooterHeight] = useState(220);
// Existing canStartSession branch:
<PrimaryButton label={t('doctor.startSession')} onPress={handleStartSession}
  disabled={actionBusy} loading={startSession.isPending} fontFamily={f600} />
// Existing cancellation branch keeps tone and callback selection:
<OutlineButton tone="neutral" disabled={actionBusy}
  loading={cancelBooking.isPending || requestCancelBooking.isPending}
  onPress={cancellationMode === 'direct_cancel' ? handleEmployeeCancel : handleRequestCancel}
  label={cancellationMode === 'direct_cancel' ? t('doctor.cancelBooking') : t('appointments.requestCancel')} />
```
- [ ] Add `disabled={actionBusy}` and `loading={markCompleted.isPending}` to completion. Set `<FloatingCta onHeightChange={setFooterHeight}>`; paddingBottom is `hasBarActions ? footerHeight + sawaaSpacing.lg : insets.bottom + sawaaSpacing.xl`. Foundation owns measurement; avoid double safe-area reserve.
- [ ] In a focused test mock FloatingCta forwarding callback on its View's onLayout, emit height 310 and assert ScrollView flattened paddingBottom `310 + sawaaSpacing.lg` even with bottom inset 34. Same command: PASS; no footer shown on query error/cached sensitive data. Inspect actual diff for permission/payment/video changes (must be absent).

### Task 4: Employee text, scroll, cards and role-specific back

**Files:** Modify `apps/mobile/app/(employee)/client/[id].tsx`, `(employee)/(tabs)/{today,calendar,clients,profile}.tsx`, `(employee)/availability.tsx`; modify `components/features/employee/{AppointmentClientCard,EmployeeAppointmentCard,WeekStrip}.tsx`. Create `apps/mobile/app/(employee)/__tests__/client-record-back.test.tsx`; retain `components/features/employee/__tests__/AppointmentClientCard.test.tsx` as existing navigation regression coverage. Do not create `employee-readable-layout.test.tsx` or add assertions mirroring static style values.
**Interfaces:** Consume current `goBackOrHome(router, fallback: Href)`, `useDir`, `useReduceMotion`, `sawaaType`; keep card/WeekStrip prop signatures and selection/date/route mapping unchanged.

- [ ] Add cold/warm tests for employee client record loading/error/success and availability back. Mock router `canGoBack=false` then true; service fixtures remain existing read shapes. Loading client record must render actual back control. Assert replacement with `/(employee)/(tabs)/clients` for client records, `/(employee)/(tabs)/profile` for availability; warm paths call back and never replace.
```tsx
// Within the new client-record test, after a successful mocked record/history read:
fireEvent.press(view.getByLabelText(i18n.t('a11y.buttonBack')));
expect(mockReplace).toHaveBeenCalledWith('/(employee)/(tabs)/clients');
expect(mockBack).not.toHaveBeenCalled();
```
- [ ] Red command: `pnpm --dir apps/mobile exec jest --runInBand --coverage=false --runTestsByPath 'app/(employee)/__tests__/client-record-back.test.tsx' 'app/(employee)/__tests__/availability-states.test.tsx' 'components/features/employee/__tests__/AppointmentClientCard.test.tsx'`. Expected current failure: raw back has no role fallback. Readability acceptance is native visual evidence, not a style-assertion Jest test.
- [ ] Add `const handleBack = () => goBackOrHome(router, '/(employee)/(tabs)/clients')` to client record and render ScreenHeader in loading/error as well as success; use existing role profile fallback for availability back and post-save return. Keep source fetches intact. Apply LTR writingDirection to phone/email/time values, align labels with useDir, remove single-line restrictions on identity/service text, add `minWidth: 0`/`flexShrink: 1` in card middle/status rows, and use `sawaaType` named roles instead of local title arithmetic.
```tsx
<Text style={[styles.contactText, { fontFamily: f400, textAlign: dir.textAlign, writingDirection: 'ltr' }]}>{value}</Text>
<Text style={[styles.name, { fontFamily: getFontName(dir.locale, '700'), textAlign: dir.textAlign }]}>{name}</Text>
// Existing animation consumers: cap delay without changing data order.
entering={reduceMotion ? undefined : FadeInDown.delay(180 + Math.min(index, 6) * 60).duration(600)}
```
- [ ] Make WeekStrip day labels wrap/grow without changing seven dates, onSelect or week shift, and use existing selection roles/state. Keep the existing card press/navigation tests; do not create Jest tests asserting numberOfLines/font sizes/wrap styles/animation props. Long text, bidirectional contact display and reduced-motion behavior are accepted through the native matrix below.
- [ ] Same focused behavioral command: PASS. Complete the following native visual matrix in the coordinator's integrated acceptance run; use screenshots plus actual scroll/press observation, record OS/device/width/font scale/locale/theme and route for every case. Keep simulator and physical-device evidence separate; unavailable combinations remain unverified.

| Native cases | Fixture/state | Acceptance observation |
|---|---|---|
| Today/calendar/clients/client record: AR and EN × light and dark × 320pt and large phone × 100% and 200% text | Long Arabic/English client and service names, email `long.client.name@example.com`, phone `+966501234567`, appointment time `13:00` | Names/values readable without overlap; phone/email/time read naturally; status and navigation remain reachable; final history/list row scrolls fully into view. |
| WeekStrip: AR and EN × 320pt × 200% text × both themes | Select first/middle/last day, then shift week both directions | Seven dates remain accessible; selection is visible; labels don't collide; week actions preserve date and direction behavior. |
| Availability and appointment footer: AR and EN × 320pt and large × 200% text × both themes | Two availability windows; two visible appointment footer actions; pending then error | Last content row/error remains above footer when scrolled; wrapped button labels remain readable and press targets reachable; pending/retry display is observable. |
| Clients/history lists: AR and EN × reduce motion enabled/disabled | At least 30 rows, scroll to last row immediately | Reduced-motion setting suppresses visible entrance motion; late rows never require waiting through increasing stagger; order and card presses remain unchanged. |

- [ ] Preserve calendar and today error behavior, existing source values and card/date navigation. No new data or video changes. Attach the native matrix evidence to Task 4 rather than treating focused Jest success as visual acceptance.

### Task 5: Locale-consistent native tabs and shared actual version

**Files:** Modify `apps/mobile/app/(client)/(tabs)/_layout.tsx`, `apps/mobile/app/(employee)/(tabs)/_layout.tsx`, `apps/mobile/app/(guest)/_layout.tsx`, `apps/mobile/app/(employee)/(tabs)/profile.tsx`; extend client/guest `__tests__/tab-layout.test.tsx`, create employee `__tests__/tab-layout.test.tsx` and `profile-about.test.tsx`.
**Interfaces:** Consume coordinator-owned `useTabBarStyle` localized labelStyle and no-props `AboutSection`; AboutSection is the sole shared version renderer. No settings/auth files or version helper implementation are owned here.

- [ ] Extend native-tab captured options tests to assert Arabic/English font family from actual `getFontName(locale,'500')`; preserve existing NativeTabs mock, names, colors and labels. Employee new test copies explicit capture pattern from client existing test and expects `['profile','clients','calendar','today']` in AR and reverse in EN. Employee `minimizeBehavior='onScrollDown'` remains intact.
```tsx
expect(mockNativeTabOptions).toHaveBeenCalledWith(expect.objectContaining({
  labelStyle: { fontFamily: getFontName(mockIsRTL ? 'ar' : 'en', '500') },
  tintColor: 'brand-teal', iconColor: { default: 'idle-ink', selected: 'brand-teal' },
}));
```
- [ ] In profile-about test render real AboutSection with mocked Expo Constants: nativeAppVersion `2.3.4`, nativeBuildVersion `42`; assert localized version contains 2.3.4 and 42 and no 1.0.0. Add absent-native fallback case using `expoConfig.version='2.4.0'`, then completely missing metadata case showing `—` from the foundation helper, with no invented version or build. Shared helper's exact fallback tests stay coordinator-owned.
- [ ] Red command: `pnpm --dir apps/mobile exec jest --runInBand --coverage=false --runTestsByPath 'app/(client)/(tabs)/__tests__/tab-layout.test.tsx' 'app/(guest)/__tests__/tab-layout.test.tsx' 'app/(employee)/(tabs)/__tests__/tab-layout.test.tsx' 'app/(employee)/(tabs)/__tests__/profile-about.test.tsx'`. Expected current failure: missing client locale font, hardcoded staff version.
- [ ] Remove role-local labelStyle/font imports from employee/guest layouts; all layouts use the same hook props and keep their existing arrays and single `dir.isRTL ? [...tabs].reverse() : tabs`. Remove the employee Arabic/hardcoded About Alert entry and hardcoded version Text, render `<AboutSection />` once in the scroll content. Preserve privacy/logout/availability navigation and existing user refresh.
```tsx
import { AboutSection } from '@/components/features/settings/AboutSection';
// Staff profile content, after the menu groups:
<AboutSection />
// Client/guest layout; staff also retains its existing minimizeBehavior:
<NativeTabs {...tabBar}>{dir.isRTL ? [...tabs].reverse() : tabs}</NativeTabs>
```
- [ ] Same focused command: PASS. Native font rendering, role tab ordering and label fit at 200% require coordinator simulator/device evidence; no Jest snapshot implies native acceptance.

## Integration Receipt and Handoff

- [ ] Coordinator reviews actual diff and each focused result, keeps shared-contract changes in the foundation lane, and records R02/R03/R10/R12/R17/R21 as fixed/tested or runtime pending. No worker claims closure of dormant R18-R20.
- [ ] Coordinator runs integrated mobile tests/types/lint once after all lanes; mobile commands use `pnpm --dir apps/mobile`, never root coverage or `--filter=mobile`. Existing employee appointment/meeting-start and `lib/__tests__/employee-booking-actions.test.ts` are unchanged-logic regression coverage.
- [ ] Deliver AR/EN × light/dark × 320pt/large × 200% font results with pending/error/empty/retry, long name/contact/date, keyboard/reduce-motion and cold-link navigation. Mark every unrendered state unverified, and distinguish simulator from physical-device evidence.
- [ ] Coordinator updates dated release evidence/README/runbook within approved documentation scope; no dependency versions/lock changes, commit/push/deploy/TestFlight or production writes. Multi-agent execution is already selected; implementation starts only after owner reviews the composed plans.

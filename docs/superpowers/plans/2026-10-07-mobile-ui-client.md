# Mobile UI — Client and Public Journeys Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** توحيد عرض التصفح والحجز والمواعيد والباقات والبرامج للعميل والزائر، وإغلاق أسباب C01–C18 القابلة للمعالجة دون تغيير قواعد الرحلة.

**Architecture:** تبدأ هذه الحزمة بعد تثبيت عقود خطة الأساس. تستهلك مكونات Sawaa الموجودة وأغلفة التوافق، وتبقي البيانات والطلبات والطفرات ومسارات العودة لدى أصحابها الحاليين. تغييرات حالات الطلب تميز الفشل عن الفراغ وتعيد القراءة نفسها؛ لا تضيف واجهة خادم أو مصدر حقيقة آخر.

**Tech Stack:** Expo SDK 55، React Native 0.83، Expo Router، TanStack Query v5، i18next، Jest/jest-expo وReact Native Testing Library.

**Spec:** [المواصفة المعتمدة](../specs/2026-10-07-mobile-ui-unification-design.md)؛ [الفحص C01–C18](../../mobile-app/audits/2026-10-07-mobile-ui-audit.json)؛ [عقد العيادات والخدمات](../../architecture/clinic-service-booking-contract.md).

## Global Constraints

- النطاق هو العرض والتفاعل المحلي: الثيم، الخطوط، الأزرار، الحقول، البطاقات، رؤوس الصفحات، مساحات التمرير، إظهار التحميل والأخطاء، وإمكانية إعادة المحاولة بالطلبات الموجودة. لا تتغير عقود الخادم أو قواعد الحجز أو التوكنات أو الصلاحيات أو مواعيد أهلية الدفع والإلغاء.
- تظل رحلة التأكيد الحالية: ملخص ثم اختيار وسيلة الدفع ثم الإجمالي ثم زر المتابعة. تبقى عناصر Moyasar وApple Pay الأصلية في موضعها الحالي. انتقال أزرار الدفع المباشر إلى التأكيد يحتاج تغييرًا مستقلًا واختبار Sandbox؛ لا تنفذه هذه المواصفة. لا تتضمن المواصفة commit أو push أو merge أو نشرًا أو بناء TestFlight أو تعديل بيانات إنتاجية.
- يبقى `ThemeProvider` المالك الوحيد لوضع العرض، وتظل `getSawaaColors` و`getSawaaRoles` مصدر الألوان. يظل `GlassSurface` تنفيذ السطوح المشترك و`Glass` غلاف توافق؛ بطاقات المحتوى تستخدم `material="surface"` المصمت، ولا تتحول إلى زجاج شفاف. يقتصر الزجاج على المواضع التي تستخدمه بالفعل مثل شريط التنقل.
- يظل تباين النص العادي 4.5 إلى 1 على الأقل على سطحه الفعلي، ويُحسب التباين بعد مزج الشفافية.
- يبقى اختيار المستخدم للوضع محفوظًا؛ لا نفرض الوضع الداكن على التطبيق.
- لا نفعّل استبدال ألوان الثيم من الخادم ضمن التوحيد، ولا نغير شعارًا أو أصلًا بصريًا.
- تظل قيم `sawaaSpacing` و`sawaaRadius` المرجع. تعيد أغلفة الثيم القديمة تصدير القيم المتكافئة بأسمائها القديمة دون تغيير شكل العقود العامة؛ تنتقل المكونات المستهلكة تدريجيًا إلى المرجع نفسه. لا يُنشأ تنفيذ سطح ثالث، ولا تحذف الصادرات غير المستعملة دون حاجة للهجرة.
- يظل المقياس الأساسي: display ‏32/42، heading ‏24/30، subheading ‏18/24، body ‏14/20، caption ‏12/16، micro ‏11/14، حيث الزوج هو حجم الخط وارتفاع السطر. يضاف action ‏17/24 بوزن 600 وbodySm ‏13/20 بوزن 400؛ يربط اسم التوافق displaySm بالدور heading، وlabel بالدور micro، بدل حسابات مستقلة.
- الأولوية للون النص: `style.color` ثم الخاصية `color` ثم اللون الافتراضي للدور. لا يلغي دور bodySm أو label اللون الصريح.
- لا تمنع الأزرار والعناوين القابلة للتمدد تكبير الخط. يلتف رأس الصفحة إلى سطرين عند الحاجة، وتلتف قيم المعلومات الطويلة بدل دفع الأيقونة أو التسمية خارج البطاقة. تبقى المبالغ والمعرفات والبريد والجوال باتجاهها الطبيعي، مع محاذاة التسميات وفق `useDir`. لا يُعدل اتجاه الجذر أو تتضاعف عملية عكس RTL.
- يظل كل ملف كود ضمن حد 350 سطرًا. العمال يحافظون على تعديلات الآخرين ولا ينشئون وكلاء أبناء؛ التشخيص المركّز ينفذ عند طلبه صراحة، والفحص الشامل لدى المنسق بعد الدمج المحلي للدفعة. لا تنتقل دفعة إلى التالية قبل مراجعة فروقها وعقدها المشترك.
- المنسق يملك ملفات i18n وفهارس الصادرات المشتركة ووثائق الإصدارات ومراجعة الفروق والتحقق النهائي.
- تستخدم الصفحات `useReduceMotion` الموجود. لا تُؤخر قوائم السجلات الطويلة بتسلسل حركة يجعل الوصول للعناصر المتأخرة بطيئًا. يظل ترتيب البيانات كما وصل من الطلب الحالي.

## Review Focus

1. فشل قراءة ملف مختص أو خدماته، مع بيانات قديمة أو دونها: رسالة قابلة للاستعادة تختلف عن الفراغ، ولا توسع نطاق العيادة؛ Task 3.
2. هاتف بعرض 320 نقطة وخط 200% واسم عربي طويل: هوية المختص كاملة، واختيار الوقت قابل للقراءة دون تجاوز العرض؛ Tasks 3–4.
3. زيادة ارتفاع الإجراء السفلي بعد التفاف النص أو وصول رسالة: آخر صف قابل للتمرير فوق الإجراء، ومنطقة الأمان محسوبة مرة واحدة؛ Tasks 5–6.
4. صورة CMS شديدة السطوع/الظلمة أو فاشلة: النص مقروء ويظل المقصد والصورة الأصلية محفوظين؛ Task 1.
5. رابط مباشر بلا سجل، زائر وباقة مقفلة وبرنامج ممتلئ وإجراء دفع جارٍ: رجوع مناسب للدور، ولا شراء مكرر أو تسجيل تلقائي أو تجاوز للأهلية؛ Tasks 2، 5–7.

---

## Ownership and contracts

- تعديل المسارات والمكونات المحددة في Tasks 1–7 فقط. تبقى `(auth)/` و`(employee)/` وملفات الحساب/settings/records/notifications وtab `_layout.tsx` و`components/ui/` و`theme/` و`i18n/` خارج كتابة العامل. aliases في `public-booking/` و`public-clinic/` و`(guest)/home.tsx` تستفيد من المصدر المشترك؛ لا تُنسخ الشاشات إليها.
- استهلاك `AppButton` من `@/components/ui/AppButton`: `label: ReactNode`، `onPress`، `variant?: 'primary' | 'secondary' | 'danger' | 'ghost'`، `size?: 'sm' | 'md' | 'lg'`، `disabled?`، `loading?`، `icon?`، `accessibilityLabel?`، `style?`، `minHeight?`. ارتفاع sm/md/lg الأدنى 44/56/64؛ تحفظ الأغلفة `PrimaryButton`/`SecondaryButton` خصائصها السابقة. لا تطلب خاصية testID جديدة للزر.
- استهلاك `FloatingCta({ children, onHeightChange?: (height: number) => void })`: callback يقيس الغلاف الكامل، بما فيه gradient وsafe area. استخدم `useState(180)` كتقدير أولي، ثم `paddingBottom: footerHeight + sawaaSpacing.lg`؛ لا تضف `insets.bottom` إلى القيمة المقاسة.
- استهلاك `InfoRows({ rows: InfoRow[], layout?: 'inline' | 'stacked' })` و`ScreenHeader({ title: string, onBack: () => void, end?: ReactNode })` و`goBackOrHome(router, fallback?: Href): void`. fallback للعميل `/(client)/(tabs)/home`، وللزائر `/(guest)/home`. النتائج ذات العودة المقصودة إلى المواعيد/المشتريات تحفظ `router.replace` الحالي.
- استهلاك `DirectorySearch({ value: string, onChangeText: (value: string) => void, placeholder: string, accessibilityLabel: string, testID?: string })` و`EmptyState({ icon, title, description?, actionLabel?, onAction?, tone? })`؛ هذان عقدان موجودان، لا تستبدلهما بنظام طلب/سطح آخر.
- استهلاك `ThemedText` بعد إضافة تمرير `TextProps` في خطة الأساس؛ تحفظ هجرة status copy خاصية `accessibilityLiveRegion="polite"` وخصائص الوصول الموجودة، ولا يضاف wrapper منفصل لتعويضها.
- الترجمة المطلوبة من المنسق: `home.sectionLoadError` = «تعذر تحميل هذا القسم» / “Could not load this section”، `guest.viewDetails` = «عرض التفاصيل» / “View details”، `booking.checkAgain` = «تحقق مرة أخرى» / “Check again”، `booking.tryAgain` = «إعادة المحاولة» / “Try again”، `booking.viewAppointments` = «عرض مواعيدي» / “View my appointments”. انقل النصوص الثنائية الحالية في TimeSlotsGrid إلى `booking.slotsEmpty`، `booking.slotsEmptyHint`، `a11y.timeSlot` مع `{time}`، وأعد استخدام `common.retry`.
- خدمات/خطافات الدفع وملفات `features/payments/NativePaymentForm.tsx` و`use-native-payment-checkout.ts` و`native-payment-capabilities.ts` و`features/booking/use-payment-status.ts` و`lib/package-*` للقراءة والاختبار فقط. DIRECT يبقى مختارًا عبر selectors الحالية، مع حمل `clinicId/serviceId/steps` دون تغيير.

### Task 1: Home section recovery and readable CMS cards — C09/C10/C11

**Files:** Modify `apps/mobile/app/(client)/(tabs)/home.tsx`، `components/features/home/{HomeCardsCarousel,FeaturedClinics,PackageBalanceCard,HomeAssessmentServices,TherapistsRow,UpNextCard}.tsx` داخل `apps/mobile/`. Create `apps/mobile/components/features/home/HomeSectionState.tsx` و`__tests__/HomeSectionState.test.tsx` في الدليل نفسه. Extend `apps/mobile/components/features/home/__tests__/HomeCardsCarousel.test.tsx`.

**Interfaces:** Produce `HomeSectionState({ loading: boolean, error: boolean, hasData: boolean, onRetry: () => void, children: ReactNode }): ReactElement | null`؛ يستعمل query flags الحالية، `Skeleton` و`EmptyState`، ويحفظ المحتوى القديم مع رسالة فشل محلية عند `hasData && error`. لا يعرض count/availability افتراضيًا. homeQuery مسؤول عن up-next؛ therapistsQuery عن المختصين؛ clinicsQuery عن العيادات؛ mobileHomeCardsQuery عن CMS؛ purchases query داخل PackageBalanceCard عن الرصيد؛ catalog query داخل HomeAssessmentServices عن المقاييس.

- [ ] أضف اختبار الفشل ثم الفراغ مع mock بسيط لـEmptyState يحفظ `onAction` وتسمية الزر، وmock لـSkeleton. المكون نفسه يملك i18n؛ mock `t: (key: string) => key`. المثال الكامل داخل ملف الاختبار بعد imports لـReact/render/fireEvent/View وHomeSectionState:
```tsx
it('retries failed reading without reporting a successful empty section', () => {
  const retry = jest.fn();
  const screen = render(<HomeSectionState loading={false} error hasData={false} onRetry={retry}><View testID="loaded" /></HomeSectionState>);
  expect(screen.getByText('home.sectionLoadError')).toBeTruthy();
  expect(screen.queryByTestId('loaded')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'common.retry' }));
  expect(retry).toHaveBeenCalledTimes(1);
  screen.rerender(<HomeSectionState loading={false} error={false} hasData={false} onRetry={retry}><View testID="loaded" /></HomeSectionState>);
  expect(screen.toJSON()).toBeNull();
});
```
- [ ] تشخيص أحمر مع إذن المنسق فقط: `pnpm --dir apps/mobile exec jest --runInBand --coverage=false --runTestsByPath components/features/home/__tests__/HomeSectionState.test.tsx`؛ يفشل لغياب المكون قبل التنفيذ. أضف loading، stale-data+error واختبار retry لكل قسم إلى الملف نفسه؛ retry لا يستدعي mutations.
- [ ] نفذ المكون الآتي مع imports للأنواع/Translation/View/Skeleton/EmptyState، ولف الأقسام بعقده مع `onRetry={() => { void query.refetch(); }}`؛ أزل الشروط التي تسقط القسم قبل فحص isError:
```tsx
export function HomeSectionState({ loading, error, hasData, onRetry, children }: { loading: boolean; error: boolean; hasData: boolean; onRetry: () => void; children: React.ReactNode }) {
  const { t } = useTranslation();
  if (loading && !hasData) return <Skeleton height={96} />;
  if (!error && !hasData) return null;
  return <View>{hasData ? children : null}{error ? <EmptyState icon="cloud-offline-outline" tone="danger" title={t('home.sectionLoadError')} actionLabel={t('common.retry')} onAction={onRetry} /> : null}</View>;
}
```
- [ ] غيّر منطقة النص على الصورة إلى backing مصمت، واحتفظ بترتيب card وimageUrl وgesture/destination/failure fallback:
```tsx
<View style={{ backgroundColor: roles.surface, padding: sawaaSpacing.md }}>
  <Text style={[styles.title, { color: colors.ink[900], fontFamily: getFontName(dir.locale, '700'), textAlign: dir.textAlign }]}>{title}</Text>
  {description ? <Text style={[styles.description, { color: colors.ink[900], fontFamily: getFontName(dir.locale, '400'), textAlign: dir.textAlign }]}>{description}</Text> : null}
</View>
```
- [ ] احتفظ باختبارات carousel للسلوك، وأضف المثال التالي إلى harness الموجود؛ لا تضف مطابقة font/color/style للمظهر القابل للعكس. سطوع الصورة وتباين النص يراجعان في مصفوفة المحاكي، مع foreground من `colors.ink[900]` وليس حقلًا مفترضًا في roles:
```tsx
it('keeps the card destination and copy when its image fails', () => {
  const screen = render(<HomeCardsCarousel cards={[card({ imageUrl: 'bright.png', destination: 'CLINICS' })]} />);
  fireEvent(screen.getByRole('image'), 'error');
  expect(screen.getByText('عنوان عربي')).toBeTruthy();
  expect(screen.getByText('وصف عربي')).toBeTruthy();
  fireEvent.press(screen.getByText('عنوان عربي'));
  expect(mockPush).toHaveBeenCalledWith('/public-list/clinics');
});
```
المنسق يشغل ملفي الاختبار ويؤكد مرور حالات error/empty/stale/image/destination؛ قياس التباين للأدوار في الأساس، وقراءته على الصور في المحاكي.

### Task 2: Explore and public lists share entity/search presentation — C16/C18

**Files:** Modify `apps/mobile/components/features/explore/ExploreDirectory.tsx`، `apps/mobile/app/public-list/[kind].tsx`، `apps/mobile/components/features/groups/GroupCard.tsx`؛ extend `apps/mobile/components/features/explore/__tests__/ExploreDirectory.test.tsx` و`apps/mobile/app/__tests__/public-list.test.tsx` و`public-therapist-step.test.tsx`. Create `apps/mobile/components/features/groups/__tests__/GroupCard.test.tsx`.

**Interfaces:** Consume DirectorySearch/EmptyState/PackageCard/GroupCard؛ public `Entry` يحفظ `family: ClientPackageFamily` أو `group: Program` كاملًا من query بدل title/subtitle adapter. Add `GroupCardProps.publicPreview?: boolean`، default false؛ في preview تسمية الإجراء `guest.viewDetails` وcallback `onOpen` حتى لو full، دون dialing/enrollment. العقد الحالي `GroupCard({group,onOpen,contactPhone?})` و`PackageCard({family,onPress})` محفوظ.

- [ ] أضف red assertions إلى harness Explore الحالي: البحث يحفظ النتائج، ضغط category يظل زر انتقال للفئة نفسها، retry يستدعي refetch للطلبات الفاشلة فقط، وفشل catalog لا يظهر `No results found`. أعد الاختبار الموجود الذي يثبت guest service → `/public-detail/[kind]/[id]` مع clinicId. مساحة لمس retry تراجع في المحاكي. لا تحول قائمة الفئات التي تختفي بعد الانتقال إلى tablist؛ دلالة selected للاختيارات الباقية في Tasks4/7.
- [ ] قدم public-list fixtures كاملة من `Program` و`ClientPackageFamily` في خدمة query mock الحالية، مع options وأسعارها من fixture PackageCard؛ لا تولد max/duration/price حقولًا غير موجودة. المثال في GroupCard test يستخدم `group` fixture مطابقًا لـProgram وmocks للدور/الثيم كما في directory tests:
```tsx
const group: Program = {
  id: 'program-1', ref: 1, title: 'برنامج', nameAr: 'برنامج', nameEn: 'Program',
  descriptionAr: null, descriptionEn: null, publicDescriptionAr: null, publicDescriptionEn: null,
  departmentId: 'department-1', branchId: 'branch-1', startDate: null, daysCount: 1, hoursPerDay: 1,
  minParticipants: 1, maxParticipants: 10, enrolledCount: 10, price: '10000', currency: 'SAR',
  depositEnabled: false, depositAmount: null, status: 'PUBLISHED', isPublic: true, isFull: true, spotsLeft: 0,
};
it('keeps full public programs reachable without enrolling or dialing', () => {
  const dial = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  const open = jest.fn();
  const screen = render(<GroupCard group={{ ...group, isFull: true }} onOpen={open} publicPreview />);
  fireEvent.press(screen.getByRole('button', { name: 'guest.viewDetails' }));
  expect(open).toHaveBeenCalledTimes(1);
  expect(dial).not.toHaveBeenCalled(); dial.mockRestore();
});
```
- [ ] نفذ `<DirectorySearch value={search} onChangeText={setSearch} placeholder={t('explore.searchPlaceholder')} accessibilityLabel={t('common.search')} testID="explore-search" />` مكان TextInput، وأعد استخدام surface/radius tokens وEmptyState danger/action بدل زر teal محلي. Category controls تحفظ `onPress={() => setFilter(category.id)}` و`accessibilityRole="button"` مع minHeight44، والرجوع المحلي يحفظ `setFilter(null); setSearch('')`.
- [ ] عدل public Entry إلى اتحاد discriminated يحفظ clinic/therapist branches الحالية، ثم:
```tsx
if (item.kind === 'package') return <PackageCard family={item.family} onPress={() => openDetail('package', item.family.id)} />;
if (item.kind === 'program') return <GroupCard group={item.group} publicPreview onOpen={() => openDetail('program', item.group.id)} />;
```
- [ ] في GroupCard استخدم secondary AppButton لpreview/full والإجراء الحالي للتسجيل في client؛ اختبر client full+phone يدعو `tel:`، وclient full دون phone يدعو onOpen، والpreview لا يتصل. المنسق يشغل ملفات Explore/public-list/public-therapist-step/GroupCard المحددة عبر `exec jest --runInBand --coverage=false --runTestsByPath`؛ قبل التعديل يفشل غياب preview/rich card/shared retry، وبعده تمر الأسعار الحقيقية وdeep-link بلا history وclinic/service params الحالية.
- [ ] استخدم اسم البرنامج المحلي من `dir.isRTL ? group.nameAr : group.nameEn ?? group.nameAr` بدل alias title العربي، مع نفس بيانات البرنامج. أمر المنسق: `pnpm --dir apps/mobile exec jest --runInBand --coverage=false --runTestsByPath components/features/explore/__tests__/ExploreDirectory.test.tsx app/__tests__/public-list.test.tsx app/__tests__/public-therapist-step.test.tsx components/features/groups/__tests__/GroupCard.test.tsx`.

### Task 3: Practitioner/public-detail error states and responsive identity — C02/C09/C14

**Files:** Modify `apps/mobile/components/features/directory/{TherapistProfileView,ProfileHero,ServiceRow}.tsx`، `apps/mobile/app/(client)/employee/[id].tsx`، `apps/mobile/app/public-detail/[kind]/[id].tsx`؛ extend `apps/mobile/components/features/directory/__tests__/therapist-profile-cta.test.tsx` و`apps/mobile/app/public-detail/__tests__/guest-booking.test.tsx`. لا ينشأ ملف اختبار يطابق styles الخاصة بـProfileHero.

**Interfaces:** Extend TherapistProfileView with optional `employeeError?: boolean`، `onRetryEmployee?: () => void`، `catalogError?: boolean`، `onRetryCatalog?: () => void`؛ consumes current employee/catalog/loading/clinicId/serviceId/onBook contract unchanged. ProfileHero props unchanged؛ responsive state via `useWindowDimensions()`؛ footer consumes measured FloatingCta. Public detail separates selected resource error from missing item and service-practitioner read error.

- [ ] أضف إلى profile test الموجود، باستخدام `employee()` و`catalog()` الموجودين:
```tsx
it('shows failed scoped services and retries without booking a fallback service', () => {
  const retry = jest.fn(); const book = jest.fn();
  const screen = render(<TherapistProfileView employee={employee(['a'])} loading={false} catalog={undefined} catalogLoading={false} catalogError onRetryCatalog={retry} clinicId="gone" onBack={jest.fn()} onBook={book} />);
  fireEvent.press(screen.getByText('employeeProfile.services'));
  expect(screen.queryByText('employeeProfile.noServices')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'common.retry' }));
  expect(retry).toHaveBeenCalledTimes(1); expect(book).not.toHaveBeenCalled();
});
```
- [ ] أضف employeeError+retry، genuine empty، cached catalog+error وinvalid clinic assertions؛ المحتوى القديم لا يفقد قيمه، وأهلية الحجز الحالية تبقى كما هي. في public-detail harness افشل therapists query مع service صحيح؛ لا تظهر guest.empty، retry يستدعي therapists.refetch فقط. resource retry يختار catalog/family/program/therapist حسب kind دون طلب جديد أو widening.
- [ ] اربط caller بعقد الفشل: `employeeError={employeeQuery.isError} onRetryEmployee={() => { void employeeQuery.refetch(); }}` ونظيره catalog؛ error بلا data → EmptyState، loading → الحالة الموجودة، نجاح بلا employee → missing، catalogError → error branch بدل noServices؛ stale data يبقى ظاهرًا. اجعل back للعميل `goBackOrHome(router, '/(client)/(tabs)/home')` وللعامة default، واختبر غياب history مع mock.canGoBack false.
- [ ] طبق ProfileHero بعقد responsive واضح، وتطبيق `flexWrap: 'wrap'` على rating و`minWidth: 0` على body؛ التحقق من اكتمال الهوية والالتفاف في مصفوفة المحاكي:
```tsx
const { width, fontScale } = useWindowDimensions();
const stacked = width <= 360 || fontScale >= 1.5;
const portrait = stacked ? 88 : 120;
<View style={[styles.row, { flexDirection: stacked ? 'column' : dir.row }]}>
  <Thumb uri={imageUri} width={portrait} height={portrait} icon={placeholderIcon} accessibilityLabel={name} />
  <View style={[styles.body, { minWidth: 0, alignSelf: 'stretch' }]}>
    <Text accessibilityRole="header" style={[styles.name, { color: colors.ink[900], fontFamily: getFontName(dir.locale, '700'), textAlign: dir.textAlign }]}>{name}</Text>
    {lines.map((line) => <Text key={line} style={[styles.line, { color: colors.ink[700], fontFamily: getFontName(dir.locale, '400'), textAlign: dir.textAlign }]}>{line}</Text>)}
    {rating ? <View style={[styles.rating, { flexDirection: dir.row, flexWrap: 'wrap' }]}><Star size={14} color={colors.accent.amber} fill={colors.accent.amber} /><Text style={[styles.ratingText, { color: colors.ink[900], fontFamily: getFontName(dir.locale, '700') }]}>{rating.value}</Text><Text style={[styles.ratingText, { color: colors.ink[700], fontFamily: getFontName(dir.locale, '400') }]}>{rating.caption}</Text></View> : null}
    {pills.length > 0 ? <View style={[styles.pills, { flexDirection: dir.row }]}>{pills.map((pill) => <Pill key={pill.label} label={pill.label} tone={pill.tone} />)}</View> : null}
  </View>
</View>
```
- [ ] المنسق يشغل اختبارات الطلب والرحلة في Files؛ يفشل الاختبار الجديد قبل عرض خطأ الطلب/retry، ثم يمر مع حفظ booking service IDs واللغة والهوية. ProfileHero يعاين باسم عربي وإنجليزي طويل على 320/430pt وخط100/200%؛ لا يضاف اختبار flexDirection/portrait/font مطابق للتنفيذ.
- [ ] أمر المنسق: `pnpm --dir apps/mobile exec jest --runInBand --coverage=false --runTestsByPath components/features/directory/__tests__/therapist-profile-cta.test.tsx app/public-detail/__tests__/guest-booking.test.tsx`.

### Task 4: Booking choices and gap-aware slots — C06/C07/C08/C12/C13

**Files:** Modify `apps/mobile/components/features/booking/{TimeSlotsGrid,DaySelector,PaymentMethods}.tsx`، `apps/mobile/app/(client)/booking/{[serviceId],service,schedule,confirm}.tsx`، `apps/mobile/app/(client)/packages/book.tsx`؛ extend `apps/mobile/components/features/booking/TimeSlotsGrid.test.ts`؛ create `apps/mobile/components/features/booking/__tests__/TimeSlotsGrid-selection.test.tsx` للسلوك فقط. Preserve existing `booking/__tests__/{booking-options,time-screen,schedule-availability,confirm,payment-methods}.test.*`.

**Interfaces:** Existing Slot/TimeSlotsGrid props retained. Produce exported pure `slotGridLayout(width: number, fontScale: number): { columns: number; cellWidth: number }` from TimeSlotsGrid.tsx؛ measured parent onLayout is source of actual width. Pass `reduceMotion={useReduceMotion()}` from package book؛ no selection/index/time/price mutation change.

- [ ] Write red pure test (import `slotGridLayout`):
```ts
it.each([0, 80, 288, 430])('keeps cells and gaps within available width %s', (width) => {
  for (const scale of [1, 2]) {
    const { columns, cellWidth } = slotGridLayout(width, scale);
    expect(Number.isInteger(columns)).toBe(true);
    expect(columns).toBeGreaterThanOrEqual(1);
    expect(cellWidth).toBeGreaterThanOrEqual(0);
    expect(columns * cellWidth + (columns - 1) * sawaaSpacing.sm).toBeLessThanOrEqual(width + 0.001);
  }
});
```
- [ ] نفذ الدالة والتوصيل، مع اختبار سلوك في TimeSlotsGrid-selection: اضغط slot ثانيًا → onSelect(1) مرة، rerender بـselectedIdx=1 → يعلن الاختيار؛ error+onRetry → retry مرة دون onSelect. لا تطابق width/height/onLayout styles في اختبار المكون؛ نفس حساب العرض يطبق على Skeleton:
```tsx
export function slotGridLayout(width: number, fontScale: number) {
  const available = Math.max(0, width);
  const desired = fontScale >= 1.5 ? 2 : 3;
  const columns = Math.max(1, Math.min(desired, Math.floor((available + sawaaSpacing.sm) / (88 + sawaaSpacing.sm))));
  return { columns, cellWidth: Math.max(0, (available - (columns - 1) * sawaaSpacing.sm) / columns) };
}
```
- [ ] قبل أول onLayout، استخدم windowWidth−2*sawaaSpacing.lg تقديرًا؛ عنده حدث width يحدّث useState. أزل `width:'31.5%'` وأضف paddingHorizontal/sm وflexShrink للنص. اختيارات الخدمة/الوقت/طريقة الدفع تبقى handlers والvalues نفسها؛ radio selected مع check cue. `const Arrow = dir.isRTL ? ChevronLeft : ChevronRight` في booking option. استبدل عنوان/back اليدوي المشمول بـScreenHeader أو BookingStepHeader عند وجود steps، واحفظ step count.
- [ ] المنسق يشغل TimeSlotsGrid.test.ts وTimeSlotsGrid-selection.test.tsx وbooking-options/time-screen/schedule-availability/confirm/payment-methods tests وpackages/book.test.tsx؛ حساب تجاوز العرض invariant حقيقي، واختبارات الاختيار/retry تحمي handlers. شاهد الأعمدة/التفاف الوقت/اتجاه السهم وإيقاف الحركة في مصفوفة المحاكي؛ لا يضاف اختبار لقيم font/flex/height أو تمرير علم الحركة وحده.
- [ ] الأمر المركّز للمنسق: `pnpm --dir apps/mobile exec jest --runInBand --coverage=false --runTestsByPath components/features/booking/TimeSlotsGrid.test.ts components/features/booking/__tests__/TimeSlotsGrid-selection.test.tsx 'app/(client)/booking/__tests__/time-screen.test.tsx' 'app/(client)/packages/__tests__/book.test.tsx'`؛ بقية حماية الحجز الموجودة تدخل التحقق المدمج.

### Task 5: Scrollable results and appointment presentation — C01/C12

**Files:** Modify `apps/mobile/app/(client)/booking/success.tsx`، `apps/mobile/app/(client)/packages/return.tsx`، `apps/mobile/components/features/packages/PackagePaymentStatus.tsx`، `apps/mobile/app/(client)/appointment/[id].tsx`، `(client)/(tabs)/appointments.tsx`، `components/features/appointments/{AppointmentRowCard,appointments.styles}.tsx`، `(client)/rate/[bookingId].tsx`، all under `apps/mobile/`. Extend `apps/mobile/app/(client)/booking/__tests__/success-refresh.test.tsx`، `packages/__tests__/return.test.tsx`، `apps/mobile/components/__tests__/appointment-detail-states.test.tsx` و`appointment-service-identity.test.tsx`.

**Interfaces:** measured footer; existing result phases/cancellation quote/retry functions unchanged. Package return retains inline PackagePaymentStatus actions in its new ScrollView؛ no FloatingCta is introduced there, and bottom padding includes safe area once. Appointment animations consume current useReduceMotion؛ no video activation or cancellation eligibility changes.

- [ ] احتفظ باختبار سلوك إعادة التحقق في success-refresh، وحدّث تسميات harness لمفاتيح i18n الجديدة. مثال بلا مطابقة layout؛ هذا الاختبار الموجود يحمي الرحلة ويجب أن يمر قبل وبعد هجرة العرض:
```tsx
it('rechecks the booking and payment when requested', async () => {
  mockPhase = 'pending';
  const screen = render(<BookingSuccessScreen />);
  await act(async () => { fireEvent.press(screen.getByText('booking.checkAgain')); });
  expect(mockCheckAgain).toHaveBeenCalledTimes(1);
  expect(mockRefetchBooking).toHaveBeenCalledTimes(1);
});
```
- [ ] احتفظ باختبارات package-return لـpending/active/failed+tryAgain وpolls/attempt key/ownership الحالية. لا تضف assertion لمكون ScrollView أو padding/Animated entering؛ التمرير فوق الإجراء وتوقف الحركة يراجعان في مصفوفة المحاكي.
- [ ] طبق success مع `const [footerHeight, setFooterHeight] = useState(180)`؛ View الخارجي flex1، ScrollView يحتوي icon/text/InfoRows `layout="stacked"`، `paddingBottom: footerHeight + sawaaSpacing.lg`؛ FloatingCta onHeightChange=setFooterHeight يحتفظ conditions/handlers. Package return → ScrollView style flex1/contentContainer flexGrow1، paddingBottom=insets.bottom+sawaaSpacing.lg؛ لا تحول scroll child إلى flex1 يقيد طوله. Replace result secondary manual Pressable by SecondaryButton. appointment entering = reduceMotion ? undefined : existing animation، والقيم الطويلة/type styles تتبع tokens.
- [ ] المنسق يشغل success-refresh/success-cancelled-card/package-return/appointment-detail-states/appointment-service-identity/rate-booking-real-data tests؛ expected PASS وبقاء النصوص والأسعار والservice IDs والpoll limits. راجع حالات pending/confirmed/failed وcancelled بدون إعلان دفع ناجح نتيجة مجرد callback.
- [ ] أمر المنسق: `pnpm --dir apps/mobile exec jest --runInBand --coverage=false --runTestsByPath 'app/(client)/booking/__tests__/success-refresh.test.tsx' 'app/(client)/booking/__tests__/success-cancelled-card.test.tsx' 'app/(client)/packages/__tests__/return.test.tsx' components/__tests__/appointment-detail-states.test.tsx components/__tests__/appointment-service-identity.test.tsx 'app/(client)/__tests__/rate-booking-real-data.test.tsx'`.

### Task 6: App-owned payment headers/actions and safe footer — C03/C04/C08/C17

**Files:** Modify ONLY presentation in `apps/mobile/app/(client)/payments/native-checkout.tsx` و`apps/mobile/app/(client)/booking/{payment,bank-transfer,checkout,confirm}.tsx` و`apps/mobile/components/features/booking/BankTransferAccountDetails.tsx`؛ extend `apps/mobile/app/(client)/payments/__tests__/native-checkout.test.tsx` و`apps/mobile/app/(client)/booking/__tests__/bank-transfer.test.tsx`. Keep NativePaymentForm and all payment services/hooks unchanged.

**Interfaces:** Same statusKey/choiceScope/selectMethod/config/onResult/reconcile/retryInitialization/capability booleans and upload handler. Consume ScreenHeader, AppButton, ThemedText, measured FloatingCta؛ LTR values such as invoice/bank identifiers remain LTR with Arabic labels. No direct Apple Pay/native SDK button is drawn by AppButton.

- [ ] Extend native-checkout harness router with `canGoBack: () => false` and assertions: Back → replace client home، choosing method still calls same hook input، ready config keeps NativePaymentForm mounted once across checking، reconciliation action does not create new intent. Add bank-transfer mock upload deferred Promise and repeat press while pending → upload once and button busy/disabled. حجز المساحة المقاسة والكيبورد يراجعان في مصفوفة المحاكي، دون اختبار padding مطابق للتنفيذ.
- [ ] Minimal JSX transformation retains each existing branch predicate exactly:
```tsx
<ScreenHeader title={t('nativePayment.title')} onBack={() => goBackOrHome(router, '/(client)/(tabs)/home')} />
<ThemedText variant="body" align={dir.textAlign} accessibilityLiveRegion="polite">{t(statusKey)}</ThemedText>
<AppButton label={t('nativePayment.useCard')} variant="secondary" onPress={() => selectMethod('ONLINE_CARD')} />
<AppButton label={t('nativePayment.checkAgain')} loading={loading} onPress={() => { void checkout.reconcile(); }} />
```
- [ ] أزل title/fontWeight اليدوي فقط، وطبق getFontName/useDir على status/network label؛ NativePaymentForm invocation وkey/config/condition/callback حرفيًا كما هي. payment chooser يعطي radio selected/check، gradient submit → AppButton وFloatingCta مع loading من pending الموجود؛ bank-transfer يبقي receipt validation/upload/navigation نفسه، ويعرض metadata عبر InfoRows. confirm يظل summary→PaymentMethods→total→continue؛ لا تنقل أزرار SDK إليه. checkout يحافظ resume policy ومواعيد التعطيل.
- [ ] المنسق يشغل `payments/__tests__/native-checkout.test.tsx` و`native-checkout-integration.test.tsx` و`booking/__tests__/{confirm,bank-transfer,checkout,payment-retry,success-cancelled-card,use-payment-status}.test.*` و`features/payments/__tests__/{NativePaymentForm,native-sdk-presentation,native-sdk-apple-result,use-native-payment-checkout}.test.tsx` عبر mobile exec jest. expected PASS؛ الاختبارات الجديدة لمنع تكرار الضغط والرجوع بلا سجل تفشل قبل توصيل السلوك ثم تمر، واختبارات حماية الدفع الحالية يجب أن تمر قبل وبعد التعديل. لا تضاف اختبارات headers/footer styles.
- [ ] أمر المنسق المركّز: `pnpm --dir apps/mobile exec jest --runInBand --coverage=false --runTestsByPath 'app/(client)/payments/__tests__/native-checkout.test.tsx' 'app/(client)/payments/__tests__/native-checkout-integration.test.tsx' 'app/(client)/booking/__tests__/confirm.test.tsx' 'app/(client)/booking/__tests__/bank-transfer.test.tsx' 'app/(client)/booking/__tests__/payment-retry.test.tsx' features/payments/__tests__/NativePaymentForm.test.tsx features/payments/__tests__/native-sdk-presentation.test.tsx features/payments/__tests__/native-sdk-apple-result.test.tsx features/payments/__tests__/use-native-payment-checkout.test.tsx`.
- [ ] راجع actual diff للتأكد من عدم تغير شروط capabilities/method/paymentId/ownership/return/reconciliation أو SDK callback. إذا تغير أي منها، ارفض نطاق العامل وأعد الفصل. حتى تعديلات عرض صفحات الدفع تتطلب dashboard smoke وMoyasar Sandbox وفق قاعدة المشروع لأي تغيير في الدفع؛ لا يعتبر simulator أو mock بديلًا. عند تعذر الوصول لـSandbox تبقى رحلة الدفع غير مقبولة ويذكر الحاجز صراحة، ولا يغير ذلك حق تنفيذ بقية حزم العرض. لا تنفذ هذه الخطة دفعًا إنتاجيًا أو تغييرًا في آلية الدفع.

### Task 7: Packages/groups actions, selected branches, and RTL credits — C05/C07/C15

**Files:** Modify `apps/mobile/components/features/packages/{PackageBookingAction,PackageCreditCard,PackageBranchPicker,PackageCard,PackagePaymentStatus}.tsx` و`apps/mobile/app/(client)/packages/{index,[id],purchases,book}.tsx` و`apps/mobile/app/(client)/groups/{index,[id]}.tsx`؛ GroupCard presentation completed in Task2. Create `apps/mobile/components/features/packages/__tests__/package-actions.test.tsx`؛ preserve `package-screens.test.tsx`، `PackageCard.test.tsx` و`apps/mobile/app/(client)/packages/__tests__/{balance-entry,book}.test.tsx`.

**Interfaces:** PackageBookingAction props unchanged (`enabled/pending/onPress/fontFamily`)؛ PackageCreditCard retains credit eligibility/lock reason and onBook(credit)؛ PackageBranchPicker retains branches/branchId/onSelect/onRetry/dir/fonts. No invented credit expiry/popularity/capacity or VAT defaults. Branch selection has minHeight44 and radio/selected plus visible Check independent of tint.

- [ ] Write focused red test with imports PackageBookingAction/render/fireEvent and existing locale/theme mocks from PackageCard.test.tsx:
```tsx
it('keeps the action label and blocks repeat booking while pending', () => {
  const book = jest.fn();
  const screen = render(<PackageBookingAction enabled pending onPress={book} fontFamily="System" />);
  const button = screen.getByRole('button', { name: 'packages.confirmBooking' });
  expect(button.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
  fireEvent.press(button); expect(book).not.toHaveBeenCalled();
});
```
- [ ] نفذ action، والcredit minHeight44 وstyle `{alignSelf:dir.alignStart}`؛ أضف `{textAlign:dir.textAlign}` للlocked reason، وأبقِ canBook/creditLockReason كما هي:
```tsx
return <AppButton label={t('packages.confirmBooking')} loading={pending} disabled={!enabled} onPress={onPress} style={{ marginTop: sawaaSpacing.lg }} />;
```
- [ ] في BranchPicker لف Glass surface بPressable `accessibilityRole="radio" accessibilityState={{selected}}` وبحد ثابت؛ الCheck يظهر عند selected. retry → secondary AppButton size sm. الخيارات في package detail تحمل radio selected من optionId الحالي؛ group CTA يستهلك pending من mutation الحالي ويحافظ enrollment recovery عندما isFull. Screens headers → ScreenHeader/back fallback؛ dense data → InfoRows stacked؛ typography → exact sawaaType/getFontName roles، بدون arithmetic scale.
- [ ] أضف branch test بفرعين: ضغط الثاني → onSelect(id) مرة، retry عند error → onRetry فقط، selected accessible state يعود من branchId prop. أضف credit locked fixture من balance-entry tests: no book action + current lock reason، active/concrete fixture → original onBook credit. محاذاة AR/EN ورسالة القفل ومساحة اللمس تراجع في المحاكي، دون مطابقة alignSelf/textAlign styles. المنسق يشغل package-actions/package-screens/PackageCard/balance-entry/book tests؛ expected PASS ويحفظ جميع entitlement locks والأسعار الحقيقية.
- [ ] أمر المنسق: `pnpm --dir apps/mobile exec jest --runInBand --coverage=false --runTestsByPath components/features/packages/__tests__/package-actions.test.tsx components/features/packages/__tests__/package-screens.test.tsx components/features/packages/__tests__/PackageCard.test.tsx 'app/(client)/packages/__tests__/balance-entry.test.tsx' 'app/(client)/packages/__tests__/book.test.tsx'`.

## Integrated acceptance and handoff

| تحقق المحاكي | الحالات | النتيجة المطلوبة والدليل |
|---|---|---|
| الصورة واللون والخط | home CMS بصورة فاتحة/داكنة/فشل صورة؛ AR/EN وlight/dark | النص مقروء فوق backing المصمت، الصورة والمقصد محفوظان؛ screenshot لكل وضع، وفشل الصورة يحفظ copy. مصدر foreground هو ألوان Sawaa، ولا يفترض حقل ink في roles. |
| هوية المختص والمساحات | اسم/تخصص/تقييم طويل؛ 320/430pt وخط100/200% | الاسم كامل، التقييم والشارات يلتفان، ولا يدفع المحتوى الأيقونات خارج البطاقة؛ screenshots بدل اختبارات flex/portrait/font. |
| الوقت والاختيارات | slot grid، خيار خدمة/دفع/فرع؛ AR/EN وهاتف صغير وخط200% | صفوف قابلة للقراءة دون overflow، سهم تقدم صحيح وselected مسموع ومرئي؛ فيديو اختيار قصير، وفحص لمس ≥44pt. |
| النتيجة والإجراء السفلي | success pending/confirmed/failed، package return، payment وبنك؛ footer بنص ملتف ورسالة خطأ | آخر صف ورسالة وإجراء يمكن الوصول إليها بالتمرير، والsafe area مرة واحدة؛ فيديو scroll حتى النهاية، مع/دون لوحة المفاتيح، بدل assert padding/height. |
| الحركة والرصيد | تقليل الحركة مفعّل/معطل؛ appointment/package book؛ credit مقفل/متاح في AR/EN | لا انتقال حركي عند التفضيل، لا تأخير متسلسل لقائمة طويلة، ورسالة القفل والمحاذاة واضحتان؛ الفيديو دليل العرض، واختبارات السلوك تحمي الأهلية. |

- [ ] لا commit ضمن أي task. سلّم قائمة الملفات الفعلية وdiff ونص مفاتيح الترجمة للمنسق، الذي يراجع هذا النطاق مع الأساس والحساب والموظف. لا تقبل تقرير العامل كبديل لقراءة diff؛ الاختبارات المركزة للعامل لا تنفذ إلا بتكليف المنسق، والفحص الشامل مرة واحدة بعد الدفعة.
- [ ] تغطية C01 Task5؛ C02 Task3؛ C03 Task6؛ C04 Tasks6–7؛ C05 Task7؛ C06 Task4؛ C07 Tasks4/7؛ C08 Tasks4/6؛ C09 Tasks1/3؛ C10 Task1؛ C11 Task1؛ C12 Tasks4/5؛ C13 Task4؛ C14 Task3؛ C15 Task7؛ C16 Task2؛ C17 Task6 (حفظ الرحلة)؛ C18 Task2. أدلة static فقط لا تغلق runtime findings.
- [ ] نفذ عبر المنسق بعد استعادة dependencies من القفل الحالي: `pnpm --dir apps/mobile typecheck` و`pnpm --dir apps/mobile exec jest --runInBand` و`pnpm --dir apps/mobile lint` مرة للدفعة، ثم المتأثر فقط عند الإصلاح. غياب Moyasar يبقى blocker للأنواع، ولا تعالجه بmock أو تعديل lock.
- [ ] سجل AR/EN × dark/light × 320/430pt × font100/200%، keyboard على البحث/bank transfer/native card، reduce-motion، network failed/empty/stale، اسم طويل/تاريخ/مبلغ/خيار/CTA pending وdeep-link بلا سجل. راجع home/explore/public lists+detail/clinic/practitioner/time/confirm/payment/bank-transfer/native-checkout/success/appointment/packages/group. الشاشات والحالات التي لم تُعرض native تبقى غير متحققة، والجهاز الحقيقي منفصل عن المحاكي/web. المنسق يحدث audit/release README/runbook بالأدلة وحدودها بعد تنفيذ فعلي؛ لا upload أو نشر.

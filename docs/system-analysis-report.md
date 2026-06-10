# تقرير تحليل وإصلاح نظام Sawa Family Counseling

> **تاريخ التقرير:** 2026-06-06
> **النطاق:** Backend API + Dashboard + Mobile + API Client + Security
> **طريقة العمل:** تحليل أولي ثم إصلاحات متوازية عبر 5 وكلاء تنفيذ، مع إصلاح Mobile محلي ومراجعة نهائية.

---

## 1. ملخص تنفيذي بعد الإصلاح

تمت مراجعة التقرير السابق والتحقق من صحة ادعاءاته على الكود الفعلي. بعض المشاكل كانت صحيحة وتم إصلاحها، وبعضها كان يحتاج تصحيح صياغة لأنه بالغ في الخطر أو وصف حالة غير دقيقة.

| المجال | الحالة بعد الإصلاح |
|---|---|
| Backend sessions | ✅ تم إصلاح تغيير كلمة المرور ليزيد `tokenVersion` ويلغي refresh tokens النشطة |
| Dashboard services hooks | ✅ تم إصلاح جلب نماذج الخدمة وتحديث cache بعد فشل جزئي |
| Dashboard payments | ✅ تم تحسين تفاصيل الدفع وتمرير سقف الاسترداد للواجهة |
| Booking POS | ✅ تمت إضافة Zod validation قبل إرسال الحجز |
| API Client | ✅ تم توحيد `client-auth` و`me` على `apiRequest` المركزي |
| Mobile refresh | 🟡 تم إصلاح عدم الكتابة فوق refresh token عند غيابه من رد الباكند، لكن الاختبار محجوب بيئياً بسبب نقص `jest-expo` |
| Dashboard auth claim | ✅ تم تصحيح التقرير: Backend dashboard APIs محمية بـ `JwtGuard` و`CaslGuard`; المتبقي hardening في الواجهة وليس bypass مباشر للـ API |
| Avatar upload claim | ✅ تم تصحيح التقرير: رفع الصور لديه MIME/size checks ويمر عبر handler يتحقق من magic bytes |

---

## 2. الإصلاحات المنفذة والتحقق

### 2.1 تغيير كلمة المرور وإبطال الجلسات

**المشكلة الأصلية:** تغيير كلمة المرور كان يحدّث `passwordHash` فقط، ولا يزيد `tokenVersion` ولا يلغي refresh tokens الموجودة.

**الإصلاح:**

- تحديث [change-password.handler.ts](/Users/tariq/code/sawaa/apps/backend/src/modules/identity/users/change-password.handler.ts) لاستخدام `RlsTransactionService`.
- داخل transaction واحد:
  - تحديث `passwordHash`.
  - زيادة `tokenVersion` بقيمة `increment: 1`.
  - إلغاء كل refresh tokens النشطة للمستخدم عبر `revokedAt`.
- تحديث [change-password.handler.spec.ts](/Users/tariq/code/sawaa/apps/backend/src/modules/identity/users/change-password.handler.spec.ts).

**التحقق:**

```bash
pnpm --filter=backend test -- src/modules/identity/users/change-password.handler.spec.ts
```

النتيجة: ✅ نجح، 4 اختبارات.

### 2.2 نماذج Intake Forms للخدمات

**المشكلة الأصلية:** `useIntakeForms(serviceId)` كان يتجاهل `serviceId` ويجلب كل النماذج.

**الإصلاح:**

- تحديث [use-services.ts](/Users/tariq/code/sawaa/apps/dashboard/hooks/use-services.ts) لتمرير:
  - `scope: "service"`
  - `scopeId: serviceId`
- تحديث اختبار [use-services.spec.tsx](/Users/tariq/code/sawaa/apps/dashboard/test/unit/hooks/use-services.spec.tsx).

**التحقق:**

```bash
pnpm --dir apps/dashboard exec vitest run test/unit/hooks/use-services.spec.tsx
```

النتيجة: ✅ نجح، 26 اختباراً.

### 2.3 Cache بعد فشل جزئي في تعيين موظفي الخدمة

**المشكلة الأصلية:** `useAssignEmployeesToService` كان يحدث cache فقط عند نجاح كل العمليات. عند نجاح بعض الطلبات وفشل بعضها، قد تبقى الواجهة قديمة.

**الإصلاح:**

- نقل invalidation من `onSuccess` إلى `onSettled` في [use-services.ts](/Users/tariq/code/sawaa/apps/dashboard/hooks/use-services.ts).

**الحالة المتبقية:** هذا يعالج stale cache بعد الفشل الجزئي، لكنه لا يحول العملية إلى transaction ولا يضيف rollback. هذا يحتاج endpoint مجمع في الباكند إذا أردنا اتساقاً كاملاً.

**التحقق:**

```bash
pnpm --dir apps/dashboard exec vitest run test/unit/hooks/use-services.spec.tsx
```

النتيجة: ✅ نجح ضمن نفس ملف الاختبارات، 26 اختباراً.

### 2.4 تفاصيل الدفع وسقف الاسترداد

**المشاكل الأصلية:**

- `PaymentDetailDialog` كان يجلب صفحة واحدة بحجم `perPage: 1` ثم يبحث عن `paymentId` محلياً، لذلك يفشل غالباً لأي دفع ليس أول عنصر.
- `PaymentActions` لم يمرر `maxAmount` إلى `RefundDialog`.

**الإصلاح:**

- إضافة `fetchPayment(id)` في [payments.ts](/Users/tariq/code/sawaa/apps/dashboard/lib/api/payments.ts).
- تحديث [payment-detail-dialog.tsx](/Users/tariq/code/sawaa/apps/dashboard/components/features/payments/payment-detail-dialog.tsx) لاستخدام `fetchPayment`.
- تحديث [payment-actions.tsx](/Users/tariq/code/sawaa/apps/dashboard/components/features/payments/payment-actions.tsx) لحساب:
  - `amount - refundedAmount`
  - مع منع القيم السالبة عبر `Math.max(..., 0)`.
- إضافة اختبار جديد [payment-detail-dialog.spec.tsx](/Users/tariq/code/sawaa/apps/dashboard/test/unit/features/payments/payment-detail-dialog.spec.tsx).
- تحديث اختبارات payments API وactions.

**ملاحظة مهمة:** لا يوجد حالياً endpoint مخصص `GET /dashboard/finance/payments/:id`. لذلك `fetchPayment` هو fallback أفضل من `perPage: 1`، لكنه ليس بديلاً مثالياً عن endpoint مخصص.

**التحقق:**

```bash
pnpm --dir apps/dashboard exec vitest run \
  test/unit/lib/payments-api.spec.ts \
  test/unit/features/payments/payment-actions.spec.tsx \
  test/unit/features/payments/payment-detail-dialog.spec.tsx
```

النتيجة: ✅ نجح، 17 اختباراً.

### 2.5 Booking POS submit validation

**المشكلة الأصلية:** `BookingPos.handleSubmit` كان يعتمد على checks يدوية فقط ولا يستخدم Zod validation على payload النهائي.

**الإصلاح:**

- إضافة `bookingPosPayloadSchema` في [booking.schema.ts](/Users/tariq/code/sawaa/apps/dashboard/lib/schemas/booking.schema.ts).
- تحديث [booking-pos.tsx](/Users/tariq/code/sawaa/apps/dashboard/components/features/bookings/booking-pos.tsx) ليبني payload ثم ينفذ `safeParse`.
- عند فشل التحقق، يظهر toast error ولا يتم استدعاء mutation.
- تحديث [booking-pos-submit.spec.tsx](/Users/tariq/code/sawaa/apps/dashboard/test/unit/features/bookings/booking-pos-submit.spec.tsx).

**التحقق:**

```bash
pnpm --filter=dashboard test test/unit/features/bookings/booking-pos-submit.spec.tsx
pnpm --filter=dashboard test test/unit/lib/booking-schemas.spec.ts
```

النتيجة: ✅ نجح، 6 اختبارات في POS و26 اختباراً في schemas.

### 2.6 توحيد API Client

**المشكلة الأصلية:** `client-auth.ts` و`me.ts` كانا يستخدمان fetch wrappers محلية بدلاً من `apiRequest` المركزي، ما يعني اختلاف error handling وrefresh mutex.

**الإصلاح:**

- تحديث [client.ts](/Users/tariq/code/sawaa/packages/api-client/src/client.ts):
  - إضافة `setApiRequestBaseUrl`.
  - جعل refresh path يعتمد على نوع endpoint:
    - `/public/auth/refresh` للمسارات العامة.
    - `/auth/refresh` لباقي المسارات.
  - دعم public refresh الذي يعيد cookie/session ولا يعيد `accessToken`.
- تحديث [client-auth.ts](/Users/tariq/code/sawaa/packages/api-client/src/modules/client-auth.ts) لاستخدام `apiRequest`.
- تحديث [me.ts](/Users/tariq/code/sawaa/packages/api-client/src/modules/me.ts) لاستخدام `apiRequest`.
- إضافة [me.test.ts](/Users/tariq/code/sawaa/packages/api-client/src/modules/__tests__/me.test.ts) وتحديث [client-auth.test.ts](/Users/tariq/code/sawaa/packages/api-client/src/modules/__tests__/client-auth.test.ts).

**التحقق:**

```bash
pnpm --filter=@sawaa/api-client test -- \
  src/modules/__tests__/client-auth.test.ts \
  src/modules/__tests__/me.test.ts
pnpm --filter=@sawaa/api-client typecheck
```

النتيجة: ✅ نجحت الاختبارات، 16 اختباراً، ونجح typecheck.

### 2.7 Mobile refresh token drift

**المشكلة الأصلية:** الموبايل كان يتوقع أن `/auth/refresh` يعيد `refreshToken` جديداً في body. الباكند الحالي يعيد access token ويعتمد أكثر على cookie/session model في أجزاء أخرى.

**الإصلاح المنفذ:**

- تحديث [api.ts](/Users/tariq/code/sawaa/apps/mobile/services/api.ts) بحيث:
  - يتعامل مع `refreshToken` كحقل اختياري في رد refresh.
  - لا يكتب `undefined` فوق refresh token المخزن.
- تحديث [api.test.ts](/Users/tariq/code/sawaa/apps/mobile/services/api.test.ts) لاختبار هذا السلوك.

**التحقق:**

```bash
pnpm --dir apps/mobile test services/api.test.ts --runInBand
```

النتيجة: ⚠️ لم يبدأ الاختبار لأن البيئة الحالية لا تحتوي `jest-expo`:

```text
Preset jest-expo not found
```

كما أن:

```bash
pnpm --dir apps/mobile typecheck
```

فشل بسبب نقص اعتمادات Expo/React Native في البيئة الحالية، مثل `expo/config`, `react-native`, `expo-router`.

**الخلاصة:** تم إصلاح drift المحدد في الكود، لكن تحقق الموبايل محجوب حتى تثبت اعتمادات `apps/mobile` فعلياً.

---

## 3. تصحيحات على التقرير السابق

### 3.1 Dashboard auth ليس bypass API مباشر

الادعاء السابق بأن الداشبورد لا يملك حماية صلاحيات على المستوى الأول كان يحتاج تصحيحاً. صفحات الداشبورد قد تعتمد على client-side gating في الواجهة، لكن Backend dashboard controllers محمية عبر guards، ومنها `JwtGuard` و`CaslGuard` في المسارات الحساسة.

**الحالة الصحيحة:** المتبقي هو تحسين UX وhardening في الواجهة، وليس ثغرة تسمح باستدعاء API محمي بدون صلاحيات.

### 3.2 Avatar upload لديه validation

الادعاء السابق بعدم وجود validation على رفع avatar غير صحيح. الكود يتحقق من النوع والحجم ويمرر الملف إلى upload handler يتحقق من magic bytes.

**الحالة الصحيحة:** لا تعتبر هذه مشكلة مفتوحة في التقرير الحالي.

### 3.3 Partial assignment ليس محلولاً بالكامل

إصلاح cache عبر `onSettled` يمنع بقاء الواجهة على بيانات قديمة بعد فشل جزئي، لكنه لا يضمن atomicity للعملية. الحل الكامل يحتاج API endpoint مجمع يعالج الإضافات والحذف في transaction واحدة.

---

## 4. المشاكل المفتوحة بعد هذه الجولة

| الأولوية | المشكلة | الحالة المقترحة |
|---|---|---|
| P1 | لا يوجد endpoint مخصص لجلب دفع واحد | إضافة `GET /dashboard/finance/payments/:id` وتحديث OpenAPI/client |
| P1 | تعيين موظفي الخدمة ليس atomic | إضافة endpoint bulk assign داخل transaction |
| P1 | Mobile test environment غير مكتملة | تثبيت/ربط dependencies الخاصة بـ `apps/mobile` ثم إعادة Jest/typecheck |
| P2 | Website/public fetch بلا runtime response validation | إضافة Zod schemas للمسارات العامة المهمة |
| P2 | API Client لا يزال بلا runtime validation عام | اعتماد schemas مشتركة تدريجياً |
| P2 | Mobile لا يستخدم `@sawaa/api-client` | قرار معماري: إما توحيد client أو إبقاء Axios مع عقود اختبار أقوى |
| P2 | Mobile يحتوي stubs خاملة من الكود القديم | إبقاؤها خاملة كما توصي AGENTS أو تنظيفها بقرار منفصل |

---

## 5. سجل الاختبارات

| الإصلاح | الأمر | النتيجة |
|---|---|---|
| Change password sessions | `pnpm --filter=backend test -- src/modules/identity/users/change-password.handler.spec.ts` | ✅ Pass، 4 tests |
| Services hooks | `pnpm --dir apps/dashboard exec vitest run test/unit/hooks/use-services.spec.tsx` | ✅ Pass، 26 tests |
| Payments UI/API | `pnpm --dir apps/dashboard exec vitest run test/unit/lib/payments-api.spec.ts test/unit/features/payments/payment-actions.spec.tsx test/unit/features/payments/payment-detail-dialog.spec.tsx` | ✅ Pass، 17 tests |
| API Client auth/me | `pnpm --filter=@sawaa/api-client test -- src/modules/__tests__/client-auth.test.ts src/modules/__tests__/me.test.ts` | ✅ Pass، 16 tests |
| API Client typecheck | `pnpm --filter=@sawaa/api-client typecheck` | ✅ Pass |
| Booking POS submit | `pnpm --filter=dashboard test test/unit/features/bookings/booking-pos-submit.spec.tsx` | ✅ Pass، 6 tests |
| Booking schemas | `pnpm --filter=dashboard test test/unit/lib/booking-schemas.spec.ts` | ✅ Pass، 26 tests |
| Mobile API refresh | `pnpm --dir apps/mobile test services/api.test.ts --runInBand` | ⚠️ Blocked: `Preset jest-expo not found` |
| Mobile typecheck | `pnpm --dir apps/mobile typecheck` | ⚠️ Blocked: Expo/RN module dependencies missing |

---

## 6. خلاصة

الجولة عالجت أعلى المشاكل العملية التي ثبتت صحتها في التقرير السابق: session invalidation، drift في hooks، نقص validation في Booking POS، مشاكل payments UI، وتشتت API client. التقرير السابق لم يكن كله خاطئاً، لكنه احتوى على ادعاءات تحتاج تخفيفاً أو تصحيحاً، خصوصاً حول dashboard authorization وavatar upload.

العمل المتبقي الأكبر ليس patch صغيراً في الواجهة، بل قرارات API/architecture: endpoint مخصص للدفع، bulk transaction لتعيين الموظفين، وتجهيز بيئة mobile test حتى تكون قابلة للتحقق مثل بقية الحزم.

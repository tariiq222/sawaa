# تصميم: مصفوفة تسعير ومدة المعالج (Employee Pricing Matrix)

التاريخ: 2026-06-19
الفرع: feature/clinic-as-booking-unit
الحالة: معتمد (في انتظار خطة التنفيذ)

## المشكلة

عرض وتحرير سعر/مدة المعالج لخدمة معيّنة موزّع على 6 مكوّنات إدارية متفرّقة في الداشبورد،
كل واحد يعدّل نفس البيانات بزاوية مختلفة. النتيجة: المدير ما يفهم بنظرة واحدة:
- إيش سعر/مدة كل معالج،
- إيش موروث من الخدمة وإيش متجاوز،
- المدد الخاصة بالمعالج (لو موجودة)،
- اختلاف السعر/المدة حسب نوع الحضور (حضوري/أونلاين).

بالإضافة، الباك إند ناقص جزء جوهري وفيه أجزاء WIP غير موصولة.

## النموذج الذهني للبيانات (موجود في الباك إند، مرجع)

ترتيب أولوية حلّ السعر/المدة عند الحجز (`price-resolver.service.ts`):
1. `EmployeeServiceOption.priceOverride/durationOverride` — تجاوز المعالج لخيار مدة محدد.
2. `ServiceDurationOption` المملوكة للمعالج (`employeeServiceId` غير فارغ) — TIER 1.
3. `ServiceDurationOption` الافتراضية للخدمة (`employeeServiceId = NULL`) — TIER 2.
4. `ServiceBookingConfig.price/durationMins` حسب نوع الحضور.
5. `Service.price/durationMins` كآخر ملاذ.

## الوضع الحالي (نتائج الجرد)

### موجود وشغّال
- create-booking يستدعي `PriceResolver` بـ `employeeServiceId + durationOptionId` ويحسب الصحيح.
- تبويب «التسعير» للخدمة: `pricing-tab → booking-type-row → duration-options-editor`.
- تبويب «المعالجين»: `service-employees-tab → assigned-employee-row → employee-custom-pricing-row`.
- شيت خدمة الموظف: `edit-employee-service-sheet → employee-service-types-editor`.
- حفظ تجاوزات الخيار موصول: `PUT employees/:id/services/:serviceId/options` (SetEmployeeServiceOptions).
- حفظ التسعير المخصص لكل نوع حضور موصول: `PUT .../custom-pricing`.

### ناقص / WIP / عيوب مكتشفة
1. **لا endpoint يرجّع «المدد الفعّالة» للمعالج**: الحقل `effectiveDurations` (PractitionerDurationGroup)
   في أنواع الفرونت فاضٍ — ما أحد يبنيه. هذا أساس المصفوفة.
2. **حفظ المدد المملوكة غير موصول**: `set-employee-durations` handler + DTO جاهزان، لكن
   ما فيه route. الفرونت عنده `setEmployeeDurations()` + `durationsMut` ينده endpoint غير موجود.
3. **`buildEmployeeServiceOptionsPayload` يرجّع `null` دايماً** → تجاوزات الشيت ما تُحفظ.
4. **TODO**: قائمة معالجي الخدمة ما تُحدّث بعد حفظ الشيت (cache stale).
5. **تكرار**: `employee-custom-pricing-row` و `employee-service-types-editor` يسوّون نفس الشي.

## الحل المعتمد: مصفوفة لكل معالج

### نمط العرض
لكل معالج معيّن على الخدمة:
- صفوف = خيارات المدة (الموروثة من الخدمة + المملوكة للمعالج).
- أعمدة = أنواع الحضور المفعّلة (حضوري / أونلاين).
- الخلية = السعر بالريال.
- الموروث يُعرض باهتاً، المخصص ملوّناً مع أيقونة تمييز.
- أعلى المصفوفة: toggle «نشط» + buffer.
- تعديل خلية inline → يحفظ تجاوز خيار (`EmployeeServiceOption`).
- زر «إضافة مدة خاصة بالمعالج» → مدّة مملوكة (`ServiceDurationOption` بـ employeeServiceId).

## التغييرات

### الباك إند

**B1 — endpoint قراءة «المدد الفعّالة» للمعالج.**
- يرجّع لكل (معالج، خدمة): قائمة مجمّعة حسب نوع الحضور، كل عنصر:
  `{ durationOptionId, label, labelAr, durationMins, price (halalas), deliveryType, isInherited, source }`
  حيث `source ∈ { SERVICE_DEFAULT, EMPLOYEE_OWNED, EMPLOYEE_OVERRIDE }`.
- يعيد استخدام منطق `PriceResolver.resolveDurationOption` (TIER 1/TIER 2) — لا تكرار منطق.
- القرار: توسيع `list-employee-services` / `get-employee-service-types` ليتضمن `effectiveDurations`،
  أو endpoint مستقل. يُحسم في خطة التنفيذ بناءً على أقل تغيير على المستهلكين.

**B2 — توصيل حفظ المدد المملوكة.**
- إضافة `PUT employees/:id/services/:serviceId/durations` في `people.controller.ts`
  يستدعي `SetEmployeeDurationsHandler` الموجود (الـ DTO جاهز: مجمّع حسب deliveryType،
  كل عنصر label/labelAr/durationMins/price(halalas)/id اختياري).
- تسجيل الـ handler في الموديول لو لم يكن مسجّلاً.

**B3 — تحديث snapshot الـ OpenAPI + api-client.**
- `pnpm openapi:sync` بعد إضافة/تعديل الـ endpoints، وتحديث `packages/api-client` يدوياً
  إن لزم (hand-written)، وتحديث أنواع الداشبورد المولّدة. كله يُلتزم معاً.

### الفرونت (الداشبورد)

**F1 — مكوّن موحّد `EmployeePricingMatrix`.**
- يحل محل `employee-custom-pricing-row` و `employee-service-types-editor`.
- يستهلك `effectiveDurations` من B1.
- inline edit للخلية → `customPricingMut` / options mutation (تجاوز خيار).
- «إضافة مدة خاصة» → `durationsMut` (B2).
- يُستخدم في: `assigned-employee-row` (تبويب معالجي الخدمة) و `edit-employee-service-sheet` (شيت الموظف).

**F2 — إصلاح `buildEmployeeServiceOptionsPayload`** ليبني payload الفعلي بدل `null`.

**F3 — إصلاح invalidation** بعد الحفظ (queryKeys: services.employees, employees.serviceTypes,
employees.practitionerDurations) لإزالة الـ stale cache (TODO الحالي).

**F4 — حذف/تقليم** المكوّنات المكرّرة بعد التوحيد، وتحديث كل المستوردين.

### خارج النطاق (مهمة لاحقة موثّقة)
- اتساق سعر/مدة المعالج المخصص في الموقع (`service-picker`, `summary-rail`) والموبايل (`confirm`).
  حالياً يعرضان مستوى الخدمة فقط بينما الباك إند يحسب المخصص → فرق محتمل عند الدفع.

## الاختبار

- باك إند: spec لـ endpoint القراءة (B1) يغطّي SERVICE_DEFAULT / EMPLOYEE_OWNED / EMPLOYEE_OVERRIDE
  ولكل نوع حضور؛ spec لـ route الحفظ (B2). `set-employee-durations.handler.spec` موجود.
- فرونت: تحقيق `employee-durations-editor.test` و `assigned-employee-row.spec` الموجودة (تفترض UI المصفوفة)؛
  اختبار المصفوفة: عرض موروث vs مخصص، inline edit، إضافة مدة خاصة.
- تحقّق حي (Definition of Done): تشغيل الداشبورد، تعيين معالج، تعديل خلية، إضافة مدة خاصة،
  ثم حجز فعلي والتأكد أن السعر/المدة المعروضين في معالج الحجز يطابقان المصفوفة.

## معايير القبول

- المدير يرى لكل معالج مصفوفة مدة×حضور بسعر بالريال، مع تمييز الموروث عن المخصص.
- يقدر يتجاوز سعر خلية ويُحفظ ويظهر في حجز فعلي.
- يقدر يضيف مدّة خاصة بالمعالج وتُحفظ وتظهر كخيار عند الحجز.
- لا تكرار: مكوّن مصفوفة واحد مستخدم في المكانين.
- لا cache بائت بعد الحفظ.
- typecheck + الاختبارات + snapshot الـ OpenAPI نظيفة.

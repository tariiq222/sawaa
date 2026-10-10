# دليل إصلاح الأقسام والتصنيفات والخدمات والباقات

النطاق: A053–A076 من تقرير `docs/audits/2026-10-08-dashboard-pages-audit.md`، على أساس `5f6b9ad0b71d55953d16562c8726c92652759ed4` (الأساس الفعلي؛ cfec262 في التكليف كان مرجعًا أقدم) في worktree `dashboard-audit-catalog`. شمل العمل جميع البنود المعيّنة، مع التحقق من الادعاء التاريخي A074 بدل افتراض صحته. التحقق محلي؛ لا نشر ولا بيانات حية ولا ترحيل قاعدة بيانات.

## سجل البنود

في الجدول، مسارات مكونات الواجهة تبدأ من `apps/dashboard/components/features/`، ومسارات الاختبارات الجديدة تبدأ من `apps/dashboard/test/unit/features/catalog/`.

| البند | النتيجة والمصدر | دليل التحقق |
|---|---|---|
| A053 | نموذج `departments/department-form-page.tsx` يرسل `null` لمسح الوصفين والأيقونة. أنواع الواجهة و`UpdateDepartmentDto` تسمح بذلك؛ handler الحفظ كان يحترم `null` أصلًا. | `catalog-edit-forms.test.tsx`: مسح الحقول وإرسالها كـ null؛ اختبارات departments handler الحالية ناجحة. توليد الأنواع عند المنسق مطلوب. |
| A054 | أخفي إجراء الإضافة في رأس القائمة والحالة الفارغة عند غياب `department:create`، في `departments/department-list-page.tsx`. | `catalog-lists.test.tsx`: لا يظهر زر إنشاء القسم دون الصلاحية. |
| A055 | تغيير حالة القسم يعرض نجاحًا أو فشلًا عبر callbacks لعملية الحفظ. | `catalog-lists.test.tsx`: يفحص `catalog.statusSaved` و`catalog.statusError` بعد تغيير الحالة. |
| A056 | أضيف عمود الظهور للموقع في `departments/department-columns.tsx`، وفق `isVisible`. | `catalog-lists.test.tsx`: القسم المخفي يعرض شارة الظهور الصحيحة. |
| A057 | استبدلت قراءة 200 سجل بـ `useDepartment(id)` وGET مباشر. المصدر backend: `modules/org-config/departments/get-department.handler.ts` وcontroller الأقسام. | `get-department.handler.spec.ts`: سجل بعد حد 200، exact ID و404؛ controller spec يفحص وصول GET؛ نموذج القسم يفحص ID الممرر. |
| A058 | تعديل التصنيف يستخدم `useCategory(id)` وGET يدعم UUID وCAT ref. خيارات التصنيفات تستخدم `fetchAllCategories()` التي تجمع كل صفحات السيرفر؛ قائمة التصنيفات تبقى مجزأة. | `catalog-edit-forms.test.tsx`: CAT-25 مع تبويب المعلومات؛ `catalog-api.test.ts`: جمع الصفحات؛ `get-category.handler.spec.ts`: UUID/ref/404 والصورة؛ category controller spec. |
| A059 | `lib/category-payload.ts` يحتفظ بـ `null` للأيقونة واللون والصورة عند التعديل؛ نموذج التصنيف لا يحوّل المسح إلى undefined. | `catalog-payloads.test.ts`: explicit nulls؛ اختبارات update-category handler الحالية ناجحة. |
| A060 | `services/category-list-page.tsx` يستخدم ترقيم `DataTable` من السيرفر، دون ترقيم محلي ثانٍ أو pager خارجي مكرر. | `catalog-lists.test.tsx`: الصف رقم 20 ظاهر، زر Next واحد، ينقل إلى صفحة 2. |
| A061 | `lib/catalog-creation.ts` يحتفظ بالسجل الذي تم إنشاؤه ويشارك الطلب الجاري. `use-category-creation.ts` يعيد تعديل السجل نفسه بعد فشل الرفع. stepper والحقول معطلة أثناء الحفظ، مع قفل ref متزامن؛ نمط الحجز المثبت يقفل بمجرد إنشاء السجل. | `catalog-creation.test.ts`: فشل الخطوة الثانية/إعادة المحاولة/ضغط مزدوج؛ `catalog-category-retry.test.tsx`: إعادة الرفع لنفس ID، مسح الإنجليزية في draft الجديد، وعدم إرسال bookingMode في retry. |
| A062 | create/update/delete/upload للتصنيف تبطل `queryKeys.services.all` مع refetch لجميع النتائج؛ resume يستدعي mutations نفسها. كان backend update-category يبطل كاش الخدمات بالفعل. | `catalog-cache.test.tsx`: تحديث التصنيف ورفع صورته يبطلان ['services']؛ update-category handler spec ناجح. |
| A063 | زر إنشاء التصنيف في الرأس والحالة الفارغة مرتبط بـ `category:create`. | `catalog-lists.test.tsx`: غياب زر الإنشاء دون الصلاحية. |
| A064 | التبويب المطلوب يُقبل فقط إذا كان ضمن تبويبات نمط الحجز الحالي، وإلا يعود إلى info في `services/category-form-page.tsx`. | `catalog-edit-forms.test.tsx`: `?tab=unsupported` يعرض حقول المعلومات والتصنيف الفعلي. |
| A065 | الإنجليزية الفارغة تتحول إلى `null` عند التعديل، مع إبقاء غياب الحقل undefined؛ إنشاء التصنيف يبقيها اختيارية. | `catalog-edit-forms.test.tsx` و`catalog-payloads.test.ts`: مسح الإنجليزية؛ `catalog-category-retry.test.tsx`: المسح بعد إنشاء جزئي. |
| A066 | `useServices` يحتفظ بفلتر الفرع ويمرره إلى API. `ListServicesHandler` يربطه بخدمات موظفين نشطين مرتبطين بالفرع؛ أضيف إبطال الكاش عند تغيير العلاقات/التفعيل/الحذف. | `catalog-service-controls.test.tsx`: تمرير الاختيار؛ `catalog-api.test.ts`: query؛ `list-services.handler.spec.ts`: مرشح active employee/branch والمجموع؛ `catalog-services-cache-invalidation.spec.ts` وspecs الموظفين والفروع. |
| A067 | إنشاء الخدمة يستعمل نفس مساعد الحفظ المستأنف: ينشئ مرة واحدة، ثم يعدل نفس ID ويعيد الصورة/configs. `lib/service-creation.ts` يقرأ الارتباطات ويحذف المستبعد ويضيف غير الموجود فقط ويطبق حالة التفعيل. | `catalog-service-form.test.tsx`: فشل configs مع ضغط مزدوج ثم retry، create مرة واحدة وupdate نفس ID؛ `catalog-service-retry.test.ts`: تخطي الارتباط الموجود ومزامنة draft المعدل؛ مساعد الحفظ العام. |
| A068 | خيارات الترتيب ترسل sortBy/sortOrder للسيرفر؛ `ListServicesHandler` يرتب قبل skip/take مع ID لكسر التعادل. تعطّل الترتيب المحلي لأعمدة الخدمات. defaults مشتركة مع prefetch. | `catalog-service-controls.test.tsx` و`catalog-api.test.ts`؛ handler spec يفحص orderBy مع paging؛ DTO spec يقبل الخيارات ويرفض الحقول/الاتجاهات غير المدعومة. |
| A069 | `ServicesTabContent` يمرر refetch إلى ErrorBanner. | `catalog-service-controls.test.tsx`: زر retry يستدعي طلب القائمة. |
| A070 | رابط القسم في `ServiceBreadcrumb` أصبح `/departments/{id}/edit`. | `catalog-service-controls.test.tsx`: رابط القسم والتصنيف يتجهان إلى المسارات الموجودة. |
| A071 | حفظ تعديل الخدمة يعود إلى الخدمات أو تبويب خدمات التصنيف الأصلي، مثل الإنشاء. | `catalog-service-form.test.tsx`: تعديل ناجح يعود إلى /services؛ اختبار `service-form-category-context.spec.tsx` الحالي يحفظ مسار العودة إلى التصنيف. |
| A072 | (15) `normalizePackageFamilyInput` يحذف الإنجليزية الفارغة في create ويستخدم null في edit للعائلة وخياراتها. (16) `PackageFamilyImageField` يرفع ملفًا ويحفظ storageKey مع معاينة محلية وقفل الحفظ أثناء الرفع. (17) `PackageFamilyCard` يتيح الأرشفة مع تأكيد وصلاحية ورسائل نتيجة، ويستعمل hook الأرشفة الموجود. | `catalog-payloads.test.ts`: normalize create/edit؛ `catalog-image.test.tsx`: upload/preview/storageKey وقفل Save والمسح؛ `catalog-lists.test.tsx`: تأكيد الأرشفة وfamily ID؛ package-family-editor.spec.tsx وpackage-family.handler.spec.ts الحاليان. |
| A073 | بطاقة العائلة تعرض حالة العائلة والظهور، وحالة كل خيار وعدد جلساته وسعره بالريال من halalas؛ قسم العائلات يعرض Skeleton أثناء التحميل. | `catalog-lists.test.tsx`: الحالة والسعر 125 ريالًا من 12500 هللة؛ مصدر `packages/package-list-page.tsx` لحالة التحميل. |
| A074 | ادعاء مسار الرفع نفسه غير منطبق على الأساس الحالي: `uploadPackageImage` كان يحفظ `uploaded.storageKey` أصلًا. عولجت إعادة إرسال الصورة الموقّعة غير المتغيرة في نماذج package/grouped/family/category/service، بحذف الحقل من تحديث الحفظ؛ الرفع الجديد للعائلة يحفظ المفتاح كذلك. | `catalog-api.test.ts`: characterization لمفتاح رفع الباقة مقابل signed URL؛ `catalog-image.test.tsx`: مفتاح رفع العائلة؛ `catalog-service-form.test.tsx`: الصورة الموقعة غير المتغيرة لا ترسل في تعديل الخدمة؛ مراجعة payloads الأخرى في source. |
| A075 | حالة تحميل مسار `/packages/[id]` تستعمل `common.loading` من locale. | `catalog-package-route.test.tsx`: النص المحلي أثناء التحميل. |
| A076 | المسار يعرض خطأ مع إعادة محاولة أو حالة غير موجود، ولا يحول إلا عند حصوله على السجل. | `catalog-package-route.test.tsx`: failure/retry، missing، loading ثم redirect ناجح. |

## نطاق التوسعة المتفق عليه

إبطال `SERVICES_CACHE_PREFIX` فقط بعد نجاح mutations في handlers إنشاء/تعديل/حذف الموظف، إسناد/حذف/تعديل خدمة الموظف، onboarding للفروع والخدمات، وإسناد/فصل الموظف عن الفرع. أضيف CacheService إلى constructors وإلى mocks الاختبارات. في `identity/employee-account/account-boundaries.spec.ts` تغيرت تهيئة constructors فقط؛ حدود الصلاحيات واختباراتها بقيت ناجحة. المنسق يضيف إبطال ['services'] إلى mutations الموظفين في لوحة الإدارة.

## تحقق محلي حديث

كل أمر pnpm نُفذ عبر wrapper البيئة الاصطناعية `/Users/tariq/.codex/release-evidence/2026-10-10-four-groups-integration/run-safe.mjs`، دون DB أو خدمات حية. تركيب dependencies كان offline/frozen/ignore-scripts، وتوليد Prisma client وبناء shared المحلي لا يشملان ترحيلًا.

- Dashboard: الدفعة المركزة التالية **122 اختبارًا في 22 ملفًا، ناجحة**؛ وأضيف بعدها `catalog-service-form.test.tsx` منفردًا **2/2 ناجحة**، فيكون نطاق التحقق 124 اختبارًا في 23 ملفًا. السجلات: `/tmp/catalog-dashboard-final.log` و`/tmp/catalog-service-form.log`.
- Backend: **187 اختبارًا في 20 ملفًا، ناجحة**؛ `/tmp/catalog-backend-final.log`.
- RED/GREEN: مساعد الحفظ فشل قبل الإصلاح في ثلاث حالات تكرار/تزامن، API/nullable payloads كشف فقد الحقول/الصفحات، endpoint GET فشل قبل إضافته، وكاش علاقات الموظفين فشل في 9 حالات قبل إصلاحه. حذف الموظف أظهر حالتي فشل cache ثم نجح. إخفاقات mocks/ResizeObserver أثناء توسيع UI tests أصلحت في الاختبارات فقط، ولا تعد دليل RED سلوكي.
- `tsc --noEmit`: بقي خطآن فقط في `lib/api/departments.ts` لأن generated OpenAPI على الأساس القديم يمنع null. backend DTO الآن يصرح nullable؛ يلزم المنسق توليد snapshot/types قبل الفحص المتكامل والدمج. هذا الفحص **ليس نجاحًا** في worktree العامل.
- pre-commit hooks: فحص ESLint للملفات staged وlegacy multi-tenant guard؛ إصلاح type casts غير لازمة في اختبارين بعد كشفها من hook. لا فحص lint شامل.
- `git diff --check`: ناجح. مفاتيح `ar.audit-catalog.ts` و`en.audit-catalog.ts` متطابقة (20 مفتاحًا).

أمر Dashboard:

```sh
pnpm --dir apps/dashboard exec vitest run test/unit/features/catalog test/unit/components/features/packages/package-family-editor.spec.tsx test/unit/lib/categories-api.spec.ts test/unit/lib/departments-api.spec.ts test/unit/lib/services-api.spec.ts test/unit/hooks/use-services-queries.spec.tsx test/unit/hooks/use-services-mutations.spec.tsx test/unit/hooks/use-departments.spec.tsx test/unit/services/category-kind-booking-fields.spec.tsx test/unit/services/service-form-category-context.spec.tsx test/unit/services/category-direct-service-admin.spec.tsx test/unit/services/service-catalog-presentation.spec.tsx
```

أمر Backend (مسارات الملف المكتوبة أعلاه تبدأ من apps/backend):

```sh
pnpm --dir apps/backend exec jest --runInBand src/modules/org-config/categories/get-category.handler.spec.ts src/modules/org-config/departments/get-department.handler.spec.ts src/modules/org-config/categories/update-category.handler.spec.ts src/modules/org-config/departments/departments.handler.spec.ts src/modules/org-experience/services/list-services.handler.spec.ts src/modules/org-experience/services/list-services.dto.spec.ts src/modules/org-experience/package-families/package-family.handler.spec.ts src/api/dashboard/organization-categories.controller.spec.ts src/api/dashboard/organization-departments.controller.spec.ts src/modules/org-experience/services/catalog-services-cache-invalidation.spec.ts src/modules/people/employees/assign-employee-service.handler.spec.ts src/modules/people/employees/remove-employee-service.handler.spec.ts src/modules/people/employees/update-employee-service.handler.spec.ts src/modules/people/employees/update-employee.handler.spec.ts src/modules/people/employees/create-employee.handler.spec.ts src/modules/people/employees/delete-employee.handler.spec.ts src/modules/people/employees/employee-onboarding.handler.spec.ts src/modules/org-config/branches/assign-employee-to-branch.handler.spec.ts src/modules/org-config/branches/unassign-employee-from-branch.handler.spec.ts src/modules/identity/employee-account/account-boundaries.spec.ts
```

## تسليم العقد والفحوص للمنسق

- GET `/api/v1/dashboard/organization/departments/{departmentId}`: UUID، DepartmentResponseDto، صلاحية read:Department، 404.
- GET `/api/v1/dashboard/organization/categories/{categoryId}`: UUID أو CAT reference، CategoryResponseDto مع image signed عند القراءة وdepartment، صلاحية read:Category، 404.
- UpdateDepartmentDto: descriptionAr/descriptionEn/icon قابلة لـ null؛ نفس handler semantics.
- ListServicesDto: branchId/departmentId UUID؛ sortBy في createdAt/nameAr/nameEn/price/durationMins/isActive، وsortOrder asc/desc. defaults createdAt/desc.
- مطلوب `pnpm openapi:sync` في دفعة التكامل، snapshot/generated dashboard types ومراجعة hand-written api-client إن تأثر. لم يعدل العامل هذه الملفات المشتركة.
- تسجيل exports `arAuditCatalog` و`enAuditCatalog` من ملفات الترجمة الجديدة في registry يملكه المنسق.
- اختبارات DIRECT/الهوية المخفية ونمط الحجز غير القابل للتبديل الحالية نجحت؛ لم يتغير هذا العقد ولا encryption/AAD/constants/VAT0 ولا auth guards.
- كامل suite/build/lint، dashboard smoke، browser acceptance، وفحوص develop يملكها المنسق؛ لم ينفذها العامل ولم يدّع نجاحها. لا قبول staging أو owner acceptance في هذا الدليل.
- استهلاك worker tokens والقياس المقارن غير متاحين؛ attribution غير معلوم. سجل baseline/coordinator يملكه المنسق.

# Objective

إصلاح مساري العمل اللذين أبلغ عنهما المستخدم بصورة قابلة للنشر والتحقق:

1. تمكين المخوّلين من تعديل بريد الممارس/المعالج مع منع التعارض بين بريد ملف الموظف وبريد حساب الدخول.
2. استعادة تحصيل الدفعات واستعادة حالة «لم يحضر» في الإنتاج، ثم إغلاق عيوب عقد الدفع والتحقق والنشر التي قد تعيد المشكلة.

الأولوية التشغيلية هي إثبات وإزالة تفاوت النسخ بين الداشبورد والباكند؛ فالرسالتان الظاهرتان في الصور (`Cannot POST .../collect` و`Cannot PATCH .../restore-no-show`) تخصان مسارين موجودين ومسجلين في المستودع الحالي.

# Current-State Findings

- المستودع الحالي كبير ومتعدد الطبقات: Dashboard + Backend + OpenAPI/API clients + CI/E2E + نشر؛ لذلك الخطة مرحلية.
- توجد تعديلات محلية غير مرتبطة بالمهمة في ملفات AI/chat. يجب الحفاظ عليها وعدم إدخالها في أي commit خاص بهذه الإصلاحات.
- بريد الممارس مقفول عمداً في واجهة التعديل:
  - `apps/dashboard/components/features/employees/employee-form-page.tsx` يمرر `showEmail={!isEdit}`.
  - `apps/dashboard/components/features/employees/basic-info-tab.tsx` يعرض البريد `readOnly` عند التعديل.
  - `apps/dashboard/components/features/employees/use-employee-form.ts` لا يحمّل البريد في النموذج ولا يرسله في payload التعديل.
- الباكند يقبل `email?` في `UpdateEmployeeDto` ويكتبه على `Employee.email`، لكنه لا يزامن `User.email` للحساب المرتبط ولا يحول تعارضات التفرد إلى 409 واضح. لهذا فإن فتح الحقل في الواجهة وحده قد يصنع اختلافاً بين بريد الملف وبريد تسجيل الدخول.
- صلاحية تعديل ملف الموظف هي `update:Employee`؛ لا تشمل موظف الاستقبال بحسب القواعد المضمّنة الحالية. لا تتطلب الخطة تغيير CASL.
- عقد التحصيل الحالي متسق محلياً على `POST /api/v1/dashboard/finance/bookings/:bookingId/collect` في controller وOpenAPI والداشبورد و`packages/api-client`.
- عقد استعادة عدم الحضور متسق محلياً على `PATCH /api/v1/dashboard/bookings/:id/restore-no-show`، ومسجل في `BookingsModule` و`AppModule` ومغطى باختبارات مركزة ناجحة.
- ظهور `Cannot POST/PATCH` في الإنتاج يرجح بقوة أحد احتمالين يجب إثباتهما قبل تعديل منطق المجال:
  1. داشبورد أحدث من ثنائي الباكند المنشور.
  2. مسار `/api/proxy` لا يمر عبر rewrite الخاص بـ Next أو أن `NEXT_PUBLIC_API_URL` مركب بشكل خاطئ.
- لا يعرض health endpoint حالياً رقم إصدار أو Git SHA، ولا يوجد معرّف عقد مشترك بين ثنائي الداشبورد والباكند.
- CI يتحقق من drift في `apps/backend/openapi.json` وعميل `packages/api-client`، لكنه يشغّل `pnpm openapi:sync || true` في job الداشبورد ولا يفحص استدعاءات `apps/dashboard/lib/api/*` ضد OpenAPI.
- Smoke الحالي لا يغطي mutation تحصيل الدفع ولا استعادة عدم الحضور عبر proxy الإنتاجي.
- عيوب دفع إضافية مؤكدة في الواجهة/الاختبارات:
  - E2E قديم ما زال ينتظر مساري `/payments` و`/discount` بدلاً من `/collect`.
  - `Number()` لا يقبل الأرقام العربية مثل `٢٢٥`، وقد ينتج زر معطل أو قيمة صفر.
  - الواجهة لا ترسل `idempotencyKey` رغم دعم الباكند له.
  - خصم 100% مدعوم في الباكند (`payment: null`) لكن الواجهة تمنعه بسبب اشتراط مبلغ أكبر من صفر.
  - الواجهة تسمح بمبلغ جزئي قد يرفضه invariant العربون في الباكند، من دون شرح مسبق للمستخدم.
  - تطبيق الخصم ثم تسجيل الدفع عمليتان متتاليتان؛ فشل الثانية قد يترك الخصم محفوظاً بلا دفعة. تحويلهما إلى عملية ذرية تغيير مدفوعات عالي الحساسية ويحتاج موافقة المالك.

# Scope

## In Scope

- تشخيص production skew باستخدام status/body ونسخ البناء، ثم نشر الباكند والداشبورد بترتيب آمن.
- جعل بريد الممارس قابلاً للتعديل للمستخدم الذي يملك الصلاحية الحالية.
- التحقق من البريد وتفرده وإظهار تعارض مفهوم، وتحديد السلوك الصريح للحساب المرتبط.
- إصلاح تحصيل الدفع اليدوي: عقد `/collect`، تطبيع الأرقام، idempotency، خصم 100%، ورسائل حدود العربون.
- اختبار مسار استعادة عدم الحضور ونشره؛ لا يُعدّل منطق المجال ما لم يفشل بعد تطابق النسخ.
- إضافة مراقبة نسخة/عقد، بوابات OpenAPI، واختبارات smoke على mutations الفعلية عبر proxy.
- تحديث OpenAPI والعميل اليدوي والأنواع المولدة فقط إذا تغير عقد endpoint فعلاً.

## Blocking Decisions

- **قرار البريد (موصى به):** اعتبار البريد قيمة موحدة للممارس؛ عند وجود حساب `User` مرتبط، يُحدّث `Employee.email` و`User.email` ذرياً، مع بقاء الجلسات الحالية صالحة ما لم يقرر المالك صراحة إبطالها. هذا يلامس الهوية ويتطلب موافقة المالك قبل التنفيذ.
- **قرار ذرية الدفع (موصى به):** جعل «الخصم + الدفعة» معاملة واحدة أو توفير rollback مضمون. هذا تغيير Payments owner-only ويتطلب موافقة المالك واختبار Moyasar sandbox للحدود ذات الصلة.
- **قرار النشر:** تحديد منصة النشر الفعلية وآلية معرفة SHA الحاليين قبل أي نشر؛ هذه المعلومات غير موجودة في ملفات CI التي تم فحصها.

# Non-Goals

- لا تغيير لقواعد CASL أو أدوار المستخدمين أو guards أو token claims.
- لا تعديل أو تدوير أسرار Moyasar أو التشفير أو AAD.
- لا تعديل migrations موجودة، ولا يتوقع إنشاء migration لهذا الإصلاح.
- لا إعادة تصميم شاملة لنظام الفواتير أو طرق الدفع أو إضافة بوابة دفع جديدة.
- لا تغيير منطق `restore-no-show` الموثق (NO_SHOW → CONFIRMED وآثار الرصيد/البرنامج) ما لم تثبت اختبارات الثنائي المنشور خللاً مستقلاً عن تفاوت النسخ.
- لا معالجة لملفات AI/chat المعدلة محلياً، ولا تضمينها في commits الإصلاح.
- لا اختبار مدفوع أو مدمر على بيانات الإنتاج؛ التحقق الكتابي يكون على staging/sandbox أو بيانات اختبار مصرح بها.

# Acceptance Criteria

## Email

- **AC-EMAIL-001:** عند فتح ممارس موجود بواسطة مستخدم يملك `update:Employee` يظهر البريد في حقل قابل للتعديل، ويُحمل بالقيمة الحالية، ويمكن إضافة بريد إذا كان فارغاً.
- **AC-EMAIL-002:** بريد غير صالح يُرفض في الواجهة والباكند من دون تغيير `Employee` أو `User`.
- **AC-EMAIL-003:** بريد مستخدم بواسطة ممارس أو مستخدم آخر يعيد 409 برسالة عربية/إنجليزية مفهومة، من دون كشف بيانات صاحب البريد ومن دون تعديل جزئي.
- **AC-EMAIL-004:** بعد الحفظ الناجح تتحدث شاشة التفاصيل والقائمة وتبويب الحساب من الكاش المعاد جلبه.
- **AC-EMAIL-005:** إذا وافق المالك على البريد الموحد وكان للممارس حساب دخول، تُحدّث القيمتان في transaction واحدة؛ نجاح تحديث واحدة وفشل الأخرى ممنوع.
- **AC-EMAIL-006:** لا يكتسب موظف الاستقبال صلاحية تعديل البريد نتيجة الإصلاح، ولا تتغير سياسات CASL.

## Payments and Bookings

- **AC-PAY-001:** ثنائي الإنتاج المسجل يعيد نتيجة endpoint فعلية، لا `Cannot POST/PATCH`، لكل من `/collect` و`/restore-no-show` عبر مسار الداشبورد `/api/proxy`.
- **AC-PAY-002:** مستخدم استقبال مخول يستطيع تسجيل دفع يدوي صالح في staging فيحصل على 201، ويعود `invoice.outstanding` و`invoice.status` بعد الدفع بالقيم الجديدة.
- **AC-PAY-003:** إدخال `225` أو `٢٢٥` أو `۲۲۵` ينتج المبلغ نفسه بالهللات؛ القيم السالبة أو غير الرقمية أو الأكبر من المستحق لا ترسل mutation.
- **AC-PAY-004:** إعادة نفس محاولة التحصيل بعد timeout بالمفتاح نفسه لا تنشئ Payment ثانياً وتعيد نفس نتيجة الدفعة.
- **AC-PAY-005:** خصم 100% مع سبب صالح ينجح، يعيد `payment: null`، ولا ينشئ صف دفع صفري.
- **AC-PAY-006:** عندما يطبق نظام العربون، تعرض الواجهة الخيارات التي يقبلها الباكند فقط أو رسالة توضح المبلغ المقبول قبل الإرسال؛ لا يعتمد المستخدم على 400 مبهم.
- **AC-PAY-007:** `ONLINE_CARD` لا يمر عبر التحصيل اليدوي ولا ينشئ صف بطاقة من دون webhook؛ اختبارات Moyasar sandbox لا تستخدم بيانات أو تكلفة إنتاج.
- **AC-PAY-008:** إذا نُفذت الذرية، فإن فشل تسجيل الدفع بعد محاولة الخصم لا يترك invoice مخفضة بلا Payment؛ يثبت ذلك اختبار failure injection.
- **AC-BOOK-001:** استعادة حجز `NO_SHOW` صالح تعيد 200 وتحدث القوائم؛ حالة أخرى أو reason خارج 3–500 تُرفض من دون أثر جانبي.
- **AC-BOOK-002:** استعادة عدم الحضور لا تنشئ refund ولا تغير Payment، وتحافظ على سلوك package credit/program enrollment الحالي.

## Release Safety

- **AC-REL-001:** health/live يعرضان build version أو Git SHA غير سري يمكن مقارنته بسجل النشر.
- **AC-REL-002:** CI يفشل إذا drift توليد عميل الداشبورد أو OpenAPI؛ لا توجد خطوة `|| true` تخفي الفشل.
- **AC-REL-003:** smoke يبني ويشغل ثنائيات الإنتاج (`node dist/main.js` و`next start`) ويختبر POST collect وPATCH restore-no-show عبر `/api/proxy`.
- **AC-REL-004:** النشر يتم backend-first ثم اختبار contract ثم dashboard، مع rollback موثق إذا فشل smoke.

# Execution Phases

## Phase 0 — Production Triage and Safe Recovery

1. التقط status code وresponse headers/body المنقحة للطلبين، وSHA/وقت بناء كل خدمة، وقيمة base URL بشكل غير سري.
2. اختبر route discovery على staging/بيئة مصرح بها: 404 Express الافتراضي يعني route/edge skew؛ 403 يعني صلاحيات؛ 400 يعني validation/state.
3. طابق ثنائي الباكند مع commit الذي يحتوي `/collect` و`restore-no-show`، ثم انشر الباكند أولاً.
4. نفذ smoke مباشر للباكند ثم smoke عبر `/api/proxy`، وبعد نجاحهما انشر الداشبورد المطابق.
5. لا تغيّر منطق الدفع أو الحجز قبل إغلاق فرضية تفاوت النسخ.

## Phase 1 — Practitioner Email Contract (Owner Approval Gate)

1. حسم البريد الموحد مقابل بريد اتصال منفصل. التوصية: بريد موحد مع transaction عند وجود حساب مرتبط.
2. وسّع اختبارات DTO/handler أولاً: happy path، self unchanged، تعارض Employee، تعارض User، وحظر partial update.
3. نفذ تحديث `Employee.email` ومعه `User.email` عند الارتباط داخل transaction بعد موافقة المالك، وحول uniqueness إلى 409 آمن.
4. لا تغيّر guard أو role. وثّق أثر تغيير بريد الدخول في UX ورسالة النجاح.
5. فعّل الحقل في نموذج التعديل، حمّل القيمة، أرسلها في `UpdateEmployeePayload`، وأعد إبطال detail/list/account queries.
6. أضف اختبارات component/hook/API وE2E للممارس ذي الحساب وبدونه.

## Phase 2 — Payment Collection Correctness (Owner Approval Gate)

1. حدّث اختبارات الواجهة وE2E لتستخدم `/bookings/:id/collect` كالعقد الوحيد للتحصيل المركب.
2. أضف utility نقود/أرقام مشتركة لتطبيع الأرقام العربية والفارسية قبل parsing، مع اختبارات حدود.
3. أنشئ `idempotencyKey` ثابتاً لكل فتح/محاولة من الحوار وأرسله؛ لا تولد مفتاحاً جديداً عند retry لنفس العملية.
4. اسمح بمسار خصم 100% من دون Payment، مع success state واضح.
5. اجعل الواجهة متوافقة مع قاعدة العربون: full outstanding أو deposit المقبول حسب بيانات الباكند، ولا تعرض partial arbitrary إذا كان سيرفض.
6. بعد موافقة المالك، اجعل الخصم والدفع ذرّيين أو أضف compensation موثوقاً؛ أضف اختبار failure injection وconcurrent retries.
7. اختبر حدود ONLINE_CARD/PENDING في Moyasar sandbox فقط، ثم نفذ dashboard smoke الإلزامي.

## Phase 3 — Contract and Deployment Hardening

1. أضف build metadata (version/Git SHA) إلى health response من env آمن.
2. وحّد صيغة `NEXT_PUBLIC_API_URL`، واختبر rewrite من `/api/proxy` إلى `/api/v1` كعقد.
3. اجعل توليد dashboard types حتمياً من `apps/backend/openapi.json` الملتزم أو شغّل باكند موثوقاً؛ أزل `|| true`.
4. وسّع drift checker ليغطي `apps/dashboard/lib/api/*` بالإضافة إلى `packages/api-client`.
5. أضف smoke mutations للـ collect والـ restore-no-show، وشغله على build الإنتاج لا dev startup.
6. وثّق release order وrollback: backend → contract smoke → dashboard → post-deploy smoke.

## Phase 4 — Final Regression and Release Evidence

1. شغّل الاختبارات المركزة لكل surface، ثم typecheck/lint/i18n.
2. شغّل OpenAPI sync/drift فقط إذا تغير العقد؛ احفظ snapshot والأنواع والعميل اليدوي معاً.
3. شغّل backend unit/e2e، dashboard unit/smoke، وMoyasar sandbox checks المعتمدة.
4. راجع diff للتأكد من عدم دخول ملفات AI/chat المحلية أو أسرار/بيانات إنتاج.
5. سجل SHA المنشور ونتائج post-deploy لكل AC قبل الإغلاق.

# Checklist

- [ ] **[luna-worker]** جمع دليل production skew — الملفات: سجلات النشر/health و`apps/backend/src/main.ts`, `apps/dashboard/next.config.mjs`; **تم عند:** تصنيف كل فشل 404/403/400 وتوثيق SHA للخدمتين بلا أسرار.
- [ ] **[luna-worker]** استعادة المسارين تشغيلياً backend-first — الملفات: إعدادات النشر الفعلية؛ **تم عند:** POST collect وPATCH restore-no-show لا يعيدان `Cannot ...` عبر proxy.
- [ ] **[grok-worker]** اعتماد عقد البريد الموحد مع المالك — الملفات: `apps/backend/src/modules/people/employees/update-employee.handler.ts`, `apps/backend/src/modules/identity/employee-account/*`; **تم عند:** قرار مكتوب حول مزامنة بريد الدخول والجلسات.
- [ ] **[grok-worker]** تنفيذ تحقق/تفرد/ذرية بريد الممارس — الملفات: `update-employee.dto.ts`, `update-employee.handler.ts` واختباراتهما؛ **تم عند:** AC-EMAIL-002/003/005 خضراء ولا تغيير CASL.
- [ ] **[luna-worker]** تمكين واجهة تعديل البريد — الملفات: `employee-form-page.tsx`, `basic-info-tab.tsx`, `use-employee-form.ts`, `lib/types/employee.ts`, `hooks/use-employee-mutations.ts`; **تم عند:** AC-EMAIL-001/004/006 خضراء.
- [ ] **[luna-worker]** إضافة regression tests للبريد — الملفات: `apps/dashboard/test/unit/features/employees/*`, `apps/dashboard/test/unit/hooks/use-employee-mutations.spec.tsx`, `apps/dashboard/test/unit/lib/employees-api.spec.ts`, E2E employees؛ **تم عند:** تعديل/تعارض/حساب مرتبط مغطاة.
- [ ] **[luna-worker]** تحديث contract tests للتحصيل — الملفات: `record-payment-dialog.spec.tsx`, `payments-api.spec.ts`, `bookings-record-payment.spec.ts`; **تم عند:** لا انتظار لمساري payment+discount القديمين في تدفق collect.
- [ ] **[grok-worker]** تطبيع الأرقام وخصم 100% وidempotency — الملفات: `record-payment-dialog.tsx`, utility نقود مناسب، `lib/api/payments.ts`, `hooks/use-payments.ts`; **تم عند:** AC-PAY-003/004/005 خضراء.
- [ ] **[grok-worker]** مواءمة العربون وإغلاق partial-state بعد موافقة المالك — الملفات: `collect-booking-payment/*`, `process-payment/*`, `apply-invoice-discount/*`; **تم عند:** AC-PAY-006/008 مثبتة باختبارات failure/concurrency.
- [ ] **[luna-worker]** تثبيت حدود Moyasar — الملفات: اختبارات finance ذات الصلة فقط؛ **تم عند:** AC-PAY-007 يمر في unit وsandbox بلا أثر إنتاجي.
- [ ] **[luna-worker]** إضافة build metadata — الملفات: health controller/handler واختباراتهما، إعداد build env؛ **تم عند:** AC-REL-001 ظاهر وغير حساس.
- [ ] **[grok-worker]** تشديد OpenAPI/proxy/CI — الملفات: `.github/workflows/ci.yml`, scripts drift، `apps/dashboard/next.config.mjs`, smoke specs؛ **تم عند:** AC-REL-002/003 تفشلان عمداً عند حذف route أو كسر rewrite ثم تمران عند العقد الصحيح.
- [ ] **[luna-worker]** مزامنة العقود — الملفات: `apps/backend/openapi.json`, `apps/dashboard/lib/types/api.generated.ts`, `packages/api-client/src/modules/payments.ts` عند الحاجة فقط؛ **تم عند:** `pnpm openapi:sync` وdrift checks بلا diff غير ملتزم.
- [ ] **[luna-worker]** تحقق نهائي ونشر — الملفات: لا تعديل جديد؛ **تم عند:** كل أوامر Validation خضراء، dashboard smoke وpost-deploy smoke ناجحان، وملفات AI/chat غير مضمنة.

# Dependencies

- موافقة المالك مطلوبة قبل أي تغيير في مزامنة `User.email` أو سلوك الجلسات، وقبل تعديل منطق/ذرية الدفع أو اختبار Moyasar.
- الوصول إلى معلومات منصة النشر وSHA للخدمتين وسجلات edge/proxy؛ لا توجد pipeline نشر كاملة في `.github/workflows/ci.yml`.
- Postgres/Redis/MinIO محلياً لاختبارات التكامل، وبيئة Moyasar sandbox للحدود الموافق عليها.
- تنفيذ Phase 0 يسبق التغييرات المنطقية؛ Phase 1 وPhase 2 يمكن تنفيذهما بالتوازي بعد بوابات الموافقة، وPhase 3 يمكن أن يبدأ بعد تثبيت عقدي route.
- لا dependency على migration متوقعة؛ إذا اكتُشفت حاجة schema، يوقف المنفذ ويطلب موافقة منفصلة ويضيف migration جديدة فقط.

# Validation

## Focused

```bash
pnpm --filter=backend test -- src/modules/people/employees/update-employee.handler.spec.ts
pnpm --filter=backend test -- src/modules/people/employees/update-employee.dto.spec.ts
pnpm --filter=backend test -- src/modules/finance/collect-booking-payment/collect-booking-payment.handler.spec.ts
pnpm --filter=backend test -- src/api/dashboard/bookings.controller.spec.ts
pnpm --filter=dashboard test -- test/unit/features/bookings/record-payment-dialog.spec.tsx
pnpm --filter=dashboard test -- test/unit/lib/payments-api.spec.ts
pnpm --filter=dashboard test -- test/unit/lib/employees-api.spec.ts
pnpm --filter=dashboard test -- test/unit/hooks/use-employee-mutations.spec.tsx
```

## Contracts and End-to-End

```bash
pnpm openapi:sync
node scripts/check-api-client-drift.mjs
pnpm --filter=backend run test:e2e
pnpm --filter=dashboard run e2e -- e2e/flows/employees/<employee-email-spec>.spec.ts
pnpm --filter=dashboard run e2e -- e2e/flows/bookings/bookings-record-payment.spec.ts
pnpm --filter=dashboard run e2e -- e2e/flows/bookings/bookings-status-workflow.spec.ts
pnpm --filter=dashboard run e2e:smoke
```

## Repository Gates

```bash
pnpm typecheck
pnpm lint
pnpm --filter=dashboard run i18n:verify
pnpm test
pnpm build
git diff --check
git status --short
```

## Post-Deploy Evidence

- سجل Git SHA للباكند والداشبورد من health/release metadata.
- نفذ synthetic smoke ببيانات اختبار مصرح بها: تعديل بريد ممارس، تحصيل نقدي صغير/اختباري، واستعادة NO_SHOW.
- تحقق أن كل request مر من `/api/proxy` إلى `/api/v1` وأن response ليس Express fallback.
- راقب عدم وجود Payment مكرر أو invoice مخفضة جزئياً بعد retry/failure.

# Risks

- **هوية/دخول (Critical):** مزامنة `User.email` قد تغير اسم الدخول وتتصادم مع مستخدم آخر؛ يجب transaction و409، ولا تغيير token semantics بلا موافقة مستقلة.
- **مدفوعات (Critical):** أي خطأ في الوحدات ريال/هللات أو retry قد يكرر الدفع أو يغير المستحق؛ idempotency واختبارات الحدود إلزامية.
- **Moyasar (Critical):** يمنع استخدام production credentials أو تنفيذ charge حقيقي في التحقق؛ sandbox فقط وبموافقة المالك.
- **تفاوت النشر (High):** نشر الداشبورد قبل الباكند يعيد نفس `Cannot POST/PATCH`; الترتيب والـ smoke بين المرحلتين إلزاميان.
- **Partial state (High):** الخصم قبل الدفع غير ذري حالياً؛ لا يعتبر الإصلاح مكتملاً للسيناريو المركب حتى وجود transaction/compensation مع اختبار فشل.
- **صلاحيات (High):** لا توسع دور الاستقبال لتعديل البريد أو تغير guards كحل سريع.
- **OpenAPI drift (Medium):** وجود route في snapshot لا يثبت أنه منشور؛ build SHA وpost-deploy route smoke مطلوبان.
- **Workspace contamination (Medium):** ملفات AI/chat المعدلة محلياً يجب ألا تُستبدل أو تُرحل أو تدخل commit الإصلاح.

# Handoff to Executor

ابدأ بـ Phase 0 ولا تفترض أن رسالة `Cannot POST/PATCH` عيب منطق في المستودع الحالي. اطلب موافقة المالك عند بوابتي البريد المرتبط بحساب الدخول وذرية الدفع/Moyasar. بعد إزالة تفاوت النسخ، نفذ Phase 1 وPhase 2 في workstreams منفصلين، ثم Phase 3 وPhase 4. لا تعدل auth guards أو CASL أو migrations، وحافظ على تعديلات AI/chat المحلية خارج النطاق.

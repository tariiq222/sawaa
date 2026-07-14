# تصميم إغلاق ملاحظات التحليل الشامل

> التاريخ: 2026-07-09
> المصدر: `docs/system-analysis-report-2026-07-09.md`
> الحالة: معتمد مبدئيًا من المالك، وينتظر مراجعة المواصفات المكتوبة قبل خطة التنفيذ

## الهدف

إغلاق الملاحظات الأمنية والتشغيلية وجودة المنتج على مراحل قابلة للتحقق، مع الحفاظ على العقود الحالية وتجنب تعطيل المستخدمين أو تغيير تدفقات العمل السليمة. لا يتضمن العمل إعادة كتابة النظام أو تحويله إلى microservices.

## مبادئ التوافق

1. لا يُحذف endpoint مستخدم ولا يتغير response shape قائم دون مسار توافق واختبارات مستهلكيه.
2. لا تتغير صلاحيات المستخدم إلا عندما تكون الحالة الحالية fail-open أو تكشف بيانات غير مصرح بها. هذه التغييرات الأمنية المقصودة توثق صراحة.
3. passwordless OTP يبقى متاحًا للأدوار العادية. عند تفعيل `security.twoFactor.required` للمشرف الأعلى فقط، يصبح password challenge شرطًا قبل OTP.
4. لا تُعاد كتابة migrations مطبقة؛ أي تغيير schema يكون migration إضافية فقط.
5. Webhook/provider operations تبقى idempotent ولا تتكرر الآثار المالية عند retries.
6. تغييرات Dashboard الحالية في working tree تخص المستخدم؛ لا تُستبدل ولا تُحذف، وأي تعديل متداخل يكون محدودًا ومثبتًا بالاختبارات.
7. لا commit ولا push ولا deploy دون طلب صريح.
8. كل bugfix يبدأ باختبار يفشل للسبب الصحيح، ثم أقل تغيير يجعله ينجح.

## تقسيم العمل

المشروع كبير ومتعدد الحدود، لذلك ينفذ عبر أربع حزم مستقلة. كل حزمة يجب أن تكون قابلة للمراجعة والاختبار والتوقف الآمن قبل بدء التالية.

### الحزمة A — P0: الأمن والخصوصية

#### A1. إسقاط حقول Client الحساسة من Employee Mobile API

يُعرّف projection/DTO خاص بالمستشار يعيد أقل بيانات لازمة للقائمة. يمنع صراحة حقول المصادقة (`passwordHash`, `tokenVersion`, `loginAttempts`, `lockoutUntil`) والبيانات الصحية/الإدارية غير اللازمة (`nationalId`, `allergies`, `chronicConditions`, `notes`, `source`, emergency fields) ما لم يثبت endpoint منفصل بصلاحية واضحة الحاجة إليها.

الاختبار الخارجي يفشل إذا ظهر أي حقل محظور، ويتأكد أن الاسم والمعرف وبيانات الاتصال اللازمة ما زالت تصل.

#### A2. Empty permissions تعني deny-all

يميز CASL بين:

- `permissions === undefined`: fallback قديم للحالات التي لا تزود strategy فيها القائمة.
- `permissions === []`: مصدر DB حاضر وصريح، والنتيجة قدرة بلا صلاحيات.
- SUPER_ADMIN: يبقى `manage:all` حسب القاعدة الحالية.

تُحدّث اختبارات factory والguard بحيث تفشل الحالة القديمة وتثبت السلوك الجديد، مع اختبار positive للصلاحيات غير الفارغة.

#### A3. 2FA للمشرف الأعلى دون كسر passwordless OTP

بعد نجاح كلمة المرور للمشرف الأعلى ومع تفعيل الإعداد، لا يصدر access/refresh قابلان للاستخدام. يصدر challenge قصير العمر وأحادي الاستخدام مربوط بـuser id وpurpose وtoken version. طلب/تحقق OTP في مسار 2FA يحتاج challenge، ويصدر tokens الكاملة بعد استهلاكه.

مسار passwordless OTP العادي يبقى متاحًا للأدوار غير الخاضعة للإعداد. لا يجوز للمشرف الأعلى الخاضع لـ2FA استخدام مسار passwordless لتجاوز كلمة المرور. التحقق يفشل عند challenge مفقود، منتهي، مستخدم، أو صادر لمستخدم آخر.

#### A4. Mobile refresh single-flight

توجد Promise واحدة مشتركة لكل عملية refresh. كل 401 متزامنة تنتظرها ثم تعيد الطلب بالرمز الجديد. لا تحذف الرموز عند فشل طلب تابع إذا نجحت عملية refresh أخرى. عند فشل العملية المشتركة فعليًا، يحدث logout مرة واحدة.

الاختبار يطلق طلبين متزامنين ويثبت استدعاء endpoint refresh مرة واحدة، نجاح الإعادتين، وحفظ الرموز الجديدة.

#### A5. حماية النسخ المحلية وDocker context

تضاف `.sawaa-data/`, `outputs/`, `.secrets/`, وملفات dumps إلى `.dockerignore`. لا تُحذف النسخ الحالية تلقائيًا. تُشدد صلاحيات الملفات المحلية إلى owner-only كإجراء machine-local موثق، دون نقل أو رفع البيانات. أي تشفير/نقل دائم يحتاج مسار عمليات منفصل لأن مكان التخزين المستهدف قرار تشغيلي.

### الحزمة B — P1: الموثوقية والسياسات التشغيلية

#### B1. Telemetry singleton

ينشأ `TelemetryModule` عالمي يملك `AppMetricsService` و`DbMetricsService` ويصدرهما. تحذف provider duplicates من Root/Public/Ops/Finance ويُستهلك singleton نفسه. اختبار integration يسجل HTTP/audit/payment/DB metric ثم يقرأ scrape output ويجدها.

#### B2. Graceful shutdown coordinator

يُستخرج tracker صغير يسجل request start ويخفض مرة واحدة فقط عند أول `finish` أو `close`. لا يسمح بعداد سالب، ويوفر `waitForDrain(deadline)`. اختبار الوحدة يغطي finish ثم close، close فقط، وtimeout مع طلب نشط.

#### B3. Webhook retry claims

يُستخدم claim lifecycle موحد منطقيًا لـMoyasar وSMS DLR: `PROCESSING`, `PROCESSED`, `ERROR` مع lease/reclaim. processed فقط يمنع retry؛ error أو lease منتهي يمكن استعادته ذريًا. الأثر المالي/التحديث يحدث مرة واحدة. إذا احتاج schema، تضاف migration جديدة فقط.

#### B4. Client self-service boundary

يوحد Mobile وWebsite على handler ذاتي لا يقبل الحقول الإدارية. تغيير email/phone يمسح verification المناسب ويحتاج إعادة تحقق قبل اعتباره verified. لا تُحذف الحقول من DTO الإداري للداشبورد.

Logout semantics تبقى per-device افتراضيًا إن كان العقد الحالي كذلك، لكن access token للجلسة الحالية يصبح قابلًا للإبطال عبر session/jti أو token version وفق أقل تغيير متوافق. يجب ألا يؤدي logout من جهاز إلى إخراج جميع الأجهزة إلا إذا كان endpoint موثقًا كـlogout-all.

#### B5. Migration immutability gate

يضاف script يقرأ diff مقابل base branch ويفشل عند تعديل/حذف أي ملف تحت migration موجود سابقًا، ويسمح directories الجديدة. CI يشغله قبل migrate deploy. يضاف fixture test للـscript.

### الحزمة C — P2: CI وعقود المنتج

#### C1. تغطية CI

يضاف job أو matrix للجوال والحزم `shared`, `api-client`, `ui` يشغل typecheck/lint/test. قبل إدخال mobile test gate، تُغلق open handles حتى تنتهي Jest طبيعيًا. لا تُرفع warnings كلها إلى errors دفعة واحدة؛ يُمنع ازديادها عبر baseline أو إصلاحات متدرجة.

Coverage gate يبدأ بالـbackend والمسارات الأمنية المعدلة، ثم shared/api-client. لا يُفرض رقم جديد غير قابل للتحقيق على كامل المشروع في أول تغيير.

#### C2. API shape drift

تُولد dashboard types من `apps/backend/openapi.json` الملتزم مباشرة دون backend حي، ثم يفشل CI على diff. يبقى manifest path+method gate، ويضاف schema-level check للعميل اليدوي عند endpoints المعدلة.

#### C3. Dashboard capability contract

تعرف capability registry واحدة للـsidebar والroute guards والصفحة الرئيسية. Overview report لا يطلب إلا مع `report:read`. KPIs التشغيلية تستخدم endpoints المسموح بها حسب الدور. الخادم يظل source of truth.

#### C4. TodayPulse ضمن التغييرات الحالية

يحافظ على التصميم المرئي الحالي. يضيف loading skeleton وerror/unavailable state فلا تعرض الأصفار كبيانات مؤكدة. أول تحسين يكون تجميع client queries بلا endpoint جديد إن أمكن؛ endpoint counts جديد لا يضاف إلا إذا أثبت قياس الشبكة الحاجة إليه.

#### C5. الاختبار الزمني

يثبت clock في `step-employee.spec.tsx` أو يحسب تاريخ الرياض من fake timer، بحيث لا يعتمد على تاريخ تشغيل الجهاز.

### الحزمة D — P3: الأداء وإمكانية الصيانة

#### D1. Website booking decomposition

يُنقل reducer/orchestration إلى hook/state module مختبر، وتقسم الخطوات دون تغيير URL أو request payload أو copy. التنفيذ يكون extraction-only أولًا، ثم lazy loading إن أثبت bundle report فائدته.

#### D2. Availability batching

ينقل loop من controller إلى handler. المرحلة الأولى تحد concurrency وتحافظ على response نفسه؛ المرحلة الثانية set-based query فقط إذا غطتها اختبارات التكافؤ.

#### D3. Bundle budgets

يؤخذ build الحالي baseline: Dashboard 1.51–1.68MB First Load JS، Website نحو 287KB للصفحات العامة. يستخدم analyzer لتحديد السبب قبل تغيير imports. تضاف budgets تدريجية تمنع الزيادة أولًا، ثم تخفض الحجم دون تغيير السلوك.

#### D4. Accessibility

يصلح nested `<main>`, labels المترجمة للـsidebar، radio keyboard behavior، وأهم Pressable controls في mobile. يضاف اختبار keyboard/role حيث تدعمه الأدوات الحالية.

#### D5. Documentation and container reproducibility

تزال التناقضات المثبتة في أوامر Docker والمنافذ وCI والـcoverage. تُزال عمليات `pnpm add -w` من Docker builds لصالح lockfile ثابت، ويُراجع production dependency pruning. Backup health يقيس last successful backup بدل process liveness فقط.

## تدفق البيانات والأخطاء

- Security boundaries تفشل مغلقًا مع رسائل عامة للمستخدم وتفاصيل آمنة في logs.
- التغييرات في المصادقة لا تعيد تعريف access/refresh payloads الحالية؛ تضيف challenge فقط لمسار 2FA المقصود.
- Retryable provider errors لا تتحول إلى success صامت، ولا duplicate نهائي قبل اكتمال mutation.
- Dashboard/Mobile loading وerror states لا تعرض صفرًا أو نجاحًا كاذبًا.
- أي migration أو OpenAPI change يتبع checklist المشروع ويجلب snapshot/types/tests معه.

## استراتيجية الاختبار

لكل مهمة دورة RED → GREEN → REFACTOR موثقة:

1. focused unit/handler test يعيد إنتاج المشكلة.
2. interface/controller test عندما يكون الخطأ ظاهرًا عبر HTTP.
3. positive behavior test يحمي المسار الشرعي.
4. package typecheck وlint.
5. surface matrix من `CLAUDE.md`، بما فيها OpenAPI sync وdashboard smoke عند تغيير endpoint.
6. full backend/dashboard/website/mobile suites عند نهاية كل حزمة، لا بعد كل سطر.
7. لا claim بإكمال حزمة دون fresh verification و`git diff --check`.

## الترحيل والإطلاق

- A1/A2/A4/A5/B1/B2/C3/C5 تغييرات قابلة للنشر مباشرة بعد الاختبارات ولا تحتاج data migration.
- A3 يطلق backend أولًا ثم clients إن احتاج challenge field؛ يبقى passwordless للأدوار العادية.
- B3 إذا احتاج columns جديدة يستخدم additive migration مع defaults آمنة وتوافق مع rows القديمة.
- B4 يحافظ على payload الخارجي ويقيد الحقول على boundary الداخلية؛ أي تغيير verification يظهر للمستخدم برسالة واضحة.
- تغييرات CI/Docker لا تنشر runtime behavior لكنها تختبر في build محلي وworkflow syntax.
- لا push إلى `main` أثناء التنفيذ؛ دفع `main` deploy إنتاج حسب تعليمات المشروع.

## معايير القبول

- لا يظهر أي حقل محظور في Employee Client response.
- empty DB role permissions تمنع الوصول، والصلاحيات غير الفارغة وSUPER_ADMIN تعمل كما قبل.
- المشرف الأعلى الخاضع لـ2FA لا يحصل على token كامل دون password challenge + OTP.
- concurrent mobile 401s تنتج refresh واحدًا ولا تسجل خروجًا كاذبًا.
- metrics المسجلة من consumers تظهر في scrape endpoint.
- shutdown tracker لا يصبح سالبًا وينتظر الطلب النشط أو deadline.
- retry بعد transient webhook failure يمكنه الإكمال مرة واحدة فقط.
- Mobile وshared packages تدخل CI وتنتهي عمليات الاختبار طبيعيًا.
- Dashboard role لا يطلب report endpoint بلا `report:read`.
- لا تغير الإصلاحات URLs أو النصوص أو payloads القائمة إلا في حدود security behavior المعتمد أعلاه.

## خارج النطاق

- إعادة كتابة شاملة، microservices، multi-tenant، configurable branding، subscription billing.
- تغيير مزود الدفع أو SMS/Email/Zoom.
- حذف النسخ المحلية أو نقلها إلى وجهة لم يحددها المالك.
- deploy أو تدوير مفاتيح الإنتاج.

# Sawaa Merge, Deployment and Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. التنفيذ المنسّق مع تفويض محدود للمراجعات المستقلة هو الخيار المقترح؛ لا يُسمح بتعدد الكتّاب على الملفات المتداخلة.

**Goal:** جمع الأعمال الصحيحة دون ضياع التغييرات المحلية، إثبات سلامة كل مرشح، نشره على الاستيج ثم الإنتاج ضمن التفويض، وتنظيف الأعمال المدمجة بعد تأمين الاسترجاع.

**Architecture:** PRs صغيرة حسب السلوك، على أساس أحدث `develop`، مع مرشح تكامل واحد في مساحة معزولة. نشر الويب/backend مرحلي، وإصدار الجوال بوابة منفصلة. صاحب تكامل واحد يحل تداخلات العقود ويعيد توليد OpenAPI؛ لا نسخ شامل ولا دمج عشوائي للفروع.

**Tech Stack:** Node 22، pnpm 10.10.0، Turborepo، NestJS/Prisma/PostgreSQL/Redis/MinIO، Next.js 15، Expo 55/RN 0.83، GitHub Actions وOpenShip.

**Spec:** طلب المالك في 2026-09-23: «اعمل خطه كامله للدمج والنشر والتنظيف وقبلها تحقق انه ما انكسر شي»، مع `docs/operations/deployment-policy.md` و`docs/superpowers/reports/2026-09-23-merge-readiness-verification.md`.

## Global Constraints

- هذه خطة، وليست تفويضًا بتنفيذ commit/push/merge/deploy/delete. «انشر» يجيز develop والاستيج؛ الإنتاج يحتاج «انشر للإنتاج» بعد القبول اليدوي.
- الحفاظ على dirty/untracked/index في كل مساحة؛ لا `git reset --hard` ولا `git clean -fd` ولا force push ولا حذف قسري.
- root commands لا تشمل mobile؛ تشغيله بـ`pnpm --dir apps/mobile ...` وتثبيته منفصلًا بـ`--ignore-workspace`.
- Single tenant؛ لا تغيير `DEFAULT_ORG_ID` أو مفاتيح التشفير أو دورات credentials.
- migrations موجودة غير قابلة للتعديل؛ الجديد additive فقط، وأي حذف بيانات يحتاج تفويضًا صريحًا.
- الدفع وحذف الحساب/الجلسات حزم حساسة؛ لا تتغير semantics أو الصلاحيات دون نطاق مقبول صراحة.
- لا ترقية إنتاج بوجود فشل أو تخطٍ إلزامي أو دون نسخة احتياطية قابلة للاستعادة. نجاح CI لا يثبت النشر.
- تقرير الاختبارات يذكر SHA وبصمة التعديلات والبيئة وأعداد pass/fail/skip. لا جمع نتائج نسختين باعتبارهما مرشحًا واحدًا.
- حالة الموقع الفعلي ومزوّدي الدفع والمتجر غير مثبتة بهذه الخطة؛ تُكتشف من النظام وقت التنفيذ.

## Review Focus

1. تداخل دفع البرامج بين المساحتين: إلغاء المتصفح وإعادة المحاولة لا ينشئان فاتورة أو مقعدًا ثانيًا؛ تختبره حزمة الدفع بقاعدة حقيقية وsandbox.
2. حذف الحساب: رفض الجلسات القديمة مع حفظ السجلات المالية/العلاجية وعدم تعطيل حساب موظف مرتبط؛ تختبره حزمة الهوية عبر HTTP وقاعدة معزولة.
3. استخراج handlers: يبقى فحص ملكية الحجز والمواعيد والتصفية وترتيب البيانات كما هو؛ تثبته اختبارات handlers/controllers وsmoke.
4. نقل مكونات dashboard: تبقى أفعال الحجز والتحويل والاسترداد وظهور الموظف صحيحة مع RTL والصلاحيات؛ تختبره حزمة dashboard في المتصفح.
5. قاعدة الفرع القديمة: اختبار diff بمرجع merge-base، والحفاظ على إصلاحات CSRF/Nightly الموجودة في develop؛ يثبته تدقيق المرشح وتشغيل الاختبارات المدمجة.

## قرار البداية وخيارات التنفيذ

**الخيار الموصى به: ثلاث دفعات مستقلة قابلة للنشر.** A تنظيف منخفض المخاطر ووثائق/واجهة الموظفين؛ B إعادة الهيكلة؛ C الدفع والجوال والهوية بعد اكتمال بواباتها. يمنع فشل الدفع من حجب تنظيف مستقل، ويسهل التراجع عن أي دفعة.

بديل تجميع الكل في PR واحد مرفوض لهذا الوضع: هناك 14 ملفًا متداخلًا، dirty work في مساحتين، ونسخة دفع محلية ناقصة مقابل نسخة أشمل. بديل نشر PR84 وحده ممكن كدفعة A مصغرة، لكنه لا يغلق بقية الأعمال ولا يجيز حذف الفرع المحلي الأوسع.

## Task 1: تثبيت الجرد وحفظ العمل قبل أي تكامل

**Files/resources:** جذر المشروع؛ المساحات الخمس من `git worktree list`; سجل تحقق هذه الخطة؛ أرشيف خاص خارج Git.

**Interfaces:** ينتج manifest بالمسار والفرع وSHA وحالة index/dirty/untracked والبصمات ومالك كل حزمة. هذا مدخل إلزامي لكل مهمة لاحقة.

- [ ] نفّذ `git fetch origin --prune` و`git status --porcelain=v1` و`git branch -vv` و`git worktree list --porcelain` و`gh pr list --state open`؛ إذا تغيرت refs منذ التقرير، حدّث الجرد والمقارنات.
- [ ] سجّل التغييرات staged وunstaged كلًا على حدة، والملفات الجديدة المطلوبة للتطبيق/الاختبارات/التوثيق. لا تعتبر `.pnpm-store/` أو `.agent-teams/` أو `.cursor/` أو `.commandcode/` ملفات نشر تلقائيًا.
- [ ] قبل النقل، احفظ patch ثنائي staged وpatch unstaged ونسخة الملفات الجديدة المطلوبة في أرشيف خاص؛ افحص الأسرار دون طباعتها واحفظ أي بيانات حساسة في تخزين خاص مشفر. لا تضع `.env` أو credentials داخل commit أو artifact عام.
- [ ] أثبت إمكانية استعادة هذا العمل في مساحة مؤقتة وبصمات مطابقة، مع حفظ التمييز بين staged/unstaged. لا تكتفِ بوجود ملف الأرشيف.
- [ ] سجّل العمليات والجلسات التي تستخدم كل worktree. يمنع نقل/حذف مساحة بداخلها كاتب حي أو سيرفر أو جلسة تحتاجها.

**Acceptance:** يمكن إعادة تكوين النسختين الحاليتين دون فقد الملفات الجديدة أو حالة index؛ لم تتغير مساحة المستخدم.

## Task 2: تجهيز بيئة تكامل قابلة لإعادة الاختبار

**Files:** `.nvmrc`, `package.json`, `pnpm-lock.yaml`, `apps/mobile/package.json`, `apps/mobile/pnpm-lock.yaml`, `apps/mobile/patches/metro@0.83.7.patch` من مساحة الدفع عند نقل حزمتها.

- [ ] أنشئ worktree مستقلًا من أحدث `origin/develop` بعد بدء التنفيذ المصرح به؛ لا تبدّل الفرع في المساحة الرئيسية المتسخة.
- [ ] استخدم Node 22 وpnpm 10.10.0، ونفّذ تثبيتًا frozen root ثم mobile منفصلًا. تحقق أن React وrenderer في mobile كلاهما 19.2.0؛ لا تغيّر ملفات القفل لمعالجة node_modules قديم.
- [ ] شغّل `pnpm --filter=@sawaa/shared build` و`pnpm --filter=backend prisma:generate`.
- [ ] جهز PostgreSQL/Redis/MinIO اختبارية بأسماء ومنافذ خاصة بهذا المرشح. تحقق من hostname/database قبل migrate/seed. ممنوع توجيه الاختبارات إلى الإنتاج أو قاعدة الاستيج الحقيقية.
- [ ] استعمل synthetic fixtures؛ عطّل الإرسال الخارجي للرسائل وZoom والدفع خارج اختبارات sandbox المصرح بها. شغّل migrations الموجودة بـmigrate deploy، دون reset لقاعدة مشتركة.
- [ ] أضف إلى سجل الأدلة إصدار Node/pnpm، SHA، checksum لملفات القفل، manifest للبيئة دون القيم السرية.

**Acceptance:** تثبيت نظيف قابل للتكرار، تطبيقات تتصل بموارد الاختبار فقط، لا تخطٍ بسبب سوء إعداد يمكن تلافيه.

## Task 3: الدفعة A — PR84 والتوثيق والتنظيف الإضافي

**Files/commits:** PR84 عند `d07b71005`؛ PR85 عند `5ef7e0d85`؛ commit التنظيف `7a5345108`؛ تكرار الوثائق `2ed8072f1`؛ `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `apps/backend/CLAUDE.md`, `apps/mobile/CLAUDE.md`, `packages/shared/**`, `packages/test-helpers-pw/**`, `apps/*/Dockerfile`, `.dockerignore`, `scripts/check-legacy-multitenant*`.

- [ ] راجع PR84 بـ`git diff origin/develop...origin/feature/remove-dead-saas-scaffolding`، وليس فرق رأسين الذي يخلط إصلاحات develop الأحدث. حافظ على نطاقه البعيد؛ لا ترفع commits الفرع المحلي الثمانية إليه دفعة واحدة.
- [ ] صحح في فرع PR85 عبارة أن FeatureKey حُذف إذا كان لا يزال موجودًا في نسخته. استخدم حقيقة النسخة المستهدفة؛ لا تعتمد على حذف موجود في commit محلي غير مدمج.
- [ ] جهز تنظيف catalog/organization stub في PR لاحق بعد PR84. راجع Dockerfiles وbuild contexts في `7a5345108` بوصفها تغييرات نشر فعلية، لا توثيقًا فقط.
- [ ] قارن `2ed8072f1` مع PR85: لا cherry-pick أعمى؛ ادمج النص النهائي مرة واحدة، بما فيه تحذيرات AAD وSMS والمهاجرات. راجع `.github/copilot-instructions.md` و`GEMINI.md` من `3b54b7e5a` للمحافظة على مرجع AGENTS.
- [ ] انقل `docs/operations/migration-charter.md` بعد مراجعته كوثيقة تشغيل؛ لا توجد migration تنفيذية مطلوبة لمجرد إضافة هذا الميثاق.
- [ ] أعد shared tests وroot typecheck وحارس legacy، وابنِ صور التطبيقات الثلاثة من سياق نظيف مع استبعاد dist/node_modules المحلية. تحقق أن الحذف لا يُخفيه dist قديم.
- [ ] لا تنفذ الدمج إلا بعد مراجعة الفروق وفحوصات SHA النهائي. شروط GitHub CLEAN والنجاح القديم لا تكفي بعد تحديث الفرع.

**Acceptance:** PR84 مستقل، توثيق صحيح في كل مرحلة، لا إعادة إدخال scaffolding، صور Docker تبنى، ولا يُستبدل أي إصلاح أحدث في develop.

## Task 4: الدفعة A — ظهور الموظف على الموقع

**Files:** `apps/dashboard/components/features/employees/basic-info-tab.tsx`, `employee-form-page.tsx`, `public-profile-tab.tsx`, `use-employee-form.ts` في المجلد نفسه؛ المصدر commit `95cab4d05`.

- [ ] انقل commit `95cab4d05` وحده إلى PR مستقل/دفعة A؛ لا تعتبره مدمجًا لأن مساحة الدفع تبدأ منه.
- [ ] شغّل `test/unit/features/employees/use-employee-form-price-units.spec.tsx` والاختبارات القريبة، مع typecheck وlint.
- [ ] على بيئة الاختبار: افتح موظفًا موجودًا، بدّل الظهور واحفظ ثم أعد التحميل؛ أثبت أن ظهور الموقع واستقلال حالة النشاط بقيا صحيحين. افحص العربية والإنجليزية وحالة مستخدم دون صلاحية التعديل.

**Acceptance:** تعديل المكان لا يغير قيمة الحفظ أو الصلاحيات، والظهور الفعلي يطابق الإعداد.

## Task 5: الدفعة B — إعادة هيكلة backend وdashboard

**Backend files:** dirty `apps/backend/src/api/dashboard/people.controller*`, `api/mobile/client/bookings.controller*`, `api/mobile/client/portal/{summary,upcoming}.controller*`, `src/app.module.spec.ts`, `modules/bookings/bookings.module.ts`، والملفات الجديدة `modules/bookings/client/{get-client-booking-for-action,get-client-portal-summary,list-client-upcoming-bookings}.handler*` و`employee-availability-query.handler*`.

**Dashboard files:** dirty activity-log/users imports؛ employee/service imports؛ المكونات الأربعة المنقولة إلى `components/features/shared/`؛ `client-package-balances-panel.tsx` و`client-package-balance-cards.tsx`؛ `eslint.config.mjs` و`test/unit/architecture/feature-boundaries.spec.ts` واختبارات المستهلكين.

**Independence:** backend وdashboard قابلان لتفويض مستقل بملكية الملفات أعلاه؛ اختبارات التكامل عند المنسق وحده. ملف profile controller/test ليس جزءًا من هذه الحزمة؛ يملكه تكامل الهوية في المهمة 6/7.

- [ ] انقل التغييرات tracked وuntracked معًا؛ تأكد من عدم نقل rename في index وترك تحديث imports خلفه.
- [ ] راجع استخراج handlers مقارنةً بالسلوك قبل النقل: ملكية العميل، pagination/count، statuses، branch fallback، المنطقة الزمنية وduration. لا تغير guards أو العقود أثناء refactor.
- [ ] راجع البطاقات المستخرجة: balances، نقل الرصيد، حجزه، الاسترداد وإخفاء الأفعال حسب الصلاحية. أزل السطر الفارغ الإضافي بنهاية panel.
- [ ] شغّل اختبارات controllers/handlers المتأثرة، app module، اختبارات البطاقات والموظفين والسجل وarchitecture. نفذ typecheck وlint بعد جمع الجزأين.
- [ ] شغّل dashboard smoke ثم flows المتأثرة بالحجوزات/الموظفين/الخدمات/الأرصدة على backend الفعلي في بيئة اختبار.

**Acceptance:** نفس السلوك والعقود والصلاحيات، imports صحيحة من checkout نظيف، لا أخطاء lint، وsmoke يثبت تكامل الجزأين.

## Task 6: الدفعة C — توحيد دفع البرامج وإعدادات الجوال

**Source of integration:** التغييرات غير المحفوظة في `/Users/tariq/.codex/worktrees/sawaa-program-checkout/sawaa`؛ commits الجوال المحلية `c5dd4a269` و`ac1883318` تُراجع انتقائيًا ولا تُنسخ فوقها.

**Owned files:** mobile program/group services/screens/hooks؛ `booking/{checkout,payment-callback,existing-booking-checkout-state,use-existing-booking-checkout}`؛ native programs/payments controllers؛ enrollment handler؛ Moyasar client/init payment؛ website callback؛ app.config/config/eas؛ package/lock/Metro patch؛ booking adapter/status labels؛ profile DTO/handler وhandwritten `packages/api-client/src/modules/me.ts` لتفضيلات العميل.

**Contract:** native enrollment عبر `/api/v1/mobile/client/programs/:id/enroll`؛ booking/invoice IDs أصلية؛ لا success من callback فقط؛ paid invoice مع confirmed/completed booking شرط النجاح. تستخدم النسخة الأشمل checkout القابل للاستئناف؛ لا تستبدلها بالمسار المختصر من `c5dd4a269`.

- [ ] أحضر diff مساحة الدفع بالكامل للعرض، ثم انقل الحزمة بحدود الملفات؛ حافظ على ظهور الموظف من قاعدة `95cab4d05` دون إدراجه مرتين.
- [ ] سوِّ الـ14 مسارًا المتداخل يدويًا: `.env.example`، backend profile controller/test، OpenAPI، dashboard generated types، mobile `.env.example`، appointment/groups screens، config/eas، ar/en، group service/test. لا تستخدم ours/theirs شاملًا.
- [ ] انقل من `c5dd4a269` فقط السلوك المقبول الذي لا تستبدله الحزمة الأشمل؛ إخفاء ميزات غير مكتملة وإيقاف تسجيل APNs كـFCM لا يُسميان إصلاحًا كاملًا لإشعارات iOS.
- [ ] طبّق endpoints/preferences ثم ادمج مهمة حذف الحساب إن اجتازت قبولها؛ أعد `pnpm openapi:sync` **مرة واحدة من المصدر الموحد**، وراجع handwritten API client. ممنوع حل التعارض بلصق snapshots من إحدى المساحتين.
- [ ] شغّل اختبارات mobile الكاملة وbackend/website المتأثرة، ثم real-DB program-checkout/concurrency وأمان هوية العميل. اختبر تكرار النقر، الامتلاء، expiry، إلغاء المتصفح، retry، foreground، cold start، invoice mismatch والمبلغ التاريخي.
- [ ] تحقق من sandbox حاليًا دون كشف keys؛ إذا كان غير صالح توقف عن بوابة الدفع. اختبر نجاح/رفض الدفع، callback/webhook المتأخر والمكرر، invoice/payment/seat واحدًا، واستعادة checkout دون دفعة ثانية.
- [ ] ابنِ Expo iOS ثم اختبر نسخة مثبتة على جهاز للـdeep link والعودة الباردة وApple Pay إذا كان مشمولًا. bundle export أو محاكاة الويب لا يكفيان لهذه البوابة.

**Acceptance:** تدفق دفع كامل قابل للاستئناف وموثّق بالنسخة والبيئة؛ لا اعتماد على تقرير قديم أو mocks لإثبات gateway. إذا تعثرت هذه البوابة، تُحجب الدفعة C ويبقى نشر A/B ممكنًا بعد اختبارهما منفصلين.

## Task 7: الدفعة C — حذف الحساب بوابة منفصلة

**Files:** `modules/identity/request-account-deletion/request-account-deletion.handler*`, `identity.module.ts`, `api/mobile/client/profile.controller*`, mobile profile/settings/auth service/tests والترجمات؛ المصدر `ac1883318` مع dirty controller test.

- [ ] ثبّت نطاق المالك: هل المطلوب إغلاق تسجيل الدخول فورًا أم طلب محو تديره جهة مسؤولة بمدة وإشعار إنجاز؟ افحص ما سبق اعتماده في المهمة الأصلية؛ لا تطلب موافقة مكررة إن كانت موثقة. عند غياب القرار، لا تنشر endpoint بوصفه محوًا مكتملًا.
- [ ] راجع أن `status: scheduled` يطابق عملية فعلية معروفة؛ لا يوجد في هذا handler وحده دليل على queue لاحقة. وثّق الاحتفاظ بالسجلات والاسم والهوية بما يطابق القرار التشغيلي، دون ادعاء امتثال متجر تلقائي.
- [ ] دمج profile endpoint مع تفضيلات العميل من مهمة 6؛ مالك واحد لهذا الملف ولكل من ar/en وOpenAPI.
- [ ] اختبر عبر HTTP وقاعدة اختبار: إبطال client access/refresh tokens، منع تسجيل الدخول بالحالة المحذوفة، إزالة push tokens المملوكة للعميل، عدم تعطيل User غير CLIENT، الحفاظ على المواعيد والفواتير والسجلات العلاجية، وتكرار الطلب/التزامن.
- [ ] افحص واجهة التأكيد، أخطاء الشبكة، تسجيل الخروج بعد النجاح، وعودة التطبيق بعد إعادة تشغيله. لا تستخدم بيانات عميل حقيقي للاختبار.

**Acceptance:** سلوك هوية معتمد ومثبت، ورسالة المستخدم تطابق ما ينفذ. عند غياب القبول تفصل الحزمة وتبقى محجوبة دون تعطيل بقية الإصدار المستقل.

## Task 8: تجميد المرشح والتحقق المتكامل

**Files/resources:** كامل المرشح المعزول؛ `.github/workflows/{ci,merge-gate,nightly-e2e}.yml` كمرجع؛ تقرير أدلة جديد لكل دفعة.

- [ ] راجع `git diff origin/develop...HEAD` و`git diff --cached` وأسماء الملفات، وأثبت عدم دخول ملفات أدوات محلية أو أسرار أو تغيير migration موجودة.
- [ ] طبّق مزامنة `main` إلى `develop` عبر PR عند التفويض، قبل تثبيت أساس المرشح أو قبل اختبار النسخة النهائية؛ لا squash لترقية/مزامنة الفروع طويلة العمر. الفرق الحالي سجل إصدار فقط لكن أعد التحقق.
- [ ] أعد جميع فحوصات الأنواع والوحدة على Node 22 في checkout نظيف، ثم `pnpm lint` و`pnpm build`، وmobile مستقلًا. نفّذ `node scripts/check-prisma-migration-immutability.mjs origin/develop`.
- [ ] تحقق من OpenAPI runtime وgenerated dashboard types وhandwritten client؛ نفّذ أدوات drift الموجودة بـ`pnpm check:api-client-drift` و`pnpm check:dashboard-api-drift`.
- [ ] على قاعدة معزولة: `pnpm --filter=backend run test:e2e:critical`؛ وإذا تغير outbox/comms شغّل مجموعة transport مع Redis المحدد. افحص JSON بالعدد وعدم تخطي المجموعات الإلزامية، لا exit code فقط.
- [ ] للدفعة C، أعد على **SHA المجمد بعد تكامل profile وOpenAPI** اختبارات `apps/backend/test/e2e/bookings/program-checkout.real-e2e-spec.ts` واختبارات real-DB/HTTP لحذف الحساب التي تتطلبها مهمة 7؛ احفظ نتائجها واشترط صفر تخطٍ. قائمة `test:e2e:critical` الحالية لا تضمها؛ نجاحها وحده لا يغطي هذين السلوكين. شغّل مجموعة checkout صراحةً من backend بـ`pnpm exec jest --config test/jest-e2e.json --runInBand --runTestsByPath test/e2e/bookings/program-checkout.real-e2e-spec.ts` بعد تثبيت `REAL_E2E_DATABASE_URL` لقاعدة الاختبار. عند تنفيذ حزمة الحذف أضف اختبارها في `test/e2e/auth/account-deletion.real-e2e-spec.ts` وشغّله بالأمر نفسه مع تغيير المسار، أو ضمهما إلى قائمة critical و`--required` معًا. إذا استُبعد حذف الحساب من المرشح فلا يُطلب اختباره كجزء منه، ويظل قرار الاستبعاد موثقًا.
- [ ] `pnpm --filter=dashboard run e2e:smoke` ثم `PW_E2E_PROD=1 pnpm --filter=dashboard run e2e` للحزمة المتكاملة واسعة السطح. أي skip لميزة مطلوبة يُحجب أو يُختبر ببيئة تتيحها؛ لا إخفاء فشل بتخفيف assertions.
- [ ] أعِد فحص سياسة الحماية لكل من main/develop وrequired checks. 403 الحالي لا يجيز bypass أو جعل المستودع عامًا. إذا تعذر enforcement التقني، اعرض الحد للمالك وسجّل مراجعة وفحوصات SHA إلزامية في مسار PR دون ادعاء حماية آلية.
- [ ] مراجعة مستقلة نهائية للفروق الفعلية ومخرجات الاختبارات. إذا تغير SHA بعد المراجعة أو الاختبار أعد الفحوصات المتأثرة ثم ثبّت SHA جديدًا.

**Acceptance:** SHA مرشح محدد، checks المطلوبة ناجحة، صفر فشل أو تخطٍ إلزامي، قائمة وظائف مثبتة وحدود مكتوبة. هذا يجيز الاستيج عند أمر النشر، لا الإنتاج.

## Task 9: نشر الاستيج ثم قبول المالك

**Resources:** PRs إلى develop، مشروع OpenShip staging، قاعدة staging المنفصلة، تقرير الإصدار. مرجع الإعداد `docker/openship/README.md`؛ لا تفترض أن أسماء خدمات الدليل تمثل الحالة الحية.

- [ ] عند «انشر»، أعد فحص PR head/base والchecks ثم ادمج فقط دفعة المرشح المقبولة. حافظ على بقية العمل المحلي دون رفعه.
- [ ] اقرأ تكوين OpenShip الفعلي لتحديد project/service IDs وbranch وdomains وauto-deploy ومكان DB. سجل revision الحالي وخطة التراجع. لا تنشئ نشرًا ثانيًا إذا كان auto-deploy بدأ بالفعل.
- [ ] انشر backend/dashboard/website على الاستيج وفق dependency compatibility؛ تحقق من build وmigration logs دون كشف الأسرار. إذا أضيفت migrations، طبّق الميثاق قبلها ولا تمس بيانات الإنتاج.
- [ ] تحقق من SHA/image digest الفعلي والخدمات والصحة والسجلات، ثم اختبر login/CSRF، الحجز، الأرصدة، الموظفين، الفواتير والبرامج حسب الدفعة. استخدم بيانات اختبار معرّفة.
- [ ] قدم رابط الاستيج الفعلي وSHA وقائمة تغييرات وخطوات اختبار قصيرة؛ سجّل قبول المالك وتاريخه ونطاقه. أي تغيير لاحق يلغي قبول الجزء المتغير ويستدعي إعادة اختباره.

**Acceptance:** الدفعة تعمل فعلًا على الاستيج، واختبار المالك مسجل لنفس المحتوى. لا تُستنتج الموافقة من مرور الوقت.

## Task 10: ترقية الإنتاج والتراجع

**Prerequisites:** أمر «انشر للإنتاج»، قبول الاستيج لنفس المحتوى، نجاح مهمة 8/9، وقائمة migrations/backups/rollback متحققة حديثًا.

- [ ] قارن develop/main/النسخة المشغلة والاستيج المقبول لحظة التنفيذ؛ امنع إدخال commits غير مقبولة أثناء الترقية، وأعد الفحص إذا تحرك أي فرع.
- [ ] خذ نسخة احتياطية حديثة مشفرة للبيانات والملفات والتكوين الضروري، وأثبت وجود النسخة الخارجية وفك التشفير وسلامة الأرشيف دون كشف الأسرار.
- [ ] نفّذ restore drill إلى موارد معزولة بلا اتصال بمزوّدي الإنتاج؛ تحقق من schema/migration counts والعلاقات الأساسية وإمكانية قراءة المرفقات. يمنع تنفيذ أوامر restore الإنتاج الواردة في runbook كتجربة.
- [ ] سجل الإصدار والصور السابقة وتوافقها مع schema الجديدة. وافحص plan التراجع **قبل** الدمج، خاصة إذا ظهرت migration لاحقًا.
- [ ] أنشئ/راجع PR develop → main مع الحفاظ على ancestry، ثم ادمجه بعد نجاح checks لنفس الرأس. راقب OpenShip الفعلي؛ tag أو DEPLOY_STATE ليسا إثبات نجاح.
- [ ] تحقق من backend/dashboard/website revisions، health، أخطاء التشغيل، login وصفحات القراءة والحجوزات القائمة. أي اختبار دفع/حجز منتج للبيانات يكون محددًا ومصرحًا، لا تجارب عشوائية على عملاء حقيقيين.
- [ ] عند خطأ حرِج: أوقف الترقية/التوسع، وأعد إصدار الكود السابق إن كان schema-compatible. لا تستعد قاعدة قديمة تلقائيًا ولا تفقد حجوزات/دفعات حدثت بعد النشر؛ recovery المدمر يحتاج قرارًا مستقلًا.
- [ ] وثّق deployment IDs وSHA والوقت والفحوصات والrollback reference. مزامنة سجل main إلى develop عبر PR بعد الاستقرار.

**Acceptance:** دليل تشغيل فعلي لنفس الإصدار المقبول مع مسار تراجع قابل للاستخدام. نشر الجوال للمتجر خطوة مستقلة بعد قبول native/store، ولا يحدث تلقائيًا بنشر backend.

## Task 11: التنظيف بعد حفظ العمل وقبول التسليم

**Candidates:** الفروع الثلاثة المدمجة CSRF/Nightly ومساحاتها؛ فرعا #84/#85 بعد إثبات دمج كل محتواهما؛ مساحة program-checkout بعد نقل كل dirty/untracked والتثبت. أدوات محلية/caches لا تُحذف لمجرد ظهورها في status.

- [ ] أعد جرد كل worktree/فرع والجلسات والعمليات وdirty/index/untracked. لا تعتمد على فحص اليوم لإباحة حذف لاحق.
- [ ] للفروع المدمجة ancestry-preserving: `git merge-base --is-ancestor BRANCH origin/develop`. إذا كان الدمج squash فلا تفسر فشل الأمر بأنه عمل مفقود أو تستخدم force؛ أثبت مطابقة patches وPR ثم احفظ المرجع.
- [ ] **استثناء مهم:** دمج PR84 عند `d07b71005` لا يجيز حذف الفرع المحلي عند `ac1883318`؛ يحتاج إثبات مصير commits الثمانية وتعديلاته الجديدة كل واحدة: دُمجت/استُبدلت مع حفظ السلوك/مؤجلة ومحفوظة.
- [ ] لا تحذف program-checkout detached حتى توجد commits قابلة للوصول تحفظ كل الملفات الجديدة والتعديلات أو أرشيف خاص جرى اختبار استعادته، وتكون المهمة التي تستخدمه انتهت.
- [ ] بعد التفويض بالتنظيف، أزل worktrees النظيفة المحددة بأمر `git worktree remove` دون force؛ ثم `git branch -d` للفروع التي يقبل Git حذفها بعد إثبات الدمج. حذف remote branch محدد يتم فقط بعد إثبات عدم استخدام PR/نشر له؛ لا bulk delete.
- [ ] نفّذ `git fetch --prune` و`git worktree prune --dry-run` ثم prune للتسجيلات اليتيمة المثبتة فقط. لا تحذف مجلد مساحة نشطة يدويًا.
- [ ] تعامل مع caches وملفات الفرق كحزمة تنظيف منفصلة: اعرض المسار والغرض والحجم والمالك وقابلية إعادة الإنشاء. حافظ على `.env` وcredentials وlogs الدليل والنسخ الاحتياطية وقواعد الاختبار حتى تنتهي الحاجة إليها.
- [ ] قدّم جدول قبل/بعد للفروع والمساحات والملفات المتبقية، واختبار وجود مراجع الاسترجاع؛ لا تغيّر الفرع المحلي المتسخ لتحديث main/develop بالقوة.

**Acceptance:** لا أعمال وحيدة النسخة محذوفة، لا جلسات مكسورة، لا موارد إنتاج/credentials محذوفة، والفروع المتبقية ذات غرض موثق.

## ترتيب التنفيذ والتفويض

`الجرد والحفظ → البيئة → A → B → C حسب بواباتها → مرشح كل دفعة → الاستيج → قبول المالك → الإنتاج → التنظيف`.

- منسق واحد يملك branches وOpenAPI/generated files وعمليات النشر والاختبارات النهائية.
- backend refactor وdashboard refactor يمكن تفويضهما بالتوازي بعد ثبات الأساس، بلا كتابة على profile/payment.
- تكامل الدفع والهوية **متتابع** عند ملفات profile/الترجمات/OpenAPI، حتى لو كانت المراجعات مستقلة.
- لا يشغل العمال full build/lint/tests منتصف العمل؛ المنسق يشغلها بعد التكامل. مراجعة مستقلة للدفعات الحساسة قبل اعتمادها.
- اختيار GPT-6 Luna للعمل المحدود وGPT-6 Sol للتكامل المعقد؛ لا يُعاد فحص ناجح دون تغيير أو فشل أو قلق محدد.

## نقاط توقف ملزمة

تغير candidate SHA؛ فقد أي dirty/untracked؛ فشل استعادة الأرشيف؛ failure/skip إلزامي؛ تعارض لم يُراجع؛ schema drift؛ sandbox غير صالح؛ غياب native acceptance لميزة مشمولة؛ اختلاف محتوى الاستيج عن المقبول؛ فشل backup/restore؛ غياب أمر الإنتاج؛ أو وجود كاتب حي في مورد مرشح للحذف. عندها يُذكر المانع والحزمة المتأثرة، وتستمر فقط الأعمال المستقلة الآمنة.

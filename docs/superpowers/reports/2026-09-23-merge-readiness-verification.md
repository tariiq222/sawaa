# تحقق ما قبل خطة الدمج — 2026-09-23

## النتيجة وحدودها

نجحت فحوصات الأنواع والاختبارات المذكورة أدناه على مساحتي العمل الحاليتين بعد معالجة اختلافات بيئة الاختبار. **هذا ليس إثباتًا لسلامة نسخة مدمجة أو لجاهزية الإنتاج**: لا يوجد release candidate موحّد بعد، ولم تُنفذ اليوم اختبارات قاعدة البيانات الفعلية أو المتصفح أو Moyasar أو جهاز iOS أو بناء صور Docker.

لم تُعدّل ملفات المصدر الموجودة، ولم يحدث commit أو push أو merge أو نشر أو حذف. أُعيد تثبيت اعتماديات الجوال المحلي من ملف القفل الموجود فقط؛ لم يتغير `package.json` أو `pnpm-lock.yaml`. هذه الوثيقة والخطة المرتبطة بها هما مخرجا المهمة الجديدان.

## النسخ التي تحققنا منها

| المرجع | SHA | الحالة |
|---|---|---|
| `origin/develop` | `51ac1fd449ab983b97d4f63268705449e1140c18` | جرى fetch جديد |
| `origin/main` | `e3581e92c31a597995ecbdb2292364d96e844b07` | يتقدم على develop بدمج الإصدار وسجله؛ فرق المحتوى `.github/DEPLOY_STATE.json` فقط |
| PR #84 | `d07b71005fe080b1719a4dec5b56c39ca30d6471` | 14 ملفًا في three-dot diff؛ 9 checks ناجحة في المراجعة السابقة؛ CLEAN وقت إعادة الفحص |
| PR #85 | `5ef7e0d8561dfed362a6cdff10a0db7a24629465` | 8 ملفات؛ 9 checks ناجحة في المراجعة السابقة؛ CLEAN؛ تصحيح التوثيق مطلوب |
| المساحة الرئيسية | `ac1883318d3f20ed7f6ea98a23b40a9a8a9ba8e7` + dirty files | `/Users/tariq/code/sawaa`؛ 8 commits فوق PR84 |
| مساحة إصلاح الدفع | `95cab4d05108a988cec43470cc3bc748ca96c8d3` + dirty files | `/Users/tariq/.codex/worktrees/sawaa-program-checkout/sawaa`؛ detached HEAD |

توجد 14 مسارًا متداخلًا بين تعديلات المساحتين، أهمها profile controller، عقد OpenAPI وأنواع dashboard، شاشة البرامج وخدمتها، إعدادات الجوال والترجمات. لا يجوز نسخ إحدى المساحتين فوق الأخرى.

الفروع `codex/csrf-public-login` و`codex/fix-nightly-redis-readiness` و`codex/fix-nightly-dashboard-flows` أسلاف لـ`origin/develop` ومُدمجة بالفعل. مساحاتها نظيفة. فحص cwd لم يُظهر عمليات فيها وقت الفحص؛ يجب إعادة الفحص قبل التنظيف. المساحة الرئيسية فيها عمليات حية ولا يجوز حذفها.

## نتائج جديدة — المساحة الرئيسية

| الفحص | النتيجة | البيئة/الحدود |
|---|---|---|
| Root typecheck | 8/8 مهام، صفر كاش | `pnpm exec turbo run typecheck --force`؛ Node 26.7.0 |
| Mobile typecheck | ناجح | مستقل عن root workspace؛ Node 26.7.0 |
| Backend Jest كامل | 844 ملفًا ناجحًا، ملف واحد متخطى؛ 7,794 ناجحًا، 0 فشل، 1 متخطى | Node 26.7.0؛ ليس real-DB E2E |
| Dashboard Vitest كامل | 263 ملفًا؛ 2,123 ناجحًا، 0 فشل/تخطٍ | Node 26.7.0 |
| Shared Vitest كامل | 11 ملفًا؛ 217 ناجحًا، 0 فشل/تخطٍ | Node 26.7.0 |
| Website Vitest كامل، النتيجة النهائية | 87 ملفًا؛ 771 ناجحًا، 0 فشل/تخطٍ | Node 22 من `/opt/homebrew/opt/node@22/bin` |
| Mobile Jest كامل، النتيجة النهائية | 30 ملفًا؛ 171 ناجحًا، 0 فشل/تخطٍ | Node 22، بعد استعادة اعتماديات ملف القفل |
| فحوصات حارس legacy multitenant | 7 ناجحة، 0 فشل/تخطٍ | `node --test scripts/check-legacy-multitenant.test.mjs` |
| Dashboard ESLint كامل | 0 أخطاء، 10 تحذيرات | دون autofix |
| `git diff --check HEAD` | فشل تنسيقي واحد | سطر فارغ إضافي في نهاية `apps/dashboard/components/features/clients/client-package-balances-panel.tsx:160` |

التخطي في backend هو `src/modules/ops/legacy-import/legacy-import.writer.spec.ts`: لا توجد قيمة `LEGACY_IMPORT_TEST_DATABASE_URL`. لا يُحتسب الاختبار ناجحًا.

### التعثرات الأولية وتشخيصها

1. الجوال: 25 ملفًا نجح و5 ملفات تعذر تشغيلها، مع 134 اختبارًا ناجحًا. السبب المثبت: المحمّل فعليًا React 19.2.0 وreact-test-renderer 19.2.4، مع أن ملف المشروع يحدد renderer 19.2.0. الأمر التالي استعاد النسخة المقفلة دون تعديل المصدر:

   ```bash
   PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm --dir apps/mobile install --frozen-lockfile --ignore-workspace
   ```

   أعيدت المجموعة كاملة ونجحت 171/171؛ لا حاجة لتغيير إصدارات dependencies.

2. الموقع: التشغيل الأول على Node 26.7.0 أعطى 731 ناجحًا و40 فشلًا في 4 ملفات بسبب `localStorage` غير المتاح. التجربة المضبوطة مع `NODE_OPTIONS=--no-experimental-webstorage` نجحت 40/40 في الملفات نفسها. ثم نجحت المجموعة كاملة 771/771 على Node 22، المطابق لـ`.nvmrc` وCI. لم تُخفف assertions ولم يتغير كود التطبيق.

## نتائج جديدة — مساحة إصلاح الدفع

| الفحص | النتيجة |
|---|---|
| Root typecheck على Node 22 | 8/8 مهام، صفر كاش |
| Mobile typecheck على Node 22 | ناجح |
| Mobile Jest كامل | 36 ملفًا؛ 199 ناجحًا، 0 فشل/تخطٍ؛ Node 26.7.0 |
| Backend متأثر: programs/payments/profile controllers، enrollment، Moyasar client، init payment، profile DTO/handler | 8 ملفات؛ 142 ناجحًا، 0 فشل/تخطٍ؛ Node 26.7.0 |
| Website callback وbooking API | ملفان؛ 19 ناجحًا، 0 فشل/تخطٍ؛ Node 26.7.0 |
| `git diff --check HEAD` | ناجح |

هذه النتائج لا تُجمع مع نتائج المساحة الرئيسية لتقديم رقم لنسخة واحدة؛ تحتويان أعمالًا متداخلة ولم تُدمجا بعد.

## بوابات لم تثبت اليوم

- Docker daemon غير متاح عند `/Users/tariq/.docker/run/docker.sock`، ولم تظهر الخدمات المحلية على منافذ الفحص. لم يُشغّل Docker أو DB أو seed، ولم تُرسل دفعات أو رسائل خارجية.
- real-DB E2E، dashboard smoke، Nightly flows، full production builds، Docker builds، OpenAPI runtime regeneration: لم تنفذ في هذه المهمة. فحص الأنواع لا يثبتها.
- تقرير مساحة الدفع السابق يذكر Moyasar sandbox HTTP 401 وقصور اختبار الجهاز؛ هذه أدلة تاريخية محلية، لم يُعاد فحص اعتماد المزود اليوم، فلا نفترض استمرار رمز الخطأ ولا زواله.
- GitHub API لحماية `develop` و`main` أعاد 403 برسالة أن الميزة تحتاج ترقية الخطة أو مستودعًا عامًا. لا توجد في هذه المهمة شهادة أن الحماية مفعّلة؛ لا نغيّر الخطة أو خصوصية المستودع تلقائيًا.
- الحالة الفعلية لنشر الاستيج/الإنتاج والنسخ الاحتياطية لم تُفحص اليوم. Git أو `DEPLOY_STATE.json` ليسا دليل تشغيل.
- لا توجد شهادة جاهزية App Store أو FCM على iOS. حسابات المتجر والسياسة التشغيلية لحذف الحساب تبقى بوابات مستقلة.

## الأدلة وإعادة التشغيل

الأدلة المحلية لهذه المهمة في `/tmp/sawaa-merge-audit-20260923/`: ملفات `*-results.json`، سجلات `*.log`، و`source-before.json` الذي يحتوي أسماء الملفات وبصماتها فقط. هذه أدلة مؤقتة؛ تُحفظ الأدلة المنقحة المرتبطة بالمرشح في سجل الإصدار عند التنفيذ.

تحققت البصمات بعد الفحوصات: **صفر تغيير في ملفات المصدر الموجودة** في المساحتين. تثبيت node_modules لا يدخل هذا القياس. فحوصات CI القديمة تخص SHA طلباتها ولا تغطي dirty files الحالية.

أوامر إعادة التشغيل من جذر المرشح المعزول:

```bash
export PATH=/opt/homebrew/opt/node@22/bin:$PATH
node --version
pnpm install --frozen-lockfile
pnpm --dir apps/mobile install --frozen-lockfile --ignore-workspace
pnpm --filter=@sawaa/shared build
pnpm --filter=backend prisma:generate
pnpm exec turbo run typecheck --force
pnpm --dir apps/mobile typecheck
pnpm --dir apps/backend exec jest --runInBand
pnpm --dir apps/dashboard exec vitest run --maxWorkers=2
pnpm --dir apps/website exec vitest run --maxWorkers=2
pnpm --dir packages/shared exec vitest run --maxWorkers=2
pnpm --dir apps/mobile exec jest --runInBand
node --test scripts/check-legacy-multitenant.test.mjs
pnpm --dir apps/dashboard lint
git diff --check
```

قبل backend fresh install يلزم توليد Prisma وبناء shared وفق CI؛ هذه المهمة استخدمت اعتماديات وتوليد Prisma الموجودين. لا تشغّل أي test يتصل بقاعدة بيانات قبل تثبيت أن الرابط لقاعدة اختبار معزولة.

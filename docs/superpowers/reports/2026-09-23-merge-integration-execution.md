# تنفيذ خطة الدمج والتحقق — 2026-09-23

## القرار الحالي

اكتملت حزم التكامل المحلية A/B/C باستثناء حذف الحساب، مع D لإصلاح اختبارات المتصفح فقط، في مساحة معزولة. لا يوجد نشر أو commit أو push أو merge إلى فرع مشترك أو حذف فروع/مساحات. تقرير ما قبل الخطة يصف المساحات الأصلية؛ هذا التقرير يصف المرشح المتكامل الجديد.

**لا يُعتمد دمج كل الفروع للإنتاج الآن.** قبول حزمة الدفع يحتاج ميسر sandbox وجهاز iOS؛ حذف الحساب مؤجل؛ النشر للاستيج والقبول اليدوي والإنتاج بوابات مستقلة في [سياسة النشر](../../operations/deployment-policy.md).

## المرشح والمراجع

- المساحة: `/Users/tariq/.codex/worktrees/sawaa-merge-integration/sawaa`.
- الفرع: `codex/merge-preparation-20260923`؛ HEAD هو أساس develop، والتغييرات staged بلا commits جديدة.
- الأساس: `51ac1fd449ab983b97d4f63268705449e1140c18`.
- **Git tree النهائي**: `d74ff474b61e1120c8f870cca06816b05a3e472b` (معرّف محتوى، وليس commit منشورًا).
- A tree: `b85c1e736c4fa78a6776b908c6a65f4261aa1134`؛ AB tree: `d9dd4e8ff32443eb34288ad15691eede52ca81bc`.
- شجرة كود المنتج التي اجتازت builds/unit/real-DB والمراجعة: `ddb196512ba1e31a62466db14f1b577f5b62320d`. أضيفت بعدها D في خمسة ملفات اختبارات متصفح فقط، دون أي تغيير في كود المنتج.
- أعيد تركيب A ثم B ثم C ثم D في index منفصل، وكانت الشجرة الناتجة مطابقة تمامًا للمرشح النهائي.
- سجل الأدلة المحلي: `.superpowers/sdd/2026-09-23-merge-deploy-cleanup/`، ويُستثنى من Docker context؛ لا يرفع إلى Git.
- أعيد فحص remote heads؛ develop/main وPR84/85 لم تتحرك خلال التنفيذ. حماية main/develop لم تُثبت بسبب GitHub API 403؛ لا ادعاء enforcement آلي ولا تجاوز للحماية.

## ما دخل وما بقي محفوظًا

| المصدر | المصير |
|---|---|
| PR84 d07b71005 | A: إزالة scaffolding |
| PR85 5ef7e0d85 | A: قواعد التشغيل/VAT؛ تصحيح تعارض وصف الملفات المحذوفة |
| 95cab4d05 | A: ظهور الموظفين |
| 7a5345108 | A: بقية التنظيف وshared build وDocker guard |
| 2ed8072f1 | استُبدل بمحتوى PR85 المتداخل؛ محفوظ في الأصل والأرشيف |
| 6f09c0c0c وdb89293ce | تقارير تدقيق تاريخية محفوظة بالأصل والأرشيف؛ ليست سلوك إصدار جديد |
| 3b54b7e5a | A: مداخل تعليمات الأدوات |
| dirty backend/dashboard refactors | B: handlers/components/tests؛ إزالة نسخ rename القديمة بعد إثبات تطابقها |
| dirty program-checkout worktree | C: حزمة الدفع/البرامج/التفضيلات/الجوال الأشمل |
| c5dd4a269 | C: تحسينات سطح الجوال والدفع الأشمل يحل محل checkout المختصر؛ تعطيل إرسال APNs إلى FCM |
| ac1883318 وحذف الحساب | خارج المرشح؛ قرار النطاق التشغيلي ما زال مطلوبًا، محفوظ دون فقد |
| migration-charter المحلي | A: وثيقة ميثاق migrations وروابطها |
| ملفات أدوات/cache | بقيت في المساحات الأصلية، لم تُدرج في المرشح ولم تُحذف |

## الحفظ والاستعادة

نسخة مشفرة: `/Users/tariq/.codex/backups/sawaa/merge-20260923-010124/snapshots.tar.gz.enc`؛ المفتاح محفوظ منفصلًا. جرى فك الأرشيف وإعادة بناء المساحتين في Git جديد، ثم تطبيق staged/unstaged/new files ومقارنة hashes وindex. نجحت الاستعادة المستقلة لكليهما. محفوظ 13 ملفًا جديدًا من الرئيسية و21 من الدفع.

بعد التنفيذ طابقت 4103 ملفات في الأصل و4107 في مساحة الدفع hashes الأرشيف، وindex وHEAD لكليهما لم يتغيرا. هذا حفظ للعمل المحلي وليس backup للإنتاج. لا يُحذف أي أصل قبل اجتياز بوابات التنظيف في الخطة.

## التحقق على المرشح المتكامل

Node 22.22.2، pnpm 10.10.0، تثبيت frozen من lockfiles؛ الجوال مستقل عن root workspace.

| الفحص | النتيجة | الحدود |
|---|---|---|
| Backend unit | 845 مجموعة، 7821 ناجح، 0 فشل/تخطٍ | includes legacy writer على DB الحالية |
| Dashboard unit | 263 ملفًا، 2123 ناجح، 0 فشل/تخطٍ | Vitest |
| Website unit | 87 ملفًا، 773 ناجح، 0 فشل/تخطٍ | Vitest |
| Mobile unit | 36 مجموعة، 200 ناجح، 0 فشل/تخطٍ | Jest مستقل |
| Shared unit | 11 ملفًا، 217 ناجح، 0 فشل/تخطٍ | مصدر shared لم يتغير بعد فحص A |
| API client unit | 11 ملفًا، 136 ناجح، 0 فشل/تخطٍ | handwritten client |
| Legacy cleanup guard | 7 ناجح، 0 فشل/تخطٍ | node:test |
| Root typecheck | 8/8 مهام، 0 cache | أُعيد بعد تصحيح rename |
| Mobile typecheck | ناجح | منفصل |
| Lint | 0 أخطاء، 10 تحذيرات dashboard | اختبارات backend المعدلة lint ناجح أيضًا |
| Backend/dashboard/website builds | الثلاثة ناجحة | production build محلي |
| Docker backend/dashboard/website | الثلاثة بُنيت وصُدرت | Linux arm64 build evidence، ليس نشرًا أو image runtime smoke/بناء منصة الإنتاج |
| Migrations | 106 مطبقة؛ immutability ناجحة | DB اختبار معزولة |
| Critical real-DB | 28 مجموعة، 215 ناجح، 0 فشل/تخطٍ | PostgreSQL حقيقي، مزودو الدفع/الخدمات الخارجية mocked |
| Program checkout real-DB/HTTP | 1 مجموعة، 1 ناجح، 0 فشل/تخطٍ | تطابق إعادة المحاولة وحجز مقعد واحد وفاتورة واحدة؛ ليس ميسر sandbox |
| OpenAPI | جرى توليد snapshot/types من backend المتكامل العامل | native enrollment + profile preferences؛ بلا حذف الحساب |
| API drift | 65 endpoint +168 dashboard call ناجحة | تحقق توافق العقود |
| Expo iOS export | ناجح | bundle فقط؛ ليس signed build أو جهازًا |
| Playwright smoke | 38/38 ناجح +4 setup، 0 فشل/تخطٍ | بعد تصحيح fixture؛ ضمن التشغيل الكامل |
| Playwright flows الكامل | 169 ناجح/4 فشل/5 تخطٍ | أخطاء عنوان الاختبار الثابت، لا UI mutation failure |
| إعادة coupons/users بعد إصلاح عنوان الاختبار | 10/10 ناجح +4 setup، 0 فشل/تخطٍ | اختبرت القراءة والإنشاء والتعديل والحذف عبر UI وAPI البيئة نفسها |
| إعادة categories/departments/services | 33/34 ثم 13/13 لإعادة العيادات كاملة بعد تحديد زر الترقيم | نجحت الحالات الخمس التي كانت متخطاة |
| آخر نتيجة لكل اختبار متصفح | 220 ناجح، 0 فشل/تخطٍ/flaky | 4 تهيئة +38 smoke +178 flows؛ محسوبة لكل حالة من full run وإعادات محددة، **ليست تشغيلًا كاملًا أخيرًا واحدًا أخضر** |

### الإخفاقات الأولية والتصحيح

- Backend أولًا: 3 اختبارات فاشلة. اثنان اعتمدا على PUBLIC_WEBSITE_URL الخارجي؛ ثبتنا fixture خاصًا بالاختبار مع استعادة البيئة الأصلية. الثالث كان يتوقع تشغيل legacy importer رغم حاجز قائم يمنعه بعد intake history؛ أصبح يثبت الرفض وعدم تغير بيانات التشغيل والمال. لم يتغير أي منطق إنتاج. نجحت 35 حالة مركزة ثم 7821 كاملة، بلا skips.
- نقل rename: مسار patch انتقائي أبقى أربعة ملفات قديمة بجانب أهداف shared؛ تحقق التطابق ثم حُذفت النسخ القديمة فقط من التكامل.
- iOS export رفض HTTP محليًا كما ينبغي لحماية build الإنتاج؛ نجح بـHTTPS example.test للتجميع فقط.
- Playwright الأول: 40 ناجح/2 فشل. محادثة fixture لم تحمل isAiChat=true فلم يظهر زر العودة للمساعد؛ أصلح fixture محليًا. فشل navigation أظهر تعذر جلسة مؤقت أثناء ضغط Docker builds؛ إعادة الفحص تتم بلا تخفيف assertions أو تغيير auth.
- فحص القوائم: انتقلت خمس حالات من skip إلى بيانات معزولة كافية وعناصر UI الفعلية. صُححت أخطاء المسودة الاختبارية (native Response.ok، مجال fixture، افتراض redirect، وتحديد server pager بين زرين). لا تغيير في كود المنتج ولا تخفيف assertions؛ آخر نتائج جميع الحالات ناجحة، وبيانات المحاولات محفوظة.
- ملاحظة pagination في مراجعة C سُحبت بعد تتبع المسار الحقيقي (ListBookingsHandler/toListResponse). اختبار تجريبي على flat fixture غير مطابق أزيل، ولم يغير runtime.

## المراجعة وحدود القبول

مراجعات A/B وC ثم مراجعة نهائية مستقلة على tree أعلاه لم تثبت regression جوهريًا جديدًا في المسارات المفحوصة. التقارير في AB-review.md وC-review.md وfinal-review.md وD-review.md داخل سجل الأدلة. هذه مراجعات محددة وليست ضمانًا عامًا لكل سيناريو.

- تسجيل push في iOS **معطل صراحةً** حاليًا: يرجع null. مجرد إضافة googleServicesFile لن تفعله؛ يلزم مسار فعلي للحصول على FCM token واختبار جهاز. لا يُوصف بأنه مُنجز.
- يوجد خطر تزامن سابق: enrollment يقرأ public/price/supervisor قبل القفل؛ تحديث إداري متزامن قد يستخدم snapshot قديمًا. لم يقدمه هذا المرشح ولم يُغيّر منطق الدفع لمعالجته ضمن التحضير.
- لا يوجد إثبات جديد لعملية ميسر sandbox حقيقية أو deep-link/عودة باردة على جهاز iOS. لا تُطلق C اعتمادًا على Jest أو export.
- حذف الحساب لم يدخل المرشح؛ لا يُسمى إغلاق الدخول محوًا مكتملًا.
- قبول الاستيج اليدوي، backup إنتاج حديث مع restore drill، ومقارنة revisions الحية إلزامية قبل الإنتاج.

## موارد الاختبار

استخدمت قاعدتا PostgreSQL مستقلتان للاختبارات وللمتصفح داخل حاوية مخصصة، مع Redis وMinIO محليين. لم تُنسخ credentials مزودي الإنتاج، وأزيلت كتلة مفاتيح ميسر من نسخة seed المؤقتة قبل تشغيلها. صور Docker مبنية محليًا arm64؛ لا يوجد نشر لهذه الصور. أوقفتُ عمليتي backend/dashboard وحاويات الاختبار الثلاث المحددة بعد التحقق؛ قواعد الاختبار والأدلة والصور محفوظة. لم تُوقف خدمات مشاريع أخرى أو تُحذف المساحات الأصلية.

## الخطوة التالية حسب الخطة

1. التحقق المحلي والمراجعة وتثبيت المرشح أُنجزت؛ تفاصيل المحاولات والإعادات محفوظة بلا إخفاء الإخفاقات الأولية.
2. اختيار دفعة قابلة للنشر؛ إذا تأجل C فلا تُستعمل نتائج المرشح المركب وحدها كاعتماد نهائي لـA/B: ابنِ المرشح الجزئي وشغّل gates له.
3. عند أمر «انشر»: commits/PR إلى develop والاستيج فقط ثم اختبار المالك لنفس المحتوى.
4. عند قبول الاستيج وأمر «انشر للإنتاج»: backup/restore، release PR ancestry-preserving، ثم نشر والتحقق من revision الفعلي.
5. التنظيف بعد القبول وإعادة فحص الجلسات وحفظ كل commit/dirty؛ لا حذف جماعي ولا force. الفروع الثلاثة المدمجة مرشحة لاحقًا، وفرع PR84 المحلي لا يحذف لمجرد دمج رأس PR القديم.


## Follow-up: push and immediate account closure

The owner subsequently approved immediate closure retaining records. The new local E repair supersedes the previous exclusion of account closure and iOS push code limitation. See [fresh repair evidence](2026-09-23-push-account-closure.md). Combined candidate tree: `f4bb36bdb1d00ad745fdeeb3934811e0b448091f`; previous d74 candidate remains the patch base. Firebase configuration/native-device acceptance remains unverified. No shared merge or deployment occurred.

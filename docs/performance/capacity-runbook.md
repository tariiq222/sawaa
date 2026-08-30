# دليل استخراج السعة الآمنة (Capacity Runbook)

منهجية تنفيذية لاستخراج **أقصى حمل مستدام (max sustainable load)** و**نقطة الكسر (breaking point)** على مكدس Sawa الحالي. النتائج تُقاس وتُسجَّل في تقرير يطابق `quality/performance/report.schema.json`.

> **قاعدة الادّعاء:** لا تُعلن سعة المستخدمين، ولا تُحوَّل RPS إلى «عدد مستخدمين متزامنين»، ولا تُنسَب للمكدس قدرة غير مقيسة. أي رقم في التقرير هو ناتج تشغيل موثّق أو سقف إعداد من المصدر أدناه — لا تخمين.

---

## 0. سلامة التشغيل (إلزامي)

الحمولة (harness) **staging أو محلي فقط**. لا تشغّل مولّد حمل ضد الإنتاج — لا GET ولا غيره. مكدس محلي/staging قد يطابق إعدادات الإنتاج (nginx/redis/prisma) بشرط العزل التام عن السطح الحي.

**ممنوع في كل المراحل:**

- أي كتابة: حجوزات، دفعات، OTP، تسجيل دخول متكرر، رفع ملفات، تقارير تُولَّد على بيانات حية، webhooks، chat.
- أي استدعاء لمزوّد خارجي: Moyasar، SMS، Zoom، Authentica، SMTP، FCM، OpenAI/OpenRouter.
- تخزين أسرار في التقرير أو السجلات المنسوخة: كلمات مرور، توكنات، cookies، `Authorization`، connection strings، مفاتيح، عناوين IP، معرّف خادم، اسم مضيف.
- تعديل هذا الدليل أثناء التشغيل لاستنتاج سعة غير مقيسة.

إذا لُمس مزوّد أو حدثت كتابة غير مقصودة: **أوقف فوراً**، صنّف التشغيل `aborted_safety`، ولا تعتمد الأرقام.

---

## 1. سقوف مؤكدة من المصدر (ليست سعة مقيسة)

هذه حدود إعداد. لا تعني أن النظام «يتحمل» هذا الحمل.

| السقف | القيمة | المصدر | ماذا يعني للاختبار |
|---|---|---|---|
| النسخ | **نسخة واحدة لكل خدمة** | `docker/docker-compose.prod.yml` — لا `replicas:`؛ عملية backend واحدة تجمع HTTP + عمال BullMQ داخل العملية | لا تفترض توزيع حمل بين نسخ backend |
| Prisma pool | **`max: 25`** | `apps/backend/src/infrastructure/database/prisma.service.ts` (`PrismaPg`) | هذا سقف الاتصالات من التطبيق. `DATABASE_URL` في compose يمرّر `connection_limit=${DB_CONNECTION_LIMIT:-10}` — مع adapter-pg القيمة الفعلية هي `max` في الكود ما لم يُثبت `pg_stat_activity` خلاف ذلك. سجّل الاثنين |
| Redis | **200mb + `noeviction`** | `docker/redis.conf` | عند الامتلاء تُرفض الكتابات؛ لا إخلاء مفاتيح. راقب `used_memory` ورفض الأوامر |
| nginx per-IP API | **30 req/s**، burst 50 `nodelay`، رد **429** | `docker/nginx/nginx.conf` `zone=api_limit` | اختبار من IP واحد يصطدم بهذا السقف قبل كسر التطبيق |
| nginx per-IP auth | **5 req/s**، burst 10 `nodelay`، **429** | `zone=auth_limit` على `/api/v1/(auth\|otp)/` | لا تستخدم auth/otp في المرحلة 1 |
| nginx اتصالات | `worker_processes auto`؛ `worker_connections 1024`؛ `worker_rlimit_nofile 2048`؛ upstream `keepalive 32`؛ `keepalive_timeout 65` | `nginx.conf` | سقف اتصالات نظري = workers × 1024 — **غير مقيس** حتى يُرصد |
| nginx timeouts | connect **10s**؛ read/send **30s** (لوحة/موقع **60s**؛ SSE **300s**) | `proxy_params_common.conf` + مواقع nginx | المهلة تُحسب انهياراً إن لم تكن 429 |
| nginx جسم الطلب | **20M** | `client_max_body_size` | يخص `report_upload` فقط (خارج المرحلة 1) |
| Nest throttler (افتراضي) | **300 طلب / 60s لكل IP** (Redis) | `app.module.ts` `ThrottlerModule` `{ ttl: 60_000, limit: 300 }` | سقف عام للمسارات بلا `@Throttle` أضيق. **ليس** الحد الفعلي للمسارات المقاسة أدناه |
| Nest `@Throttle` — `public/services` و`public/employees` | **30 طلب / 60s** | `catalog.controller.ts` (`@Controller('public/services')`)؛ `employees.controller.ts` | حد المسار المقاس. 429 حماية لا سعة. لا تفسّر 300/60 على هذه المسارات |
| Nest `@Throttle` — `public/branding` و`public/testimonials` و`public/programs` (GET) | **60 طلب / 60s** | `branding.controller.ts`؛ `testimonials.controller.ts`؛ `bookings.controller.ts` (`PublicProgramsController` `@Get` / `@Get(':id')`) | حد المسار المقاس. 429 حماية لا سعة. `POST .../enroll` خارج المرحلة 1 (حد 5/60s) |
| express-rate-limit على `/api/v1/auth` | **20 / 15 دقيقة** | `main.ts` | لا تختبره في المرحلة 1 |
| Redis حاوية (إن طُبّقت) | حد ذاكرة compose **256M** / CPU **0.25** فوق سقف Redis 200mb | `docker-compose.prod.yml` | انظر §2 |

### حدود الموارد المشروطة بطريقة النشر

`deploy.resources.limits` في `docker-compose.prod.yml`:

| خدمة | ذاكرة | CPU |
|---|---|---|
| backend | 1536M | 1.5 |
| dashboard | 512M | 0.5 |
| website | 512M | 0.5 |
| postgres | 1G | 1.0 |
| redis | 256M | 0.25 |
| minio | 512M | 0.5 |
| nginx | 128M | 0.25 |

**شرط الإنفاذ:** لا تجزم من اسم أمر Compose (`docker compose up` أو Swarm أو غيره) بأن `deploy.resources.limits` مفعّلة أو غير مفعّلة. الإنفاذ يعتمد على محرّك النشر وcgroup الظاهر للحاوية. قبل أي تشغيل:

1. اقرأ cgroup للحاويات (`memory.current` / `memory.max` أو المكافئ).
2. سجّل `limitsEnforced: true|false|unknown` و`limitsEnforcementMethod: swarm|cgroup|none|unknown` وفق ما يثبته cgroup لا وفق الافتراض.
3. إن لم يُثبت cgroup حداً، عامل الحدود كـ `unknown` — السقف المرصود هو المضيف إلى أن يُثبت خلاف ذلك. لا تخلط نتائج تشغيل بحدود مثبتة مع تشغيل بلا إثبات.

---

## 2. إثبات المضيف (مواصفات مرصودة ≠ مضيف مثبت)

وُصفت مواصفات مرصودة لمضيف من فئة **4 dedicated CPU / 16GB RAM**. هذا **ادعاء غير مثبت** حتى يُبرهَن أن المكدس تحت الاختبار يعمل على ذلك المضيف نفسه.

**أثبت دون ذكر IP أو معرّف خادم أو اسم مضيف:**

1. `nproc` (أو عدد CPUs الظاهرة للحاويات).
2. `MemTotal` من `/proc/meminfo` (بايت).
3. دليل أن حاويات الهدف (backend/nginx/postgres/redis) تعمل على **نفس** ذلك النواة/cgroup hierarchy (مثلاً تطابق `memory.max` للحاويات مع حدود §1 إن كانت مفعّلة).
4. في التقرير: `cpuCountObserved`، `memoryBytesObserved`، `provenAsActualHost: true|false`.

إذا فشل الإثبات: `provenAsActualHost: false` و`verdict.classification = invalid_run` لأي ادّعاء يربط النتيجة بتلك المواصفات. لا تذكر IP/server ID/hostname في أي حقل.

---

## 3. ملامح الحمل (Workload profiles)

| المعرّف | ماذا يقيس | مسارات مسموحة (قراءة) | المرحلة 1 |
|---|---|---|---|
| `edge_public` | المسار العلني عبر nginx (موقع + APIs عامة) | `GET /` للموقع؛ `GET /api/v1/public/employees`؛ `GET /api/v1/public/services`؛ `GET /api/v1/public/testimonials`؛ `GET /api/v1/public/programs`؛ `GET /api/v1/public/branding` | نعم |
| `backend_direct_read` | التطبيق بدون nginx (عزل الحافة عن Nest/Prisma) | نفس GETs العامة على منفذ backend الداخلي **5200**، أو `GET /api/v1/health/live` | نعم |
| `dashboard_browser` | جلسة لوحة (متصفح حقيقي أو إعادة تمثيل استعلامات المتصفح) | صفحات لوحة للقراءة بعد تسجيل دخول **حساب اختبار على staging**؛ لا mutations | نعم بحذر |
| `availability` | مجسّات الحياة/الجاهزية تحت الحمل | `GET /nginx-health`؛ `GET /api/v1/health/live`؛ `GET /api/v1/health/ready` (الأخير يلمس DB + Redis + BullMQ + MinIO) | نعم |
| `report_upload` | تقارير Excel/JSON ورفع حتى 20M | توليد تقرير / رفع مرفقات | **لا — خارج المرحلة 1** |

### ملاحظات تنفيذ للملامح

- **الصفحة الرئيسية للموقع** (`apps/website/themes/sawaa/pages/home.tsx`) تطلق أربع قراءات خلفية متوازية (موظفين، كتالوج، شهادات، برامج) مع `safeFetch`. قياس `GET /` عبر الحافة ≠ قياس API واحد.
- **الداشبورد** (`query-provider.tsx`): `staleTime` 5 دقائق، بلا refetch عند التركيز أو mount، وإعادة محاولة واحدة لأخطاء 5xx/شبكة فقط. فيضان HTTP على APIs اللوحة **ليس** مكافئاً لمستخدم متصفح. سجّل إن كان المولّد متصفحاً أم HTTP خام.
- **لا** تُشغَّل auth/otp/chat/payments/uploads في المرحلة 1.
- وزّع مصدر الحمل على أكثر من عنوان إن كان الهدف قياس ما خلف حد nginx per-IP. عدد المصادر يُسجَّل كعدد صحيح (`sourceIpCount`) **بدون** قائمة العناوين. تشغيل من مصدر واحد عبر الحافة يقيس سقف nginx 30r/s لا سعة المكدس. على `backend_direct_read` يصطدم المصدر الواحد أولاً بـ `@Throttle` للمسار (30/60s أو 60/60s أعلاه) لا بالسقف العام 300/60.

---

## 4. تعريفات القياس

| المصطلح | تعريف تشغيلي |
|---|---|
| **Warm-up** | 30–60 ثانية (أو حتى استقرار p95) تُحذف من الإحصاء. لا تُستخدم لاستنتاج سعة. |
| **Steady state** | نافذة ≥ 3 دقائق بعد الإحماء عند حمل ثابت. كل قبول SLO يُحسب هنا فقط. |
| **Soak** | ≥ 15 دقيقة عند مرشح الاستدامة (يمكن توثيق 5 دقائق كحد أدنى للمرحلة 1 مع `invalid_run` إن نُشر الرقم كسعة نهائية). |
| **Repeated runs** | ≥ 3 تشغيلات مستقلة لنفس الملمح والحمل بعد تبريد قصير. مرشح الاستدامة يُقبل فقط إذا نجحت **كل** التكرارات. لا تُوسَّط نقاط الكسر إلى «سعة». |
| **Sustainable load** | أعلى **حمل مقدَّم (offered RPS)** تتحقق فيه كل بوابات القبول (§5) طوال steady state + soak، دون بوابة إيقاف، مع اتفاق التكرارات. يُكتب كـ RPS للملمح المحدد فقط. |
| **Breaking point** | أول حمل (بعد الإحماء) يفشل فيه SLO، أو تُفعَّل بوابة إيقاف، أو يحدث **انهيار** — أيهما أسبق. سجّل الحمل السابق الناجح والحمل الفاشل. |
| **429 protection** | 429 من nginx/throttler مع بقاء العملية جاهزة، و`health/ready` ناجح، وعدم استنفاد pool/ذاكرة، وبقاء p95 للردود **المقبولة (غير 429)** ضمن SLO. هذا حماية لا نقطة كسر. |
| **Collapse** | 5xx، timeouts، رفض اتصال، فشل `ready`، OOM، Redis يرفض كتابات بسبب `noeviction`، انتظار Prisma/Postgres، تراكم BullMQ stalled/failed، أو قتل العملية. |
| **Safety stop** | أوقف المولّد فوراً وصنّف `aborted_safety` عند أي بوابة في §6. لا ترفع الحمل بعدها. |

لا تخلط حماية 429 مع الانهيار في خانة واحدة. استخدم `verdict.protectionVsCollapse`.

---

## 5. قبول النتيجة (Acceptance)

لا تُقبل نتيجة `sustainable` إلا إذا قيست **كل** المجموعات التالية في steady state (وخلال soak للمرشح النهائي):

### HTTP

- p50 / p95 / p99 بالمللي ثانية للطلبات المكتملة.
- RPS مقدَّم vs مقبول (مقبول = استجابة HTTP مكتملة، بما فيها 429).
- أعداد: 2xx، 429، 4xx الأخرى، 5xx، timeouts، other.
- معدل أخطاء الانهيار = (5xx + timeouts + other) / المقدَّم. **429 لا يدخل** بسط الانهيار.

قبل التشغيل حدّد SLO زمنياً للملمح (مثال: p95 لـ `health/live` ≤ قيمة تُسجَّل في التقرير). الـ SLO قالب قياس، ليس ادّعاء سعة مستخدمين.

### process / cgroup

- CPU و RSS لـ backend و(حسب الملمح) website/dashboard/nginx.
- `memory.current` مقابل `memory.max` إن وُجد cgroup.
- إن `limitsEnforced=true` يفشل القبول عند اقتراب الذاكرة من 90% من الحد أو إعادة تشغيل الحاوية.

### DB pool

- `configuredMax = 25`.
- عدد الاتصالات النشطة/الخاملة/المنتظرة من التطبيق إن توفرت، وإلا `pg_stat_activity` (عدّ فقط، بلا استعلامات أو بيانات صفوف).
- فشل القبول إذا طابور انتظار pool ينمو مع استمرار الحمل، أو اقترب عدد الجلسات من سقف Postgres.

### Redis

- `used_memory` مقابل 200mb؛ `maxmemory-policy=noeviction`؛ `evicted_keys` يجب أن يبقى 0؛ راقب الرفض/`rejected_connections`.
- فشل القبول عند ≥ 90% من 200mb مع اتجاه صاعد، أو أخطاء OOM من Redis.

### BullMQ

- counts: waiting / active / delayed / failed / stalled (من `health/ready` للحقل `bullmq` أو `getJobCounts` عبر تشغيل قراءة داخلية مصرّح بها — لا تُنشئ jobs).
- فشل القبول عند نمو failed/stalled أو تعذّر اتصال الطابور أثناء الحمل.

### Data invariants (قراءة فقط)

قبل وبعد كل تشغيل، عدّادات لا تكشف PII، مثل عدد صفوف `Booking` / `Payment` / `OtpCode` (أو جداول مكافئة متفق عليها في staging). يجب `unchanged: true`. أي زيادة = كتابة غير مقصودة = `aborted_safety`.

---

## 6. بوابات الإيقاف الآمن (Safety stop gates)

أوقف فوراً إذا تحقق أي شرط:

1. `GET /api/v1/health/ready` غير 200 لثلاث محاولات متتالية (فاصل ≥ 5s).
2. RSS أو cgroup memory ≥ 90% من الحد المُثبت، أو إعادة تشغيل حاوية.
3. Redis `used_memory` ≥ 90% من 200mb أو أخطاء رفض كتابة.
4. انتظار اتصال Prisma/Postgres أو ارتفاع حاد في جلسات `pg_stat_activity` نحو السقف.
5. معدل 5xx+timeout > عتبة تُحدَّد قبل التشغيل (اقترح 1% من المقدَّم كحد إيقاف — ليست SLO سعة).
6. المضيف: ضغط ذاكرة / OOM killer / قرص ممتلئ (بدون تسجيل اسم المضيف).
7. تغيّر invariant البيانات.
8. أي طلب خرج إلى مزوّد خارجي.

بعد الإيقاف: لا ترفع الحمل؛ خزّن التقرير؛ `classification = aborted_safety`.

---

## 7. إجراء المرحلة 1 (تنفيذي)

البيئة: staging أو compose محلي معزول بنفس nginx/redis/prisma. **ليس** إنتاجاً حياً. المولّد اختياري (k6 أو مكافئ) ما دام التقرير يطابق المخطط والحمل لا يُوجَّه لسطح إنتاجي.

1. **تحضير**
   - ثبّت المضيف (§2) وحدود cgroup (§1).
   - اقرأ `GET /api/v1/health/live` وسجّل `version` و`gitSha` فقط.
   - التقط invariants.
   - أكّد أن الملمح ∈ المرحلة 1 وأن `writeOperations=false` و`providersTouched=[]`.
   - حدّد SLO p95 ومصدر الحمل (`sourceIpCount`).
2. **إحماء** عند حمل منخفض؛ احذف النافذة.
3. **تصعيد درجات** (مثال درجات لا سعة: 5 → 10 → 20 → 30 RPS ثم زيادات صغيرة). عند كل درجة: steady state ≥ 3 دقائق + مجسّات §5.
    - إذا ظهرت 429 مع بقاء ready وp95 للمقبول ضمن SLO: سجّل `protected_429` عند هذا الحمل **ولا** تعتبره كسراً. من مصدر واحد عبر الحافة قد يكون سقف nginx 30r/s؛ على المسارات المقاسة مباشرة قد يكون `@Throttle` (30/60s أو 60/60s) لا السقف العام 300/60 ولا سعة التطبيق.
   - إذا انهار أو فشل SLO: سجّل breaking point = هذه الدرجة؛ المرشح المستدام = آخر درجة ناجحة.
4. **تكرار** المرشح المستدام 3 مرات.
5. **Soak** على المرشح إن اتفقت التكرارات.
6. **لا** تشغّل `report_upload`.
7. اكتب تقريراً JSON يطابق المخطط. اترك `sustainableCandidateRps` / `breakingPointRps` = `null` إن لم تُقس.

أدوات الرصد المسموحة (قراءة): `health/live`، `health/ready`، docker/cgroup stats، `redis-cli INFO memory` (بدون كلمة مرور في التقرير)، `pg_stat_activity` count. لا تُخرج `INTERNAL_METRICS_TOKEN` ولا أجسام مقاييس فيها أسرار.

---

## 8. التقرير

كل تشغيل → ملف JSON يطابق `quality/performance/report.schema.json`.

الحقول الجذرية: `metadata`، `run`، `scenario`، `http`، `resources`، `dependencies`، `verdict`، `artifacts`.

`verdict.classification`:

- `sustainable` — مرشح اتفق عليه بالتكرار + soak + كل §5.
- `breaking` — نُقطة كسر مقيسة (انهيار أو فشل SLO لا حماية 429 وحدها).
- `protected_429` — الحد الظاهر هو حماية per-IP/throttler.
- `aborted_safety` — بوابة إيقاف.
- `invalid_run` — مضيف غير مثبت، حدود غير موثّقة، أو خلط ملامح.
- `not_measured` — لم يُشغَّل القياس (القيمة الابتدائية الصادقة).

`verdict.claimsForbidden` يبقى تذكيراً ثابتاً: يُمنع تفسير RPS كعدد مستخدمين.

---

## 9. ما لا يُقال بعد القياس

حتى مع أرقام صحيحة:

- لا: «النظام يتحمل X مستخدماً».
- لا: دمج ملامح مختلفة في رقم واحد.
- لا: معاملة سقف nginx 30r/s من IP واحد على أنه سعة المنتج.
- لا: استخدام تشغيل بلا cgroup للحديث عن حدود `deploy.resources`.
- لا: نشر رقم من تشغيل واحد دون تكرار.

ما يُقال: «لملمح `edge_public` على هذا المكدس الموثَّق، أقصى offered RPS مستدام مقيس هو N (أو غير مقيس).»

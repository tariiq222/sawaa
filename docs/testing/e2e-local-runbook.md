# تشغيل الحجز والدفع والتطبيق محليًا

الحزمة اختيارية ومعزولة عن إعداد smoke الافتراضي. تبدأ قاعدة pgvector جديدة لكل تشغيل، وRedis وMinIO مستقلين، وبيانات صناعية فقط. منافذها: الباك 55200، اللوحة 55203، الموقع 55205، Postgres 55761، Redis 55762، MinIO 55763. لا تستخدم قاعدة التطوير أو staging أو الإنتاج.

## التجهيز

```bash
pnpm install --frozen-lockfile
pnpm --filter backend build
pnpm e2e:local:safety
pnpm e2e:local:stack
```

أبقِ أمر stack مفتوحًا. يطبع `READY` ومسارًا مثل `.e2e/local-<timestamp>`؛ استبدل `<runDir>` أدناه بذلك المسار. يطبق migrations الموجودة دون تعديلها، ويولّد كلمات مرور ومفاتيح تشفير/JWT جديدة في ملف خاص متجاهل من Git. لا تطبع `environment.json` ولا تنسخه إلى التوثيق.

أوقف خوادم Next التطويرية الأخرى لنفس checkout قبل البدء؛ لا يجوز وجود كاتبين متزامنين إلى `.next`. الحزمة ترفض المنافذ المشغولة ولا توقف عمليات غير مملوكة لها. شبكة Docker المخصصة `10.247.163.0/24` يجب أن تكون متاحة؛ لا تحذف شبكات أخرى لإرضاء التشغيل.

## الموقع ثم الموظف

```bash
node e2e/local/with-env.mjs <runDir> pnpm exec e2e run --config e2e.local.config.ts --target website --tag booking --output .e2e/phase2-web
node e2e/local/with-env.mjs <runDir> pnpm exec e2e run --config e2e.local.config.ts --target dashboard --tag booking --output .e2e/phase2-dashboard
```

SW-B03 ينفذ دخول العميل والعيادة والخدمة والممارس والموعد والدفع عند المركز عبر الموقع. يتحقق من حجز واحد، المعرفات، وقت البداية والنهاية وطريقة التقديم، 30000 هللة وSAR وحالة CONFIRMED وغياب الفاتورة. ثم يعيد فتح التفاصيل بعد reload. SW-D02 يعتمد على إيصال الموقع ويقرأ الحجز نفسه من واجهة الموظف، ويقارن رقم الحجز والممارس والتاريخ والوقت والمبلغ والحالة.

كل عميل له حجز واحد فقط؛ لا تكرر اختبار إنشاء حجز ناجح على قاعدة التشغيل نفسها. ابدأ stack جديدًا. التخطيات الخاصة بالهدف الآخر متوقعة، وليست تغطية إضافية.

## Moyasar Sandbox

أنشئ ملف JSON خاصًا بصلاحية 600 في مكان متجاهل من Git، يحتوي `publishableKey` و`secretKey` التجريبيين. لا تكتب المفاتيح في الأمر أو المحادثة أو source. الإعداد يرفض مفاتيح live ويتحقق من اعتماد Sandbox قبل تمكينه في قاعدة التشغيل المعزولة فقط.

```bash
node e2e/local/with-env.mjs <runDir> node e2e/local/sandbox.mjs <private-test-keys.json>
node e2e/local/with-env.mjs <runDir> pnpm exec e2e run --config e2e.local.config.ts --target website --tag payment --output .e2e/phase2-payment
```

احذف ملف إدخال الأسرار الخاص بعد الإعداد. يحتفظ الباك بالسر مشفرًا في قاعدة الاختبار؛ ملف بيئة الحزمة يحمل المفتاح العام التجريبي لاستئناف قراءة محاولة سابقة فقط.

SW-P01 يختبر عقد Native API مع المزود الحقيقي: دخول عميل صناعي منفصل، حجز AWAITING_PAYMENT، فاتورة DRAFT، حجز UUID لمحاولة الدفع، إرسال بطاقة الاختبار الرسمية مباشرة إلى Moyasar، التحقق من البطاقة، ثم reconcile من الباك. النهاية المطلوبة دفعة واحدة COMPLETED وفاتورة PAID وحجز CONFIRMED. تأكيد الحجز مستهلك أحداث غير متزامن لذلك ننتظر نتيجته. تكرار reconcile لا يكرر الدفعة.

إذا انقطع التشغيل بعد POST، يستعلم الاختبار عن المحاولة نفسها؛ لا يرسل ثانية إلا إذا أكد الباك غيابها لدى المزود. محاولة initiated تُستكمل عبر GET ورابط التحقق نفسه. المحاولات الفاشلة/المغلقة تحتاج قاعدة تشغيل جديدة. رابط عودة SDK تعالجه طبقة المتصفح محليًا كما يعترضه SDK؛ حالة الدفع لا تُضبط أو تُحاكى وتُقرأ من Moyasar بواسطة الباك.

هذا لا يختبر واجهة SDK داخل التطبيق، أو checkout الموقع المستضاف، أو وصول webhook إلى الباك المحلي، أو Apple Pay. لا تخلط هذه الأدلة.

## تطبيق iOS

ثبّت اعتماديات التطبيق مستقلةً عن root:

```bash
pnpm --dir apps/mobile install --frozen-lockfile --ignore-workspace
```

أنشئ Simulator مخصصًا باسم يبدأ بـ `Sawaa TesterArmy isolated` باستخدام runtime/device type المتاحين في `xcrun simctl list`. استخدم Debug simulator `.app` موثوقًا للحزمة `sa.sawa.app` دون `main.jsbundle`؛ ليس ملف جهاز فعلي أو TestFlight. يجب أن يدعم native modules الحالية، بما فيها Moyasar.

```bash
node e2e/local/with-env.mjs <runDir> node e2e/local/mobile.mjs <dedicatedSimulatorUUID> <verifiedDebugAppPath>
```

الـwrapper يرفض Metro موجودًا على 8081، ويبدأ Metro يملكه ببيئة محدودة، `EXPO_NO_DOTENV=1` وAPI محلي صريح، ويتحقق من ملكية المنفذ. الإعداد يرفض التشغيل دون attestation حية تربط الجهاز وملف التطبيق وبصمته وMetro وقاعدة الاختبار. لا تشغل `e2e.mobile.config.ts` مباشرةً.

SW-M01 يعيد تثبيت التطبيق ويمسح Keychain على المحاكي المخصص فقط، ثم يدخل بكلمة مرور فعلية ويكمل الحجز عند المركز بعميل وموعد مختلفين. يعالج لوحة المفاتيح ونافذة حفظ كلمة المرور في iOS. يكتب تقريرًا تحت `.e2e/phase2-mobile` وإيصالًا في runDir.

## الأدلة والإيقاف

اقرأ report.json والتخطيات والأخطاء، وقارن إيصالات `web-receipt.json` و`mobile-receipt.json` و`payment-receipt.json` بالسيناريو. لا تكتفِ برمز خروج صفر أو رسالة UI. ملفات البيئة خاصة وليست مرفقات مراجعة.

أوقف stack بـ Ctrl-C بعد انتهاء الاختبارات؛ يوقف عملياته وCompose project الخاص به، ويحتفظ بالـvolumes والأدلة. wrapper التطبيق يوقف Metro الذي أنشأه ويزيل attestation تلقائيًا. لا حذف تلقائي لبيانات أو volumes أو أجهزة المستخدم، ولا commit أو نشر ضمن هذه الأوامر.

حد نسخة المحاكي المستخدمة في دليل 2026-10-08: artifact من 2026-10-05 مع JavaScript الحالي من Metro. ظهر أن native Intl يعرض التاريخ الهجري رغم خيار الميلادي في المصدر؛ الاختبار يقبل الاسم الكامل لليوم نفسه بالتقويمين ثم يطابق ISO الدقيق في قاعدة البيانات. هذا لا يثبت صحة عرض التقويم الميلادي أو توافق بناء iOS جديد، ويحتاج تحققًا على بناء حديث منفصل.

## Phase 3: financial contracts and native payment UI

Run `node e2e/local/contracts.mjs` for seven selected existing backend contract
suites. This creates its own loopback Postgres on 55861, migrates it, runs Jest
serially and removes only its owned container. It retains the data volume. The
provider/Redis/queue mocks from `test/setup-e2e.ts` still apply: this lane proves
HTTP/database contracts, not real webhook delivery or native UI.

For native card payment, start a fresh `node e2e/local/stack.mjs` run and enable
Sandbox with the existing private-file setup. Run the ordinary mobile wrapper
with an additional final `payment` argument; it selects
`e2e.mobile-payment.config.ts` and writes `.e2e/phase3-mobile-payment`.
The reserved payment client must have no bookings before the scenario starts.
If a run stops after creation, inspect its existing booking/payment before any
retry; do not automatically create another booking.

For real webhook delivery, run `node e2e/local/with-env.mjs <runDir> node
e2e/local/webhook.mjs` before submitting a test payment. The owned HTTPS tunnel
exposes only a random webhook path on a separate local proxy. It authenticates
the shared secret, forwards only payments belonging to the fixture's clients,
and records no raw payloads. It registers only payment_paid/payment_failed using
the test secret key. Stop it with SIGINT/SIGTERM to delete that exact subscription
and close the tunnel; verify `webhook-receipt.json.deleted` is true. A registration
network failure can be ambiguous: use the private registration URL to investigate
before retrying; never delete another webhook.

After an actual paid delivery, `webhook-replay.mjs` checks invalid signature and
signed duplicate replay without changing the paid invoice or its payment rows.
This distinguishes provider-delivered evidence from locally replayed evidence.

`stack.mjs --apple-pay` explicitly enables the owned fixture's merchant capability
using `merchant.sa.sawa.app`. It still starts with Moyasar disabled until Sandbox
credentials have been validated. Physical device builds must use a private-network
Debug API address and matching merchant entitlement. The Simulator wrapper remains
bound to loopback and does not authorize a physical-device claim.

### Phase 3 package UI fixture and verification

After the fresh card suite has passed, create one isolated public two-session
package through the staff API:

```sh
node e2e/local/with-env.mjs <runDir> node e2e/local/package-fixture.mjs
```

In the native app as the synthetic `payment` client, purchase the package with
Moyasar Sandbox, book the first credit at `fixture.appointments.mobile`, then run:

```sh
node e2e/local/with-env.mjs <runDir> node e2e/local/verify-package.mjs reserved
```

With the local cancellation policy configured by `cancellation.mjs`, cancel that
package appointment in the native UI, then verify returned credit:

```sh
node e2e/local/with-env.mjs <runDir> node e2e/local/verify-package.mjs cancelled
```

These verification scripts assert real persisted state; they do not drive the UI.
Retain the native interaction recording as separate evidence.

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

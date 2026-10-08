# نسخة iOS لتوحيد الواجهات — 2026-10-08 — البناء26

الحالة الحالية: **1.0.0 (26) متاح في TestFlight ضمن Sawaa Internal**. EAS FINISHED وApple VALID وIN_BETA_TESTING؛ يوجد مختبر واحد في المجموعة. حُفظت ملاحظات الاختبار بالعربية وإقرار التشفير، وتحقق بقاؤهما مع المجموعة بعد إعادة تحميل الصفحة وعبر API. هذا قبول تسليم النسخة الداخلية، وليس قبول جهاز/مزود.

## المصدر والنطاق

طلب المالك إعادة بناء تحسينات الجوال على TestFlight. جُمعت تحسينات الواجهات المعتمدة على أحدث `origin/develop` الذي تم جلبه عند `647bad08bcf6548d6f9c554ccdac85d32ac61d86`، للحفاظ على دخول كلمة المرور واستعادة الحساب وإصلاحات قراءة الموارد واستئناف الدفع. مصدر UI الأصلي detached عند `0a6083c1f98b040be57601febb75a5c31b8d1177`، وبقيت تعديلاته الأصلية محفوظة بلا تغيير.

حُلّت46 تعارضًا عبر ثلاثة وكلاء مستقلين بنطاقات الأساس، العميل والحجز، الحساب والموظف. مرشح البناء مشتق محليًا خارج Git؛ لا يوجد commit جديد يُنسب إليه. المصدر الدقيق محفوظ في `/Users/tariq/.codex/release-evidence/2026-10-08-mobile-ui-testflight/candidate` مع manifest ببصمات728 ملفًا، وأرشيف EAS مطابق. يحتوي تحديث الخطوط والأزرار والحقول وحالات العرض وخلفية Aqua وقياس footer والتمرير وتفاصيل إصدار التطبيق؛ حافظت مراجعة المصدر على أحدث منطق المصادقة والدفع وquery hooks.

لا commit أو push أو merge أو نشر backend أو إرسال App Review ضمن هذا الطلب.

## التحقق المحلي

- تثبيت frozen للجوال وبناء shared: نجحا.
- Mobile typecheck وLint: نجاح exit0.
- Jest النهائي:222 مجموعة و1589 اختبارًا، جميعها ناجحة. استخدم `--forceExit` بعد اكتمال الاختبارات؛ تبقى مؤقتات query في بيئة الاختبار، فلا يعد ذلك إثباتًا لتنظيف كل الموارد.
- مراجعة مستقلة للمصدر: لا ملاحظات مانعة؛32 ملفًا رئيسيًا موثقة بالبصمات.161/163 ملفًا في الخدمات والهوكس والحالة والثوابت وfeatures تطابق أحدث develop؛ فرق NativePaymentForm المعتمد واختباره يخص ارتفاع زر البطاقة.
- `build:inspect` النهائي:4721 ملفًا، تطابق728 ملف مصدر مطلوب، دون مفاتيح/شهادات/credentials/.env فعلي أو مجلدات iOS المولدة أو fixture.
- ملف توقيع Apple ACTIVE، صالح حتى2027-09-24، ويطابق الشهادة وteam وbundle وApple Pay merchant؛ فحص IPA النهائي نجح: ZIP وcodesign strict،get-task-allow=false،push=production،team/bundle/build/merchant/profile مطابقة،SDK iphoneos26.2. الحزمة تتضمن API الاستيج وتستبعد عنوان API الإنتاج؛ توجد5 أوزان IBM وخلفيتا Aqua ووحدتا PassKit وexpo-application.

## إعداد البناء

EAS `f890bd7f-3910-4d6c-930f-a34dbd7a2c4f`؛ رقم البناء الفعلي26، الإصدار1.0.0.

ملف `testflight-staging` مؤقت داخل المرشح فقط، يمتد من production، قناة staging، وEAS environment production لاستخدام إعداد Firebase الموجود. قيمة API الصريحة `https://staging.sawaa.sa/api/v1` تتقدم على متغير الحساب؛ merchant `merchant.sa.sawa.app`؛ signing محلي موجود. لم تتغير إعدادات EAS العامة أو production profile الأصلي. تحقق guard من رفض missing/local URL في release.

## حدود القبول

البناء الداخلي للتجربة لا يثبت نجاح الجهاز الفعلي أو Moyasar/Apple Pay لهذه النسخة. Dashboard smoke السابق فشل429 قبل assertions ولم يُعدّ ناجحًا؛ اختبار المزود وعمليات الدفع الفعلية لم تُنفذ هنا. يبقى قبول جميع الصفحات وVoiceOver/ReduceMotion والكيبورد/التعبئة والتبويبات والإشعارات والجلسات على الجهاز مفتوحًا. في المحاكي عند خط214% لوحظت مساحة إضافية مع لوحة مفاتيح البطاقة وتداخل placeholder مع شعارات الشبكات. لا يشمل هذا الطلب Android.

## الأدلة والقياس

الأدلة الخاصة في `/Users/tariq/.codex/release-evidence/2026-10-08-mobile-ui-testflight/`: `source-manifest.json`، `archive-verification.json`، `validation.json`، تقارير الوكلاء والمراجعة وملفات EAS. لا تحفظ روابط التنزيل الموقعة أو بيانات اعتماد في Git.

سياسة sol61-all-v1، جميع المشاركين GPT-6.1 Sol. receipt `mobile-ui-testflight-20261008` بدأ بقياس متأخر؛ استهلاك المهمة الكامل غير معلوم ولا توجد دعوى توفير للحصة.

Apple delivery UUID: `581867ac-5da8-44d2-9f92-3f8f8291bf4b`. IPA SHA256: `581e228e0175d7c4c41425fe0376bb4c825147ade6a6ec279ffe8f074f83bd88`.

## التسليم النهائي

Apple build ID وdelivery UUID كلاهما `581867ac-5da8-44d2-9f92-3f8f8291bf4b`. مجموعة `Sawaa Internal` الموجودة تضم البناء26 ومختبرًا واحدًا؛ `usesNonExemptEncryption=false` بناءً على القرار السابق وعدم إضافة وظيفة تشفير جديدة، فالاعتماد الجديد الوحيد expo-application لبيانات الإصدار. رفض المفتاح المقيد PATCH التشفير بـ403؛ أكملت الخطوة عبر جلسة المالك في App Store Connect دون إنشاء مفتاح أو تغيير صلاحيات. ثم حفظت What to Test وأضفت المجموعة عبر الواجهة وأعدت فتح الصفحة للتحقق؛ API أكد VALID وIN_BETA_TESTING والملاحظات المطابقة.

تحديثات Expo OTA معطلة في IPA ولا يوجد updates URL؛ التصميم المشحون موجود في الحزمة نفسها. لا إرسال App Review ولا نشر backend/إنتاج ولا تغيير بيانات production.

[إثبات التسليم](../audits/2026-10-08-testflight-build26/acceptance.json) و[صورة App Store Connect](../audits/2026-10-08-testflight-build26/testflight-build26.jpg). افتح TestFlight على iPhone وحدّث إلى1.0.0(26)، ثم اختبر نطاق الملاحظات؛ بقاء حدود الجهاز/المزود المذكورة أعلاه مقصود.

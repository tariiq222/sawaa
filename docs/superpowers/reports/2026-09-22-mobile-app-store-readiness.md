# تدقيق جاهزية تطبيق سواء لمتجر Apple — 22 سبتمبر 2026

**الحكم: غير جاهز للإرسال للمراجعة حاليًا.** توجد نواقص مؤكدة في تجربة المستخدم، وإعدادات الإصدار، وأدلة الاختبار. هذا تدقيق للكود المحلي الحالي؛ لم يتم إصلاح الكود أو إنشاء إصدار موقّع أو رفعه.

النطاق: `/Users/tariq/code/sawaa/apps/mobile` مع تتبّع المسارات الخلفية المتصلة بالنتائج. الفرع عند الفحص `feature/remove-dead-saas-scaffolding`، وHEAD هو `95cab4d05`. توجد تعديلات سابقة غير ملتزم بها؛ بقيت محفوظة. تولى المنسق إعدادات الإصدار والفحوص ومراجعة الأدلة، وفحص Luna شاشات الحساب والخصوصية والدفع والوظائف الظاهرة بالقراءة فقط.

## النواقص المؤكدة

### 1. لا يوجد مسار لبدء حذف حساب العميل من التطبيق

التسجيل متاح، بينما شاشة الحساب والإعدادات لا تعرضان حذف الحساب أو بدء طلب حذفه. واجهتا الحساب للجوال تعرضان التسجيل والمصادقة والخروج وقراءة الملف وتعديله، دون مسار حذف. حذف العميل الموجود في لوحة الإدارة ليس مسارًا ذاتيًا للمستخدم.

- `apps/mobile/app/(client)/profile.tsx:107`
- `apps/mobile/app/(client)/settings.tsx:123`
- `apps/backend/src/api/mobile/client/auth.controller.ts:30`
- `apps/backend/src/api/mobile/client/profile.controller.ts:41`

يلزم تصميم مسار موثق لطلب الحذف والتحقق من الهوية ومعالجة البيانات، مع توضيح ما يجب الاحتفاظ به. Apple تشترط إتاحة بدء الحذف داخل التطبيقات التي تسمح بإنشاء حساب، وتسمح ببعض خطوات الدعم الإضافية للقطاعات شديدة التنظيم. لا يعني ذلك حذف السجلات المالية والعلاجية مباشرة. [متطلبات حذف الحساب](https://developer.apple.com/support/offering-account-deletion-in-your-app/).

### 2. رابط الخصوصية الافتراضي غير صالح

`apps/mobile/constants/config.ts:20` يستخدم `https://sawa.sa/privacy`. يفتحه العميل والموظف من شاشة الملف الشخصي. التحقق عبر HTTPS فشل برسالة `certificate verify failed: Hostname mismatch`، وأثبت فحص حزمة Hermes المصدّرة وجود هذا الرابط فيها. لا يوجد تجاوز لهذا المتغير في البيئة المحلية التي فُحصت.

المقابل `https://sawaa.sa/privacy` أعاد HTTP 200 ومحتوى سياسة الخصوصية. يلزم تصحيح الرابط وتجربته من النسخة المثبتة. الصفحة المنشورة نفسها تتضمن عبارة بأن الصياغة أولية وتحتاج اعتمادًا قبل الإطلاق؛ ينبغي حسم النص النهائي ومدى تغطيته لبيانات التطبيق ومزوّديه. [الصفحة التي تم التحقق منها](https://sawaa.sa/privacy).

### 3. التسجيل في برنامج مدفوع لا يكمّل مسار الدفع

شاشة البرنامج تعرض سعرًا، ثم ينفّذ زر الانضمام التسجيل ويعرض رسالة الحجز دون استخدام نتيجة الاستجابة للانتقال إلى الدفع. الخادم ينشئ حجزًا `AWAITING_PAYMENT` وفاتورة، ويعيد `status` و`invoiceId`. نوع الاستجابة في الجوال لا يصف هذين الحقلين، والواجهة لا تتعامل معهما.

- `apps/mobile/app/(client)/groups/[id].tsx:55`
- `apps/mobile/services/client/group-sessions.ts:47`
- `apps/backend/src/modules/bookings/enroll-in-program/enroll-in-program.handler.ts:96`
- إنشاء الفاتورة: الملف السابق `:170`، وإرجاع الاستجابة `:263`.

يلزم ربط نتيجة التسجيل بمسار الدفع، مع عرض حالة انتظار الدفع بشكل صحيح. هذه نتيجة من تتبع الكود؛ لم يُنشأ حجز أو دفع حي خلال التدقيق.

**تمييز مهم لسياسة الدفع:** البرامج هنا تُنشأ فعليًا كـ`DeliveryType.IN_PERSON` في المعالج `:156`؛ لم يثبت احتياجها إلى IAP. تسمح قواعد Apple بالدفع الخارجي للخدمات الحضورية والاستشارات الفردية المباشرة. إذا أضيفت خدمات جماعية مباشرة عبر الإنترنت، يتغير تقييم الدفع وفق طبيعتها. [قواعد Apple، 3.1.3(d–e)](https://developer.apple.com/app-store/review/guidelines/#other-purchase-methods).

### 4. نوع رمز إشعارات iOS لا يطابق مسار الإرسال

`apps/mobile/services/push.ts:48` يستخدم `getDevicePushTokenAsync()`، الذي يعيد رمز APNs على iOS. ثم يرسله إلى `registerFcmToken` في `:81`. يحفظ الخادم الرمز كما هو، ويرسله باستخدام Firebase Admin `messaging().send()` باعتباره رمز FCM.

- التسجيل: `apps/mobile/services/notifications.ts:54`.
- الحفظ: `apps/backend/src/modules/comms/fcm-tokens/register-fcm-token.handler.ts:18`.
- الإرسال: `apps/backend/src/infrastructure/mail/fcm.service.ts:109`.

يلزم توحيد نوع الرمز مع وسيلة الإرسال، ثم إثبات الاستلام والنقر على إشعار من جهاز iPhone حقيقي. يوجد اختبار وحدات للإشعارات لكنه لا يثبت وصولها عبر APNs/FCM. [توثيق Expo للرموز والإرسال](https://docs.expo.dev/push-notifications/sending-notifications-custom/).

### 5. توجد وظائف ظاهرة غير مكتملة

| السطح | الدليل | الأثر |
|---|---|---|
| محادثة الموعد | `apps/mobile/app/(client)/appointment/[id].tsx:191` ثم `(client)/chat.tsx:3` و`(client)/(tabs)/chat.tsx:7` | زر «محادثة» ينتهي بالعودة للرئيسية |
| حساب الموظف | `apps/mobile/app/(employee)/(tabs)/profile.tsx:150` و`:194` | المعلومات الشخصية والتقييمات واللغة والإشعارات تعرض «قيد التطوير» |
| حساب العميل | `apps/mobile/app/(client)/profile.tsx:110` و`:112` ثم `:185` | صفا الإشعارات والصحة النفسية يظهران كعناصر قابلة للنقر دون إجراء |
| مكالمات الفيديو | `apps/mobile/constants/feature-flags.ts:14`، `components/features/JoinVideoCallButton.tsx:64` | المكالمات معطلة عمدًا؛ لا تُعرض كميزة مكتملة في وصف المتجر |

تفاصيل الموعد البعيد تقول إن طريقة الاتصال ستحدد قبل الموعد؛ لذلك تعطيل الفيديو ليس دليلًا على استحالة تقديم الاستشارة خارج التطبيق. يصبح مانعًا إذا وعد وصف الإصدار بمكالمة فيديو داخل التطبيق. يجب إكمال الأزرار الظاهرة أو إزالة مداخلها من نطاق الإصدار المعتمد. تشترط Apple اكتمال التجربة وصحة الوصف والروابط، مع اختبار على جهاز وحساب مراجعة صالح. [قواعد المراجعة، 2.1 و2.3](https://developer.apple.com/app-store/review/guidelines/#performance).

### 6. إعداد الإصدار يحتاج استكمالًا والتحقق من القيم الفعلية

- `apps/mobile/constants/config.ts:2` يعود إلى `http://localhost:3000/api/v1` إذا غاب متغير API. البيئة المحلية الحالية تستخدم `http://localhost:5200/api/v1`، وقد ظهر هذا العنوان في الحزمة المصدّرة فعلًا. هذه **الحزمة المحلية** لن تتصل بالخادم المنشور من هاتف المراجع. لم تُقرأ متغيرات EAS السحابية، فلا يستنتج ذلك قيمة أي إصدار سحابي سابق.
- `apps/mobile/eas.json:27` يستخدم `ascTeamId`، بينما الحقل الموثق لـEAS Submit هو `appleTeamId`. كما أن `ascAppId` وقيمة الفريق يحتويان placeholders. يلزم تصحيح المفتاح والتحقق من المعرفات الفعلية قبل الإرسال. لم تُنفّذ عملية submit أو تحقق CLI للإرسال. [مخطط EAS الرسمي](https://docs.expo.dev/eas/json/#ios-specific-options-1).
- معرف الحزمة الحالي `sa.sawa.app`، والإصدار `1.0.0`، و`supportsTablet: true`. يلزم اختبار iPad وتجهيز لقطاته ضمن نطاق الأجهزة المدعومة.
- التهيئة العامة الناتجة من Expo لا تحتوي `extra.eas.projectId`. لا يثبت ذلك عدم وجود التطبيق في App Store Connect أو عدم إمكان توقيعه يدويًا؛ ربط EAS وسجل الإصدارات غير متحقق منهما.

## الفحوص المنفذة على النسخة المحلية

| الفحص | النتيجة الفعلية | حدود الدليل |
|---|---|---|
| `pnpm --dir apps/mobile typecheck` | نجاح، exit 0 | فحص أنواع فقط |
| `pnpm --dir apps/mobile test --runInBand` | exit 1؛ 25 مجموعة ناجحة و5 متعطلة من أصل 30؛ 131 اختبارًا ناجحًا من 131 اختبارًا تم تشغيلها، دون تخطي معلن | المجموعات الخمس لم تصل إلى تشغيل الاختبارات |
| `pnpm --dir apps/mobile lint` | exit 1؛ `eslint: command not found` | لم يبدأ فحص الكود |
| `CI=1 pnpm --dir apps/mobile exec expo install --check` | exit 1؛ 19 اختلافًا عن الإصدارات التي يوصي بها Expo المثبت | تشخيص توافق؛ ليس إثبات عطل لكل مكتبة |
| `pnpm --dir apps/mobile exec expo config --type public --json` | نجاح، exit 0 | تهيئة Expo العامة |
| `pnpm --dir apps/mobile exec expo export --platform ios --output-dir /tmp/sawaa-appstore-ios-export` | نجاح، exit 0؛ 4512 وحدة، حزمة Hermes واحدة، 61 أصلًا | تصدير JavaScript؛ ليس بناء IPA أو تشغيل iOS |
| `xcodebuild -version` / `xcrun --sdk iphoneos --show-sdk-version` | Xcode 27.0، build 27A266a، SDK 27.0 | أدوات مثبتة؛ لا يثبت SDK داخل نسخة موزعة |

سبب تعطل مجموعات Jest الخمس هو React `19.2.0` مقابل `react-test-renderer` **المحلول فعليًا** `19.2.4`. تحقق `require.resolve` من التثبيت الفعلي. ملفا `apps/mobile/package.json:88` و`apps/mobile/pnpm-lock.yaml:196` يحددان أصلًا renderer `19.2.0`؛ لذلك الفشل الحالي دليل على اختلاف بيئة التثبيت عن القفل، ولا يكفي للقول إن تثبيت CI النظيف سيفشل أيضًا. لم تُعدّل الاعتماديات أثناء التدقيق.

المجموعات المتعطلة:

1. `apps/mobile/hooks/useUnreadCount.test.ts`
2. `apps/mobile/hooks/queries/__tests__/useBookings.test.ts`
3. `apps/mobile/app/(client)/booking/__tests__/use-payment-status.test.ts`
4. `apps/mobile/app/(auth)/__tests__/otp-verify.test.tsx`
5. `apps/mobile/app/__tests__/index.test.tsx`

السجلات المحلية: `/tmp/sawaa-appstore-mobile-tests.log`، `/tmp/sawaa-appstore-mobile-lint.log`، `/tmp/sawaa-appstore-ios-export.log`، `/tmp/sawaa-appstore-expo-config.json`. هذه ملفات مؤقتة وليست مرفقات CI دائمة.

## ما لا يُعد نقصًا مؤكدًا من مجرد غيابه في المصدر

- الحد الأدنى الحالي للرفع هو Xcode 26 وSDK ‏iOS 26 منذ 28 أبريل 2026؛ الأدوات المحلية تتجاوزه. لا يكفي هذا لإثبات بناء أرشيف صالح. [متطلبات Apple الحالية](https://developer.apple.com/news/upcoming-requirements/?id=04282026a).
- يوجد `PrivacyInfo.xcprivacy` في مشروع iOS المولّد محليًا، ويتضمن أسباب Required Reason APIs. المجلد `ios/` مولّد ومُتجاهل في Git؛ لا يُستنتج من هذا الملف اكتمال بيان الخصوصية للأرشيف النهائي أو إجابات App Privacy في المتجر.
- لم تُثبت مشكلة توجب إضافة Sign in with Apple: تسجيل الدخول الظاهر يعتمد OTP، ولم تظهر أزرار دخول اجتماعي في السطح المراجع.
- الدفع الفردي والباقات لهما مسارات دفع في الكود. لم يُنفّذ دفع حي أو اختبار Moyasar sandbox، فلا توجد شهادة جاهزية للدفع من هذا التدقيق.

## ترتيب الإغلاق المقترح

1. إصلاح الرابط ومداخل الوظائف غير المكتملة، وضبط إعدادات الإصدار والتحقق من API النهائي داخل الحزمة.
2. اعتماد وتنفيذ مسار طلب حذف الحساب المناسب لسجلات المركز.
3. إكمال انتقال البرامج المدفوعة للدفع، وتصحيح قناة إشعارات iOS.
4. استعادة تثبيت مستقل مطابق لقفل الجوال، وتشغيل جميع مجموعات الاختبارات وlint، ثم معالجة اختلافات توافق Expo اللازمة.
5. بناء نسخة Release موقعة والتحقق على iPhone وiPad: التسجيل وOTP واستعادة الجلسة والخروج والحجز والدفع والإلغاء والخصوصية وطلب الحذف والإشعارات، مع العربية وRTL وإعادة فتح التطبيق.
6. مراجعة App Store Connect: ملكية ومعرف التطبيق والتوقيع، App Privacy، التصنيف العمري، بيانات الدعم، الوصف واللقطات، بيانات دخول المراجع وطريقة وصوله إلى OTP، ثم اختبار TestFlight وقبول المالك.

لم يُفحص App Store Connect أو حساب Expo، ولم تُبنَ IPA أو تُرفع نسخة أو يُنفّذ اختبار أجهزة أو اختبار دفع حي خلال هذه المهمة. لم يحدث commit أو push أو merge أو نشر. التغيير الوحيد المقصود داخل المستودع هو هذا التقرير.

# تقرير مراجعة سلامة الفلو — منصة سواء

- **التاريخ:** 2026-10-02
- **النوع:** مراجعة قراءة فقط (static audit) + تشغيل اختبارات الوحدة وفحص الأنواع. **لم يُعدَّل أي ملف كود.**
- **الطريقة:** وكلاء مراجعة مستقلون على دفعات، كل وكيل مسؤول عن مسار واحد من الفلو.

## 1. الخلاصة

الفلو سليم في مجمله. **لا توجد ملاحظات حرجة أو عالية.** توجد 5 ملاحظات متوسطة: م1 وم2 وم3 مؤكدة بنطاق أضيق مما ورد في المسودة الأولى، وم4 مؤكدة، وم5 كامنة تعتمد على توقيت السيرفر. إضافة إلى 23 ملاحظة منخفضة. كل الاختبارات وفحوص الأنواع ناجحة.

**تحقق ثانٍ:** رُوجع هذا التقرير مرة ثانية مقابل الكود بتاريخ 2026-10-02 وصُحّح بناءً عليه.

## 2. كيف يعمل النظام (ملخص)

- **البنية:** مركز استشارات أسرية واحد (single-tenant). الباك إند NestJS مقسّم إلى مجالات (bookings, finance, identity, comms, org-config, org-experience…)، وكل حالة استخدام handler مستقل بدالة `execute()`. الـ controllers في `src/api/` مقسّمة حسب الجمهور: dashboard، mobile/client، mobile/employee، public.
- **الواجهات:** لوحة الإدارة (Next.js)، الموقع العام (Next.js)، تطبيق الجوال (Expo). المنطق المشترك للكتالوج في `packages/shared/catalog`.
- **الفلو الأساسي:** اكتشاف العيادة/الخدمة ← اختيار الممارس ← الموعد المتاح ← إنشاء الحجز ← الدفع (Moyasar / تحويل بنكي / رصيد باقة) ← الفاتورة ← تأكيد الموعد ← Zoom والتذكيرات ← الحضور/الإكمال/عدم الحضور، أو الإلغاء/إعادة الجدولة مع الاسترداد.
- **حالات الحجز:** PENDING، PENDING_GROUP_FILL، AWAITING_PAYMENT، DEPOSIT_PAID، CONFIRMED، CANCEL_REQUESTED، CANCELLED، COMPLETED، NO_SHOW، EXPIRED.
- **عقد العيادات:** نوع العنصر (CLINIC / SERVICE_GROUP) منفصل عن طريقة الحجز (DIRECT / SERVICES). عيادة DIRECT تُحجز عبر خدمة داخلية مخفية، وطريقة الحجز ثابتة بعد الإنشاء.
- **الأحداث:** ناقل أحداث دائم (BullMQ لكل مستهلك) مع outbox تُكتب داخل نفس معاملة قاعدة البيانات وتُنشر بعد الحفظ.

### جدول الانتقال بين حالات الحجز

| من | إلى | المسؤول |
|---|---|---|
| PENDING | CONFIRMED | confirm-booking (موظف) |
| PENDING / AWAITING_PAYMENT فقط (لا PENDING_GROUP_FILL ولا DEPOSIT_PAID؛ التكرار يُتخطى) | DEPOSIT_PAID | deposit-paid-handler (حدث دفع) |
| PENDING / AWAITING_PAYMENT / DEPOSIT_PAID | CONFIRMED | payment-completed-handler (حدث دفع) |
| PENDING / PENDING_GROUP_FILL / AWAITING_PAYMENT / CONFIRMED / CANCEL_REQUESTED / DEPOSIT_PAID | CANCELLED | cancel-booking (موظف، `DIRECT_CANCEL`) |
| حالات غير نهائية عدا PENDING_GROUP_FILL وCANCEL_REQUESTED | CANCELLED | client-cancel مباشر (`CLIENT_DIRECT_CANCEL`) |
| CANCEL_REQUESTED فقط | CANCELLED | approve-cancel |
| (مسار إضافي) | CANCELLED | refund-completed handler (`refund-completed.handler.ts:82`، `DIRECT_CANCEL`) |
| — | CANCEL_REQUESTED | request-cancel-booking؛ client-cancel يذهب إلى CANCEL_REQUESTED فقط عند اشتراط الموافقة أو انتهاء نافذة الإلغاء المجاني (`client-cancel-booking.handler.ts:110-144`)، وإلا CANCELLED مباشرة |
| CANCEL_REQUESTED | الحالة السابقة من `BookingStatusLog` (الافتراضي في آلة الحالات PENDING) | reject-cancel-booking (`reject-cancel-booking.handler.ts:36-44`) |
| PENDING / CONFIRMED | نفس الحالة (موعد جديد) | reschedule-booking، client-reschedule-booking |
| CONFIRMED | CONFIRMED + وقت الحضور | check-in-booking |
| CONFIRMED | COMPLETED | complete-booking |
| CONFIRMED | NO_SHOW | no-show-booking |
| NO_SHOW | CONFIRMED | restore-no-show-booking |
| PENDING / AWAITING_PAYMENT / DEPOSIT_PAID | EXPIRED | expire-booking (مهمة مجدولة) |
| حالات نهائية فقط | حذف السجل | delete-booking (موظف) |

## 3. نتائج الاختبارات والفحوص

| الفحص | النتيجة |
|---|---|
| اختبارات الباك إند كاملة (`npx jest --maxWorkers=2`) | 857 ملف (856 نجح + 1 متخطى)، 8064 اختبار نجح، 1 متخطى، 0 فشل (إعادة التشغيل: 53 ثانية) |
| اختبارات لوحة الإدارة (Vitest) | 275 ملف، 2175/2175 (102 ثانية) |
| اختبارات الموقع (Vitest) | 101 ملف، 877/877 (18 ثانية) |
| اختبارات `@sawaa/shared` | 13 ملف، 223/223 (الحزمة كاملة؛ مجموعة الكتالوج وحدها 3 ملفات / 20 اختبارًا) |
| typecheck (8 مهام، `pnpm turbo run typecheck --force`، بدون كاش) | نجح 8/8، 0 من الكاش |
| typecheck لتطبيق الجوال (`pnpm --dir apps/mobile typecheck`) | نجح، 0 أخطاء |

ملاحظة: أُعيد تشغيل كل النتائج أعلاه بشكل مستقل أثناء التحقق وتطابقت الأرقام (اللوحة 2175/2175، الموقع 877/877، الجوال 0 أخطاء).

ملاحظة: تشغيل `pnpm typecheck` المعتاد كان نتيجة محفوظة من كاش turbo لنسخة أخرى من المشروع، لذلك أُعيد الفحص فعليًا بـ `--force`.

تحذيرات غير مؤثرة في اختبارات اللوحة: مفتاح ترجمة مفقود مقصود في `locale-provider.spec.tsx`، تحذير «Query data cannot be undefined» في `use-organization-config.spec.tsx`، تحذير React عن الخاصية `error` في `program-dialog-errors.spec.tsx`، وتحذير Sentry عن `disableLogger`. وفي الموقع تحذيرات `act(...)` في اختبارات ChatComposer.

## 4. الملاحظات المتوسطة

### م1 — اجتماع Zoom لا يُحذف في إلغاءات بلا استرداد (مؤكدة بنطاق أضيق)
- **الموضع:** `client-cancel-booking.handler.ts`، `approve-cancel-booking/approve-cancel-booking.handler.ts`، `cancel-booking/cancel-booking.handler.ts:259-267`، `bookings/refund-completed-handler/refund-completed.handler.ts:~127-142`.
- **الوصف:** إلغاء العميل والموافقة على طلب الإلغاء لا يحذفان اجتماع Zoom، ولا يوجد مستهلك لحدث `bookings.booking.cancelled` يحذفه. إلغاء الموظف يحذفه مباشرة (`:259-267`) بمحاولة واحدة دون انتظار، وفشل الحذف يُسجَّل فقط. لكن `refund-completed.handler.ts` يستمع إلى `finance.refund.completed` ويستدعي `deleteMeetingStrict` (قابل لإعادة المحاولة عبر BullMQ)، فالإلغاءات التي ينتج عنها استرداد تحذف الاجتماع فعليًا في النهاية.
- **الفجوة الفعلية:** الإلغاءات بلا استرداد (`refundType` = NONE أو حجز غير مدفوع)، إضافة إلى عدم الحضور وانتهاء المهلة (ملاحظة منخفضة 20).
- **الأثر:** اجتماعات Zoom حية لمواعيد ملغاة في هذه الحالات.
- **اقتراح:** مستهلك دائم لحدث الإلغاء يحذف الاجتماع (الحدث يحمل `zoomMeetingId` في `booking-cancelled.event.ts:15`) مع إعادة محاولة، ويكون idempotent مع مسار الاسترداد.

### م2 — كلمة «حجز» تظهر للعميل بدل «موعد» (مؤكدة بنطاق أضيق)
- **المواضع:** `apps/backend/src/modules/comms/chat/operations/confirm-operation.handler.ts:572` («تم تأكيد الحجز بنجاح») و`resume-chat-operations.handler.ts:435` («راجع تفاصيل الحجز ثم أكّد الطلب.») — نصوص مساعد المحادثة الموجهة للعميل.
- **ليس مخالفة:** `materialize-notification-intent.handler.ts:213,216` إشعارات موظفين (`BOOKING_*_STAFF`)، ونص إلغاء العميل في `:219` يقول أصلًا «تم إلغاء الموعد».
- **الأثر:** مخالفة قاعدة المصطلحات في هذين النصين فقط.
- **اقتراح:** استبدالهما بـ «موعد».

### م3 — سباق بين فحص الارتباط وحذف الخدمة (مؤكدة بنطاق أضيق)
- **الموضع:** `apps/backend/src/modules/org-experience/services/archive-service.handler.ts:65-71` (الفحوص خارج المعاملة)، `:75-89` (حذف نهائي فقط عند `bookingCount===0`)، `:90-93` (وإلا أرشفة ناعمة).
- **ملاحظة تصحيحية:** `ServiceDurationOption.serviceId` له مفتاح أجنبي بـ `onDelete: Cascade` (`organization.prisma:194`)، والتعليق في `archive-service.handler.ts:79-81` قديم.
- **الوصف:** TOCTOU — باقة تُنشأ بين الفحص والحذف تبقى مرتبطة بخدمة محذوفة، لأن أهداف الباقة معرّفات نصية بلا مفتاح أجنبي. أما حجز جديد فيصطدم بمفتاح Booking الأجنبي.
- **الأثر:** مرجع يتيم في الباقة؛ نادر.
- **اقتراح:** نقل الفحوص والحذف داخل نفس المعاملة (أو تأمين الصف قبل الفحص).

### م4 — حد استخدام الكوبون لكل عميل غير محمي من التزامن (مؤكدة)
- **الموضع:** `apps/backend/src/modules/finance/apply-coupon/apply-coupon.handler.ts:181-190`.
- **الوصف:** العدّ لكل عميل بدون قيد فريد (couponId, clientId) ولا خطوة متسلسلة؛ `finance.prisma:185` فيه `@@unique([couponId, invoiceId])` فقط. الحد الكلي `maxUses` محمي بتحديث شرطي `updateMany` (`:166-170`). طلبات متزامنة من العميل نفسه على فواتير مختلفة قد تتجاوز `maxUsesPerUser`.
- **الأثر:** بطلبين متزامنين قد يتجاوز العميل حده.
- **اقتراح:** قيد فريد أو عدّ شرطي داخل خطوة serializable.

### م5 — حساب بداية اليوم لأيام العطل حسب توقيت السيرفر (كامنة، تعتمد على الإعداد)
- **الموضع:** `check-availability.handler.ts:71-72,125,134-135`، `add-holiday.handler.ts:22-30`، `organization.prisma:266`.
- **الوصف:** `Holiday.date` من نوع `@db.Date`، و`add-holiday` يخزّن `new Date(dto.date)` أي منتصف ليل UTC. البحث يستخدم `setHours(0,0,0,0)` بتوقيت السيرفر المحلي ومقارنة مساواة في `:125` (وكذلك الاستثناءات `:134-135`). يعمل ما دام توقيت السيرفر UTC، ويفشل إذا `TZ=Asia/Riyadh`. لا يوجد تثبيت للتوقيت في المستودع.
- **الأثر:** قد تظهر مواعيد في يوم عطلة إذا تغيّر توقيت السيرفر.
- **تعارض مع ملاحظة 22:** نصيحة الملاحظة 22 بضبط `TZ=Asia/Riyadh` تكسر هذا المسار؛ يجب إصلاحهما معًا بتثبيت حدود اليوم صراحةً بمساعد توقيت الرياض دون الاعتماد على TZ للعملية.

## 5. الملاحظات المنخفضة

### الدفع والفواتير
1. `PaymentFailedEvent` بلا `organizationId` (`moyasar-webhook.handler.ts:707-715`). **غير مؤثر:** لا يوجد إشعار موظفين يستمع لهذا الحدث.
2. وصول دفع والحجز في حالة لا تسمح بالتأكيد يُسجَّل كتحذير فقط (`payment-completed.handler.ts:59-61`). مسار الدفع المتأخر للحجز المنتهي/الملغى مغطى بطلب استرداد للمراجعة.
3. منع تكرار الـ webhook سليم في الغالب: مفتاح `paymentId:status` (`moyasar-webhook.handler.ts:280`)، وفشل المعالجة بخطأ يحذف الحجز المملوك للمعالج (`:761-768`، `:895-903`)، والحجز العالق يُستعاد بعد 5 دقائق (`:847-872`)، والتخطي الدائم يُعلَّم نهائيًا بحالة `error`. المتبقي: فشل حذف الحجز يُسجَّل فقط.
4. صلاحية الكوبون وتاريخ انتهائه لا يُعاد فحصهما بعد قفل الفاتورة (`apply-coupon.handler.ts`).
5. `create-booking.handler.ts:335` يستخدم `subtotal: Number(price)` والسعر رقم أصلًا؛ تحويل زائد لا علاقة له بمبلغ الكوبون. أثر ضئيل جدًا.
6. `moyasar-webhook.handler.ts:237-248` يقبل `secret_token` من الجسم كبديل للتحقق. التوقيع HMAC سليم، لكن يُنصح بمراجعة الحاجة لهذا البديل.

### الصلاحيات وتسجيل الدخول
7. `CaslGuard` يسمح بالمرور عند غياب `@CheckPermissions` (`casl.guard.ts:72`). كل مسارات اللوحة الحالية (22 controller class في 23 ملفًا، و`organization.controller.ts` مجرد barrel؛ 247 مسارًا) محمية بـ `@CheckPermissions`، لكن أي مسار جديد بلا صلاحية سيكون متاحًا لكل الموظفين. تكرار للديكوريتر في `ops.controller.ts:108,157`.
8. `GET /public/bookings/:id/status` عام بلا تسجيل دخول (`public/bookings.controller.ts:24-32`)؛ يعيد فقط معرّف الحجز وحالته وحالة آخر دفعة، بحد 30 طلب/دقيقة (تخمين UUID غير ممكن عمليًا).
9. لا توجد مطالبات `aud`/`iss` في JWT، لكن الفصل ليس بالأسرار فقط: `ClientJwtStrategy` يتحقق من `namespace='client'` (`client-jwt.strategy.ts:44-45`) و`JwtStrategy` للموظفين يرفض أدوار CLIENT (`jwt.strategy.ts:53-56`). اقتراح دفاع متعدد الطبقات فقط.
10. إعادة استخدام توكن تجديد ملغى تُرفض دون إلغاء عائلة التوكنات أو تنبيه أمني (`refresh-token.handler.ts:25-58`، `client-refresh.handler.ts:20-46`) — مؤكدة.
11. `POST /mobile/auth/request-email-verification` (`mobile/client/auth.controller.ts:72-80`) يستخدم `JwtGuard` عمدًا: الـ handler يقرأ User وخدمة `services/auth.ts` في الجوال تتحقق من جلسة موظف. المشكلة موقع الملف وجمهور Swagger المضلّلان، لا خلل في المصادقة.

### العيادات والخدمات والكاش
12. أرشفة/استعادة خدمة لا تمسح كاش `ref:public-catalog` (`archive-service.handler.ts:96`، `restore-service.handler.ts:44`)؛ الكتالوج العام يبقى خاطئًا حتى 5 دقائق.
13. حذف تصنيف لا يمسح كاش الخدمات ولا الكتالوج العام (`delete-category.handler.ts:47-48`).
14. تغيير اسم عيادة DIRECT يبحث عن الخدمة المخفية دون استبعاد المؤرشفة، ويتجاوز بصمت إن لم يجدها (`update-category.handler.ts:57-60`).
15. جعل خدمة ظاهرة تحت عيادة DIRECT مخفية يعطي خطأ 500 من الفهرس الجزئي بدل رفض واضح (`update-service.handler.ts:36`).
16. المكوّن غير المستخدم `apps/mobile/components/features/PractitionerBookingAction.tsx` لا يستبعد الخدمة المخفية (مستخدم في اختباره فقط).
17. مفاتيح الكاش في `apps/website/features/booking/use-booking-wizard.ts:88,96` لا تتضمن `includeDirectClinics` (القيمة ثابتة اليوم، فلا خلل فعلي).
18. وصف بطاقة العيادة في الموقع يأخذ `serviceIds[0]` عند غياب خدمة DIRECT (`bookable-services.ts:50`) — للنص فقط، لا يؤثر على الحجز.

### دورة الحياة ومتفرقات
19. عدم الحضور وانتهاء المهلة لا يحذفان اجتماع Zoom (قد يكون مقصودًا؛ انظر م1).
20. `request-cancel-booking.handler.ts:27-38` يقرأ الحجز خارج المعاملة؛ عند التعارض يرى المستخدم رسالة تقنية بدل رسالة واضحة.
21. مثال Swagger في `api/dashboard/bookings.controller.ts:93` يذكر `PENDING` كحالة أولى، بينما الكود يبدأ بـ CONFIRMED أو AWAITING_PAYMENT.
22. حد أقصى الحجز المسبق يعتمد على توقيت السيرفر؛ يُقترح `TZ=Asia/Riyadh` في الإنتاج، **لكن ذلك يتعارض مع م5** (الكامنة): يجب إصلاحهما معًا بتثبيت حدود اليوم بمساعد توقيت الرياض صراحةً لا بالاعتماد على TZ للعملية.
23. فجوات اختبار: توجد اختبارات لتعديل هوية/اسم الخدمة الداخلية ولمنع نقل خدمة ظاهرة إلى DIRECT (`update-service.handler.spec.ts:53,61,71`، `create-service.handler.spec.ts:91`). الفجوة: لا اختبار لوجود خدمتين مخفيتين في عيادة واحدة، ولا اختبار صريح لتبديل `isHidden` أو نقل الخدمة الداخلية.

## 6. قرارات المالك

- **أرصدة الباقات لا تنتهي (قرار مالك — 2026-10-02).** لا يوجد حقل انتهاء على `PackageCredit` أو `PackagePurchase`، وهذا هو السلوك المطلوب. **ليست ملاحظة ولا تحتاج إصلاحًا.**
- الحجز برصيد على الخدمة الداخلية لعيادة DIRECT مسموح وفق العقد؛ يبقى فقط التأكد أن الحجز برصيد لا يقبل خدمة مخفية تحت تصنيف SERVICES (مشتبه بها، منخفضة).

## 7. ما تأكد أنه سليم

- **إنشاء الحجز:** منع الحجز المزدوج بثلاث طبقات (قفل advisory، معاملة Serializable مع إعادة المحاولة، قيد `EXCLUDE USING gist` لتداخل مواعيد الممارس). المواعيد المتاحة تحترم ساعات العمل والعطل ودوام الممارس واستثناءاته واستراحاته والفاصل والحد الأدنى للمهلة. التحقق من أن الممارس يقدم الخدمة، وقبول الخدمة المخفية لعيادات DIRECT فقط. السعر بالهللات مع سعر الممارس الخاص. الموقع يطلب حسابًا، وحجز الضيف من اللوحة فقط وبصلاحية. الحالة الأولى CONFIRMED أو AWAITING_PAYMENT بمهلة 15 دقيقة. `BookingCreatedEvent` يحمل `organizationId` عبر outbox.
- **دورة الحياة:** كل انتقال محمي بـ `fetchBookingOrFail` + آلة الحالات + تحديث شرطي (`updateBookingAtomically`)، ويُسجَّل في `BookingStatusLog` بنفس المعاملة. حماية الحجوزات المستوردة عبر `assertBookingIsMutable` (11 موضع استدعاء). CONFIRMED/COMPLETED لا تنتهي مهلتها. إعادة الجدولة تعيد فحص التوفر مع الأقفال. رصيد الباقة يُرجَع مرة واحدة في الإلغاء وعدم الحضور والانتهاء، ويُسحب عند الاستعادة.
- **Moyasar:** توقيع HMAC-SHA256 على النص الخام بمقارنة `timingSafeEqual`، (انظر الملاحظة 6 للبديل `secret_token`)، حد الطلبات (120/دقيقة لـ webhook) يمكن تعطيله خارج الإنتاج فقط بـ `THROTTLER_DISABLED=true`؛ إعداد الإنتاج يرفض true عند الإقلاع (`env.validation.ts:173-176`)، منع التكرار، إعادة جلب حالة الدفع من Moyasar، التحقق من العملة والمبلغ بالهللات، تحديث الحجز والفاتورة والدفعة في معاملة واحدة، والدفع المتأخر ينشئ طلب استرداد للمراجعة.
- **الفواتير:** `DEFAULT_VAT_RATE = 0` ولا 15% في الكود المشحون أو Swagger (توجد في بيانات الاختبارات فقط، وهذا مقبول). المستحق = (المجموع − الخصم) × (1 + الضريبة). فاتورة واحدة لكل حجز. حدود الكوبون (الانتهاء، الحد الأدنى، الخدمات، الحد الكلي الذري). الاسترداد لا يتجاوز المدفوع. العميل يرى فواتيره فقط، ورابط PDF صالح 5 دقائق لمسارات الـ API فقط؛ أما روابط الإيصالات المرسلة بالبريد فصالحة 7 أيام (`send-invoice-receipt.handler.ts:16,65-68`). سعر الحدث في `booking-confirmed.handler.ts` هو `booking.price` المخزَّن بالهللات والـ DTOs تحدد هللات صحيحة.
- **الباقات:** لا صرف مزدوج (قفل `FOR UPDATE` على الشراء والرصيد). مطابقة الشروط. نقل الرصيد من اللوحة فقط بصلاحية `manage:Booking`. استرداد الباقة محدود بالمتبقي.
- **الصلاحيات:** `clientId` دائمًا من الجلسة. OTP: مشفر بـ bcrypt، انتهاء 5 دقائق، فاصل 60 ثانية بين الطلبات، 5 طلبات/ساعة لكل معرّف وغرض، قفل 15 دقيقة، استخدام مرة واحدة، و3/دقيقة لكل IP. تدوير توكن التجديد بتحديث شرطي، وتسجيل الخروج يلغي التوكنات. سياسة كلمة المرور مطبقة، ورابط إعادة التعيين للاستخدام مرة واحدة.
- **الإشعارات والمهام:** حراس إشعارات الموظفين تصلهم `organizationId`. لا أثر لـ `forCurrentTenant`، وSMS عبر `SmsProviderFactory.resolve()`. تسليم الإشعارات بقفل وإعادة محاولة محدودة وحالة DEAD. 10 من 13 مهمة مجدولة تعمل عبر `withCronLeader` و`CronLock`؛ أما `program-automation` و`authentica-balance-check` و`orphan-audit` فتعمل عبر طابور BullMQ للمهام دون `withCronLeader` (`cron-tasks.service.ts:101-119`).
- **عقد العيادات:** كل قواعده مطبقة في الباك إند (رفض SERVICE_GROUP+DIRECT، الخدمة المخفية في نفس المعاملة، 409 `CATEGORY_BOOKING_MODE_LOCKED`، حماية الخدمة الداخلية، منع الحذف عند الارتباط، `includeDirectClinics` بنفس المنطق في القائمة والتفاصيل)، وتُنفَّذ القواعد في `packages/shared/catalog` (`bookable-clinics.ts`، `find-department.ts`)، وفي الموقع والتطبيق واللوحة.

## 8. ما لم يُتحقق منه

- التحقق (الأول والثاني) ثابت (static) مع إعادة تشغيل الاختبارات فقط.
- لم يُشغَّل النظام فعليًا ولم تُجرَّب الفلوهات في المتصفح أو الجهاز.
- لم تُختبر الطلبات المتزامنة على قاعدة بيانات حقيقية (اختبارات الوحدة تستخدم mocks).
- لم يُشغَّل Moyasar sandbox ولا اختبارات e2e/smoke.
- لم يُفحص اختلاف `apps/backend/openapi.json` عن الكود.
- لم تُفحص طريقة تخزين `Holiday.date` في قاعدة البيانات.
- لم يُراجَع بالكامل: ملكية الموظف في endpoints الأرباح والجدول والعملاء في تطبيق الموظف، وبوابة تسجيل دخول المراجعة.

## 9. أولويات الإصلاح المقترحة

1. م1 — حذف اجتماع Zoom في الإلغاءات بلا استرداد، وعند عدم الحضور/انتهاء المهلة (ملاحظة 19).
2. م2 — استبدال «حجز» بـ «موعد» في نصّي مساعد المحادثة فقط.
3. م3 — نقل فحوص أرشفة الخدمة داخل المعاملة.
4. م5 مع الملاحظة 22 — إصلاح التوقيت معًا بتثبيت حدود اليوم على توقيت الرياض صراحةً.
5. م4 والملاحظات 7–11 (والملاحظة 6 للدفع) — تمس الدفع والصلاحيات (Critical tier)، **تحتاج موافقة المالك** قبل أي تعديل.
6. الملاحظات 12–15 — الكاش ورسائل الخطأ في الكتالوج.

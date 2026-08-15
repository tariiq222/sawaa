# تصميم المحادثة الموحدة والمساعد الإداري في موقع سواء

**التاريخ:** 2026-08-13

**الحالة:** معتمد في المحادثة، جاهز للتخطيط والتنفيذ

> **تحديث 2026-08-14:** تصميم `Sawaa Ai` الجديد في
> `2026-08-14-sawaa-ai-customer-agent-settings-design.md` يستبدل وصف
> «المساعد الإداري» وسياسة القوالب المغلقة، ويضيف إعداد المزود وقاعدة المعرفة
> وتنظيف واتساب الآمن. تبقى بقية عقود المحادثة الموحدة والحجز في هذه الوثيقة سارية.

**النطاق:** backend، الموقع العام، حساب العميل، لوحة الإدارة، وإزالة واتساب

## 1. الهدف

استبدال واتساب بالكامل بمحادثة ويب داخل موقع مركز سواء، تعمل لأي زائر دون تسجيل دخول، وتتحول بسلاسة إلى حساب العميل أو موظف الاستقبال. يكون المساعد محصورًا في المهام الإدارية: التعريف بالمركز والخدمات والمعالجين، عرض التوفر، وإدارة مواعيد العميل بعد تسجيل الدخول.

المصدر الوحيد للمحادثات هو `ChatConversation`، والمصدر الوحيد للرسائل هو `CommsChatMessage`. لا يُنشأ سجل مستقل للذكاء الاصطناعي أو الموظف أو القناة.

## 2. القرارات المعتمدة

- المحادثة متاحة لأي زائر.
- عرض بيانات الموعد الشخصية أو إنشاء/تعديل/إلغاء موعد يتطلب تسجيل الدخول.
- الزائر غير المسجل يقدم الاسم والجوال فقط عند طلب موظف استقبال.
- العميل المسجل يُربط بالمحادثة تلقائيًا ولا يعيد إدخال بياناته.
- التحويل للموظف يتم داخل المحادثة نفسها.
- يظهر السجل لموظفي الاستقبال في الداشبورد وللعميل في حسابه.
- المساعد إداري فقط؛ لا يشخص، لا يقيم الحالة، لا يقدم توجيهًا علاجيًا، ولا يضع تاغ خطر.
- السؤال الخارج عن النطاق ينتج ردًا قصيرًا وخيار تحويل لموظف دون تحليل المحتوى.
- أي عملية موعد تعرض ملخصًا وتتطلب تأكيدًا حتميًا قبل التنفيذ.
- إذا كان لدى العميل أي موعد مستقبلي فعال، يعرضه النظام ويطلب تأكيدًا إضافيًا قبل السماح بموعد إضافي.
- التطابق الكامل أو التعارض الزمني مع موعد العميل يمنع الحجز حتى بعد التأكيد الإضافي.
- تحفظ المحادثات المغلقة 365 يومًا ثم تحذف آليًا، مع سجل تدقيق مختصر لا يحتوي نص الرسائل.
- واتساب يفصل ويخفى أولًا، ثم يحذف كوده وأسراره وجداوله بعد بوابة نشر ونسخة احتياطية وفحص البيانات.

## 3. خارج النطاق

- التشخيص أو التقييم أو الإرشاد النفسي.
- اكتشاف الخطر أو تصنيفه أو إظهار رسائل طوارئ مبنية على تحليل المحادثة.
- رفع الملفات والصور والصوت والروابط في الإصدار الأول.
- WebSockets في الإصدار الأول؛ يستخدم الداشبورد polling.
- حجز زائر غير مسجل أو البحث عن عميل بواسطة رقم الجوال.
- إنشاء عميل `WALK_IN` من المحادثة.
- المواعيد الدورية أو سياسات تكرار متقدمة.
- حذف قيم `WHATSAPP` التاريخية من enums قبل فحص بيانات الحجوزات والعملاء.

## 4. البنية الحالية وقرار الدمج

يوجد حاليًا ثلاثة مسارات متوازية:

1. `ChatConversation/CommsChatMessage` في `apps/backend/prisma/schema/comms.prisma`.
2. `ChatSession/ChatMessage` في `apps/backend/prisma/schema/ai.prisma`.
3. `WhatsappAgentConfig/WhatsappConversation/WhatsappMessage` ووحدات Evolution API.

يمدد التنفيذ المسار الأول. يتوقف `ChatCompletionHandler` عن الكتابة في المسار الثاني، ويحذف المسار الثالث بعد القطع النهائي. `ChatOperation` نموذج تنفيذ مساعد وليس مصدرًا للرسائل.

## 5. عقد البيانات

### 5.1 الحالات والأنواع

تضاف القيم الجديدة مع الحفاظ المؤقت على القيم القديمة اللازمة للترحيل:

```prisma
enum ConversationStatus {
  OPEN // legacy only
  AI_ACTIVE
  WAITING_FOR_STAFF
  STAFF_ACTIVE
  CLOSED
}

enum MessageSenderType {
  CLIENT
  EMPLOYEE // legacy only
  VISITOR
  AI
  STAFF
  SYSTEM
}

enum ChatMessageKind {
  TEXT
  ACTION_CARD
  OPERATION_RESULT
  SYSTEM_EVENT
}

enum ChatOperationType {
  CREATE_BOOKING
  RESCHEDULE_BOOKING
  CANCEL_BOOKING
}

enum ChatOperationStatus {
  AWAITING_AUTH
  AWAITING_EXISTING_BOOKING_ACK
  AWAITING_CONFIRMATION
  EXECUTING
  SUCCEEDED
  FAILED
  DECLINED
  EXPIRED
}
```

### 5.2 `ChatConversation`

- يصبح `clientId` اختياريًا.
- `guestTokenHash String? @unique`؛ لا يحفظ الرمز الخام.
- `guestName String?` و`guestPhone String?`.
- `language String @default("ar")`.
- `assignedStaffUserId String?`؛ يشير منطقيًا إلى مستخدم الداشبورد، وليس `Employee.id`.
- `handoffRequestedAt DateTime?`.
- `staffClaimedAt DateTime?`.
- `closedAt DateTime?`.
- `staffUnreadCount Int @default(0)`.
- `clientUnreadCount Int @default(0)`.
- فهارس على الحالة وآخر رسالة، العميل، الموظف، وبصمة الضيف.

تُرحل محادثات `OPEN` القديمة إلى `STAFF_ACTIVE` إن وجدت، وتظل `CLOSED` مغلقة. يمنع الكود الجديد إنشاء `OPEN`.

### 5.3 `CommsChatMessage`

- `kind ChatMessageKind @default(TEXT)`.
- `metadata Json?` لبيانات العرض الآمنة فقط.
- `clientMessageId String?` مع `@@unique([conversationId, clientMessageId])`.
- `responseForMessageId String? @unique` لمنع رد AI مكرر.
- `model String?`, `tokensUsed Int @default(0)`, `latencyMs Int?`.
- `readAt DateTime?`.

لا يحفظ `body` أسرارًا أو prompt داخليًا أو stack trace. تصفى `metadata` في mapper قبل إرجاعها للواجهة.

### 5.4 `ChatOperation`

يحتوي على:

- `conversationId`, `clientId`, `type`, `status`.
- `payload Json` كمدخل ثابت بعد التحضير.
- `summary Json` كنسخة العرض المعتمدة.
- `idempotencyKey String @unique`.
- `requiredConfirmations Int`, `confirmationCount Int`, `version Int`.
- `expiresAt`, `confirmedAt`, `executedAt`.
- `bookingId String?`, `errorCode String?`.

لا يعتمد تنفيذ العملية على تفاصيل يرسلها المتصفح عند التأكيد؛ يقبل `operationId` فقط ويقرأ المدخل الثابت من قاعدة البيانات.

### 5.5 عدم التكرار في الحجز

- إضافة `Booking.creationIdempotencyKey String? @unique` أو اسم مكافئ متفق عليه قبل التنفيذ.
- إضافة مفتاح مصدر فريد إلى سجلات تعديل/إلغاء الموعد أو سجل عمليات يثبت النتيجة.
- قفل advisory على العميل داخل transaction، ثم إعادة فحص مواعيده الفعالة والتعارض الزمني.
- يبقى قفل المعالج وفحص توفره الحاليان.
- مصدر الحجز الجديد `AI_CHAT`، مع migration enum إضافية.

## 6. هوية الزائر والملكية

- Cookie باسم `sawaa_chat_guest` تحمل رمزًا عشوائيًا 256-bit.
- الخصائص: `HttpOnly`, `SameSite=Lax`, `Secure` في الإنتاج، مدة 30 يومًا.
- يخزن backend SHA-256/HMAC للرمز فقط باستخدام `CHAT_GUEST_TOKEN_SECRET`.
- لا يخزن الرمز أو الجوال في `localStorage` أو URL.
- يمكن للواجهة حفظ معرّف المحادثة وحالة فتح النافذة فقط؛ المعرّف وحده لا يمنح وصولًا.
- عند تسجيل الدخول يستدعي الموقع endpoint ربط يستخدم Cookie الضيف وCookie العميل معًا.
- الربط ذري: يثبت `clientId` ويمسح `guestTokenHash` حتى لا يبقى رمز الضيف طريق وصول بعد ربط الحساب.
- كل مسار `/public/me/**` يستخرج `clientId` من `ClientSessionGuard` ولا يقبله من body أو query.
- كل قراءة/كتابة تتحقق من ملكية الضيف أو العميل داخل backend.

## 7. عقد API

### 7.1 الزائر

- `POST /public/chat/conversations`
- `GET /public/chat/conversations/current`
- `GET /public/chat/conversations/:id/messages?cursor=&limit=`
- `POST /public/chat/conversations/:id/messages` بجسم `{ clientMessageId, body }`
- `POST /public/chat/conversations/:id/handoff` بجسم `{ name, phone }` للضيف

إرسال الرسالة يحفظها أولًا، ثم يعالج المساعد بصورة idempotent. يمكن أن يعيد `202` مع حالة المعالجة إذا أصبح التنفيذ غير متزامن.

### 7.2 العميل المسجل

- `POST /public/me/chat/conversations/:id/claim`
- `GET /public/me/chat/conversations`
- `GET /public/me/chat/conversations/:id`
- `GET /public/me/chat/conversations/:id/messages`
- `POST /public/me/chat/conversations/:id/messages`
- `POST /public/me/chat/conversations/:id/handoff`
- `POST /public/me/chat/conversations/:id/operations/:operationId/confirm`
- `POST /public/me/chat/conversations/:id/operations/:operationId/decline`

### 7.3 موظف الاستقبال

- `GET /dashboard/conversations?status=&assignedStaffUserId=&unread=&search=&from=&to=`
- `GET /dashboard/conversations/:id`
- `GET /dashboard/conversations/:id/messages?cursor=&limit=`
- `POST /dashboard/conversations/:id/claim`
- `POST /dashboard/conversations/:id/messages`
- `PATCH /dashboard/conversations/:id/assign`
- `PATCH /dashboard/conversations/:id/read`
- `PATCH /dashboard/conversations/:id/release-to-ai`
- `PATCH /dashboard/conversations/:id/close`

الاستلام ذري عبر update مشروط بالحالة `WAITING_FOR_STAFF` وعدم وجود موظف مستلم. يرجع `409` إذا سبق موظف آخر.

كل DTO يحمل Swagger decorators، ثم يجدد `apps/backend/openapi.json` و`apps/dashboard/lib/types/api.generated.ts`. يضاف عميل يدوي تحت `packages/api-client/src/modules/chat.ts` وأنواعه واختباراته.

## 8. سياسة المساعد الإداري

يوضع حد النظام التالي في الكود ولا يستطيع إعداد الداشبورد استبداله:

- التعريف بالمركز والفروع وساعات العمل.
- الخدمات والأسعار والمدد المنشورة.
- المعالجون المنشورون.
- التوفر.
- مواعيد العميل وإدارتها بعد تسجيل الدخول.
- قاعدة المعرفة المعتمدة ضمن النطاق نفسه.
- طلب التحويل لموظف.

أي prompt قابل للتعديل يضاف أسفل هذه السياسة ولا يوسعها. لا توجد أدوات صحية أو علاجية أو أداة تقييم خطر.

تعاد الاستفادة من:

- `ChatAdapter.completeWithTools`.
- `SemanticSearchHandler`.
- `GetChatbotConfigHandler` وقاعدة المعرفة.
- معالجات الكتالوج والمعالجين والتوفر والحجز الفعلية.

لا يعاد استخدام `AgentOrchestratorService` أو `BookingToolsService` بصيغتهما المرتبطة بواتساب. يبنى orchestrator جديد تحت `modules/comms/chat/assistant/` بحد أقصى أربع دورات أدوات وآخر 20 رسالة.

## 9. عقد الأدوات

السياق يبنيه backend ولا يراه النموذج كمدخل قابل للتغيير:

```ts
type AdministrativeToolContext = {
  conversationId: string;
  clientId: string | null;
  locale: "ar" | "en";
};
```

الأدوات العامة:

- `getCenterInfo`
- `listServices`
- `listPractitioners`
- `getAvailability`
- `searchKnowledge`
- `handoffToReception`

الأدوات التي تتطلب عميلًا موثقًا:

- `listOwnAppointments`
- `prepareBooking`
- `prepareReschedule`
- `prepareCancellation`

لا توجد أداة `confirm` للنموذج. التأكيد endpoint حتمي مربوط بزر و`operationId`.

## 10. تدفق الموعد والتأكيد

### 10.1 الحجز

1. الزائر يختار موعدًا؛ ترجع العملية `AWAITING_AUTH` بدل الحجز.
2. بعد الدخول تربط المحادثة بالحساب ويعاد التحقق من السعر والتوفر.
3. يفحص النظام أي موعد مستقبلي فعال وغير تاريخي.
4. الحالات الفعالة تشمل حالات الحجز التي ما زالت تمثل موعدًا قائمًا وفق state machine الحالية، ولا تشمل الملغي أو المكتمل أو المنتهي.
5. إن وجد موعد قائم، تعرض بطاقة الموعد الحالي والموعد المقترح وتطلب «أحتاج موعدًا إضافيًا».
6. بعد الإقرار الإضافي تعرض بطاقة التأكيد النهائي.
7. عند التأكيد يعاد فحص الهوية، الانتهاء خلال 15 دقيقة، الموعد القائم، السعر، التوفر، وتعارض العميل والمعالج داخل transaction.
8. التطابق أو التعارض يمنع التنفيذ؛ الموعد المختلف يسمح به بعد التأكيدين.
9. تعاد نتيجة الحجز نفسها عند إعادة الطلب بالمفتاح ذاته.

### 10.2 إعادة الجدولة والإلغاء

- تعاد الجدولة عبر `ClientRescheduleBookingHandler` مع ملكية العميل وسياسة المركز الحالية.
- لا يسمح للمساعد بتغيير مدة الموعد خلال إعادة الجدولة.
- الإلغاء يستخدم `ClientCancelBookingHandler`؛ قد ينتج إلغاء مباشرًا أو `CANCEL_REQUESTED` حسب السياسة.
- كل عملية تعرض ملخصًا وتتطلب تأكيدًا واحدًا، ثم تنفذ idempotently.

## 11. التحويل للموظف

- التحويل يحدث بطلب المستخدم أو اختياره بعد سؤال خارج النطاق.
- لا يصنف سبب التحويل طبيًا ولا ينشئ تاغ خطر.
- الضيف يدخل الاسم والجوال قبل الانتظار.
- العميل المسجل لا يعيد إدخال البيانات.
- عند `WAITING_FOR_STAFF` أو `STAFF_ACTIVE` يفحص orchestrator الحالة قبل استدعاء النموذج وقبل حفظ الرد.
- رد الموظف والاستلام والإغلاق والإعادة للمساعد تسجل كأحداث تدقيق دون نص المحادثة.

## 12. الواجهات

### 12.1 الموقع العام

- يستبدل `FloatingWhatsApp` بأيقونة «مساعد سواء الإداري» من هوية المركز.
- نافذة جانبية على سطح المكتب وشبه كاملة على الجوال.
- ردود سريعة وبطاقات للخدمات والمعالجين والتوفر وعمليات الموعد.
- حالة واضحة عند فشل المزود مع «إعادة المحاولة» و«التحدث مع موظف».
- تسجيل الدخول يحافظ على المحادثة والعملية المعلقة، ثم يعيد فتحها.

### 12.2 حساب العميل

- إضافة تبويب `conversations` إلى `AccountFeature`.
- قائمة المحادثات، آخر رسالة، الحالة والتاريخ.
- فتح السجل ومتابعة المحادثة المفتوحة.
- فصل بصري واضح لرسائل العميل والمساعد والموظف ونتائج العمليات.

### 12.3 الداشبورد

- route جديدة `/conversations`، لا إعادة تسمية سطح واتساب داخل مكانه.
- قوائم `WAITING_FOR_STAFF`, `STAFF_ACTIVE`, `AI_ACTIVE`, `CLOSED`.
- استلام، رد، تعيين، قراءة، إغلاق وإعادة للمساعد.
- polling كل 5–10 ثوانٍ في الإصدار الأول.
- subject صلاحيات جديد `Conversation` لأدوار `SUPER_ADMIN`, `ADMIN`, `RECEPTIONIST` فقط.

## 13. الحماية والحدود

- CSRF الحالي يطبق على كل مسارات الكتابة.
- حد طول الرسالة من env، بحد أقصى 4000 حرف.
- throttling لكل IP وهوية ضيف/عميل، مع حد يومي للرسائل/tokens.
- لا يقبل اسم أداة أو body عملية من المتصفح.
- لا تسجل نصوص المحادثة في application logs.
- عند فشل النموذج تحفظ رسالة المستخدم ولا تنشأ إجابة كاذبة.
- `clientMessageId` و`responseForMessageId` يمنعان التكرار.

## 14. الاحتفاظ والتدقيق

- `RETENTION_CHAT_DAYS=365`.
- يحذف cron المحادثات المغلقة عندما يتجاوز `closedAt` مدة الاحتفاظ، وتحذف الرسائل والعمليات cascade.
- يبقى `ActivityLog` المختصر 365 يومًا دون نص الرسائل.
- تسجل أحداث: handoff، claim، assign، release، close، operation confirmed/succeeded/failed.

## 15. القطع النهائي لواتساب

### 15.1 قبل الحذف

- تشغيل البديل خلف flags وتجربته داخليًا.
- إظهار أيقونة AI وإخفاء زر واتساب.
- إيقاف webhook والworker ومزامنة واتساب.
- فصل Evolution API وإزالة أسراره من بيئة التشغيل بعد smoke ناجح.
- أخذ backup حديث موثق.
- فحص counts لجداول واتساب، وحجوزات/عملاء مصدرهم `WHATSAPP`.

### 15.2 الحذف

- حذف واجهات واتساب في الموقع والداشبورد.
- حذف controllers والوحدات والبنية التحتية والworker.
- إزالة env وDocker وCI المرتبطة.
- migration جديدة تحذف جداول وأنواع واتساب؛ لا تعدل migrations القديمة.
- تقاعد `ChatSession/ChatMessage` بعد نقل أي سجل مطلوب وإثبات توقف الكتابة إليها.

لا تحذف قيمة enum تاريخية إذا وجدت صفوف تعتمد عليها؛ توثق كقيمة legacy أو ترحل البيانات بقرار منفصل.

## 16. الإطلاق والرجوع

1. إطلاق خلف `WEB_CHAT_ENABLED` و`NEXT_PUBLIC_WEB_CHAT_ENABLED`.
2. تجربة زائر، عميل، موظف، وعمليات الموعد في بيئة غير عامة.
3. تفعيل widget للعامة مع بقاء واتساب مفصولًا وقابلًا للرجوع على مستوى الصورة فقط.
4. فترة استقرار ومراقبة الأخطاء والتكلفة والتحويلات والعمليات.
5. backup وفحوص صفرية ثم الحذف النهائي.

قبل migration الحذف يمكن الرجوع بإخفاء widget وإعادة الصورة السابقة. بعدها يتطلب الرجوع استعادة قاعدة البيانات والصورة السابقة معًا.

## 17. معايير القبول

- زائر يبدأ محادثة ولا يستطيع الوصول لمحادثة زائر آخر.
- سؤال إداري ينتج إجابة أو بطاقة من بيانات النظام المعتمدة.
- سؤال خارج النطاق لا يحلل الحالة ويعرض التحويل فقط.
- الضيف لا يتحول لموظف قبل إدخال الاسم والجوال.
- تسجيل الدخول يربط المحادثة نفسها ويعيد العملية المعلقة.
- العميل يرى سجله فقط في حسابه.
- موظفان لا يستطيعان استلام المحادثة نفسها.
- AI لا يرد بعد الانتظار أو استلام الموظف.
- الحجز لا ينفذ دون تأكيد.
- وجود موعد مستقبلي يفرض الإقرار الإضافي ويعرض الموعد القائم.
- التعارض أو التطابق يمنع الحجز، وإعادة الطلب لا تكرر العملية.
- إعادة الجدولة والإلغاء تحترمان handlers والسياسات الحالية.
- المحادثة تظهر في الموقع والداشبورد بنفس السجل.
- واتساب غير موجود في الواجهة أو runtime بعد القطع النهائي.
- المحادثات المغلقة الأقدم من 365 يومًا تحذف دون حذف سجل التدقيق المختصر قبل مدته.

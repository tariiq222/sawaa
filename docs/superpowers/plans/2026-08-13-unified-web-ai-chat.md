# Unified Web AI Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** استبدال واتساب بمحادثة ويب موحدة ومساعد إداري، مع سجل للزائر والعميل والاستقبال وعمليات مواعيد آمنة بعد تسجيل الدخول والتأكيد.

**Architecture:** يمدد التنفيذ `ChatConversation/CommsChatMessage` كمصدر وحيد للسجل، ويضيف `ChatOperation` كدفتر تنفيذ مؤقت لعمليات الموعد. يبنى orchestrator إداري محايد فوق `ChatAdapter` ومعالجات النظام الحالية، ثم تستهلكه واجهة الموقع وحساب العميل وصندوق استقبال جديد في الداشبورد قبل إزالة واتساب مرحليًا.

**Tech Stack:** pnpm/Turborepo، NestJS 11، Prisma 7/Postgres، Redis/BullMQ، Next.js 15/React 19، TanStack Query، Vitest/Jest/Playwright، OpenAPI والعميل اليدوي `@sawaa/api-client`.

**Spec:** `docs/superpowers/specs/2026-08-13-unified-web-ai-chat-design.md`

## Global Constraints

- `ChatConversation` و`CommsChatMessage` هما المصدران الوحيدان للمحادثات والرسائل.
- المساعد إداري فقط؛ لا تشخيص، لا تقييم، لا إرشاد علاجي، ولا تاغ خطر.
- عمليات الموعد الشخصية تتطلب `ClientSessionGuard` وتأكيدًا حتميًا.
- وجود أي موعد مستقبلي فعال يفرض عرض الموعد القائم وتأكيدًا إضافيًا لحجز موعد آخر.
- التطابق والتعارض الزمني يمنعان الحجز حتى بعد التأكيد الإضافي.
- مدة عملية التأكيد 15 دقيقة؛ مدة حفظ المحادثة المغلقة 365 يومًا.
- لا تعدل أو تسحق migration قديمة؛ كل تغييرات Prisma في migrations جديدة.
- لا يحذف واتساب أو أسراره أو جداوله قبل backup وفحص counts ونجاح smoke.
- لا يقبل backend `clientId`, `senderType`, `senderId` أو تفاصيل عملية نهائية من المتصفح.
- كل endpoint/DTO جديد موثق في Swagger، ثم يشغل `pnpm openapi:sync` في بوابة تكامل واحدة.
- `packages/api-client` يدوي وليس مولدًا.
- لا WebSockets في الإصدار الأول؛ الداشبورد يستخدم polling.
- حافظ على تغييرات worktree الحالية؛ التنفيذ يبدأ في worktree مستقل.

---

## استراتيجية التنفيذ متعددة الوكلاء

### العقود المشتركة قبل التفريع

يقرأ كل وكيل المواصفة وهذا الملف. لا يغير أي وكيل أسماء الحقول أو endpoints أو حالات العملية دون الرجوع للمنسق. ملفات التسجيل المشتركة (`app.module.ts`, `public.module.ts`, `comms.module.ts`, `query-keys.ts`, `translations.ts`, `openapi.json`) يملكها المنسق في بوابات الدمج، ولا يعدلها وكلاء متوازيون.

### الدفعات

| الدفعة | التنفيذ المتوازي | الاعتماد |
|---|---|---|
| 0 | المنسق: عزل worktree وتثبيت baseline | لا شيء |
| 1 | وكيل واحد: schema والهجرة والعقود المشتركة | 0 |
| 2 | 3 وكلاء: هوية/API الزائر؛ المساعد الإداري؛ backend الاستقبال والصلاحيات | 1 |
| 3 | 3 وكلاء: عمليات الموعد؛ widget/حساب العميل؛ واجهة صندوق الاستقبال | 2 |
| 4 | 3 وكلاء: reliability/retention؛ API clients/OpenAPI؛ مراجعة تكامل سلوكية | 3 |
| 5 | المنسق: دمج واختبارات وإطلاق خلف flags | 4 |
| 6 | وكلاء إزالة أسطح واتساب بالتوازي بعد نجاح الإطلاق، ثم المنسق للهجرة النهائية | بوابة إنتاج صريحة |

كل وكيل يحصل على `Target / Change / Acceptance` وملكية ملفات غير متقاطعة. الوكلاء يشغلون الاختبارات المركزة الخاصة بمهمتهم فقط عند التنفيذ؛ المنسق وحده يشغل typecheck وsmoke والمصفوفة الكاملة عند نهاية كل دفعة.

---

### Task 0: إنشاء بيئة تنفيذ معزولة وتثبيت baseline

**Files:**
- Read: `AGENTS.md`
- Read: `apps/backend/CLAUDE.md`
- Read: `apps/website/CLAUDE.md`
- Read: `apps/dashboard/CLAUDE.md`
- Read: `packages/api-client/CLAUDE.md`
- Read: `docs/superpowers/specs/2026-08-13-unified-web-ai-chat-design.md`

**Interfaces:**
- Consumes: checkout الحالي المتسخ.
- Produces: worktree/branch معزول، baseline موثق، وملكية ملفات للوكلاء.

- [ ] **Step 1: أعد فحص كل worktrees والفروع والتغييرات الحالية**

Run:

```bash
git status --short --branch
git worktree list --porcelain
git branch --show-current
git log -5 --oneline --decorate
```

Expected: لا يوجد افتراض بأن `main` نظيف؛ توثق التغييرات ولا تحذف أو تنقل.

- [ ] **Step 2: أنشئ worktree عبر مهارة `using-git-worktrees`**

Suggested branch: `codex/unified-web-ai-chat`.

Expected: مسار جديد نظيف لا يتضمن تعديلات العمل الجاري إلا ما يدمج عمدًا.

- [ ] **Step 3: ثبت baseline البناء والاختبارات المتأثرة**

Run:

```bash
pnpm --filter=backend test -- src/modules/comms/chat
pnpm --filter=website test -- features/account
pnpm --filter=dashboard test -- test/unit/components/sidebar-config.spec.tsx
pnpm typecheck
```

Expected: PASS، أو تسجيل كل فشل سابق بدقة قبل أي تعديل.

- [ ] **Step 4: أنشئ جدول ملكية الملفات للدفعة الأولى**

لا يسمح لوكيلين بتعديل `comms.prisma` أو ملف module/controller جامع في الدفعة نفسها.

- [ ] **Step 5: Commit نقطة البدء التوثيقية إن كانت هناك ملفات تنفيذية جديدة فقط**

لا تنشئ commit للتغييرات الموجودة مسبقًا دون موافقة صاحبها.

---

### Task 1: عقد البيانات والهجرة الأساسية

**Files:**
- Modify: `apps/backend/prisma/schema/comms.prisma`
- Modify: `apps/backend/prisma/schema/bookings.prisma`
- Create: `apps/backend/prisma/migrations/<timestamp>_unified_web_chat/migration.sql`
- Create: `apps/backend/src/modules/comms/chat/chat-contract.ts`
- Test: `apps/backend/src/modules/comms/chat/chat-contract.spec.ts`

**Interfaces:**
- Consumes: حالات spec المعتمدة.
- Produces: Prisma types لـ`ConversationStatus`, `ChatMessageKind`, `ChatOperation*` وحقول idempotency.

- [ ] **Step 1: اكتب اختبار عقد يفشل قبل إضافة الحالات والحقول**

اختبر على الأقل وجود القيم التالية في Prisma client بعد generate:

```ts
expect(ConversationStatus.AI_ACTIVE).toBe('AI_ACTIVE');
expect(ConversationStatus.WAITING_FOR_STAFF).toBe('WAITING_FOR_STAFF');
expect(ChatOperationStatus.AWAITING_EXISTING_BOOKING_ACK)
  .toBe('AWAITING_EXISTING_BOOKING_ACK');
```

- [ ] **Step 2: شغل الاختبار وتأكد من الفشل المتوقع**

Run: `pnpm --filter=backend test -- src/modules/comms/chat/chat-contract.spec.ts`

Expected: FAIL لأن الأنواع غير موجودة.

- [ ] **Step 3: مدد schema دون تعديل migration قديمة**

طبق حقول `ChatConversation`, `CommsChatMessage`, `ChatOperation` و`Booking.creationIdempotencyKey`. أضف `AI_CHAT` إلى `BookingSource`. لا تحذف قيم legacy في هذه المهمة.

- [ ] **Step 4: اكتب migration صريحة للترحيل والفهارس**

يجب أن:

- تضيف enum values والجداول/الأعمدة.
- تجعل `ChatConversation.clientId` nullable.
- تحول صفوف `OPEN` القديمة إلى `STAFF_ACTIVE`.
- تنشئ unique/indexes المتفق عليها.
- لا تحذف جداول AI أو واتساب.

- [ ] **Step 5: تحقق من Prisma والهجرة**

Run:

```bash
pnpm --filter=backend prisma generate
pnpm --filter=backend test -- src/modules/comms/chat/chat-contract.spec.ts
pnpm --filter=backend typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/prisma/schema/comms.prisma apps/backend/prisma/schema/bookings.prisma apps/backend/prisma/migrations apps/backend/src/modules/comms/chat/chat-contract.ts apps/backend/src/modules/comms/chat/chat-contract.spec.ts
git commit -m "feat(chat): add unified conversation data contract"
```

---

### Task 2: هوية الزائر وملكية المحادثة

**Files:**
- Create: `apps/backend/src/modules/comms/chat/guest/guest-chat-token.service.ts`
- Create: `apps/backend/src/modules/comms/chat/guest/chat-access.service.ts`
- Create: `apps/backend/src/modules/comms/chat/guest/create-conversation.handler.ts`
- Create: `apps/backend/src/modules/comms/chat/guest/claim-conversation.handler.ts`
- Create: matching `*.spec.ts`
- Create: `apps/backend/src/api/public/public-chat.controller.ts`
- Create: `apps/backend/src/api/public/my-chat.controller.ts`
- Test: controller specs for both controllers

**Interfaces:**
- Consumes: Task 1 Prisma contract، `ClientSessionGuard`, CSRF middleware.
- Produces: Cookie `sawaa_chat_guest`، access assertions، create/current/claim APIs.

- [ ] **Step 1: اكتب اختبارات token والحفظ الآمن**

Cases:

- يولد 32 bytes عشوائية على الأقل.
- يعيد hash ثابتًا ولا يعيد token الخام من service التخزين.
- يرفض token غير مطابق.
- `Secure` في production و`SameSite=Lax`, `HttpOnly` دائمًا.

- [ ] **Step 2: شغلها وتأكد من الفشل**

Run: `pnpm --filter=backend test -- src/modules/comms/chat/guest`

- [ ] **Step 3: نفذ `GuestChatTokenService`**

استخدم `CHAT_GUEST_TOKEN_SECRET` وHMAC-SHA256. لا تستخدم `localStorage` أو query token.

- [ ] **Step 4: اكتب اختبارات الملكية والربط**

Cases:

- ضيف A لا يقرأ محادثة B.
- `conversationId` وحده لا يكفي.
- client A لا يقرأ سجل client B.
- claim يتطلب guest cookie وclient session معًا.
- claim يثبت `clientId` ويمسح `guestTokenHash` في transaction.

- [ ] **Step 5: نفذ access/create/current/claim handlers**

لا تقبل `clientId` في DTO. كل ownership يمر عبر `ChatAccessService`.

- [ ] **Step 6: أنشئ controllers وDTOs موثقة**

أضف create/current/claim فقط في هذه المهمة. يملك المنسق تسجيل controllers في `PublicModule` بعد دمج الوكيل.

- [ ] **Step 7: شغل الاختبارات المركزة**

Run:

```bash
pnpm --filter=backend test -- src/modules/comms/chat/guest
pnpm --filter=backend test -- src/api/public/public-chat.controller.spec.ts
pnpm --filter=backend test -- src/api/public/my-chat.controller.spec.ts
```

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/modules/comms/chat/guest apps/backend/src/api/public/public-chat.controller.ts apps/backend/src/api/public/public-chat.controller.spec.ts apps/backend/src/api/public/my-chat.controller.ts apps/backend/src/api/public/my-chat.controller.spec.ts
git commit -m "feat(chat): add secure guest conversation identity"
```

---

### Task 3: الرسائل الموحدة ومعالجة AI idempotent

**Files:**
- Create: `apps/backend/src/modules/comms/chat/messages/send-chat-message.dto.ts`
- Create: `apps/backend/src/modules/comms/chat/messages/send-chat-message.handler.ts`
- Create: `apps/backend/src/modules/comms/chat/messages/list-chat-messages.handler.ts`
- Create: `apps/backend/src/modules/comms/chat/messages/chat-message.mapper.ts`
- Create: matching specs
- Modify: controllers created in Task 2

**Interfaces:**
- Consumes: `ChatAccessService`, `clientMessageId`, conversation status.
- Produces: cursor message API and durable user message ready for assistant processing.

- [ ] **Step 1: اكتب اختبارات الإرسال والقراءة**

Cases:

- body فارغ أو أكبر من الحد يرفض.
- duplicate `(conversationId, clientMessageId)` يعيد الرسالة نفسها.
- sender identity يحدد backend-side.
- cursor pagination ثابتة.
- mapper لا يسرب metadata داخلية.

- [ ] **Step 2: شغل الاختبارات وتأكد من الفشل**

Run: `pnpm --filter=backend test -- src/modules/comms/chat/messages`

- [ ] **Step 3: نفذ handlers والmapper**

رفع `lastMessageAt` وعداد unread يتم في transaction نفسها. لا تستخدم `CreateChatMessageHandler` العام الذي يقبل sender من caller.

- [ ] **Step 4: وصل endpoints للضيف والعميل**

استخدم access context لتحديد `VISITOR` أو `CLIENT`.

- [ ] **Step 5: اختبر controllers**

Run:

```bash
pnpm --filter=backend test -- src/modules/comms/chat/messages
pnpm --filter=backend test -- src/api/public/public-chat.controller.spec.ts
pnpm --filter=backend test -- src/api/public/my-chat.controller.spec.ts
```

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/comms/chat/messages apps/backend/src/api/public
git commit -m "feat(chat): add unified guest and client messaging"
```

---

### Task 4: استخراج الكتالوج وبناء المساعد الإداري المحايد

**Files:**
- Create: `apps/backend/src/modules/org-experience/public-catalog/get-public-catalog.handler.ts`
- Modify: `apps/backend/src/api/public/catalog.controller.ts`
- Create: `apps/backend/src/modules/comms/chat/assistant/administrative-tool-context.ts`
- Create: `apps/backend/src/modules/comms/chat/assistant/administrative-tools.service.ts`
- Create: `apps/backend/src/modules/comms/chat/assistant/administrative-assistant.service.ts`
- Create: `apps/backend/src/modules/comms/chat/assistant/administrative-policy.ts`
- Create: matching specs

**Interfaces:**
- Consumes: `ChatAdapter.completeWithTools`, RAG handlers، public catalog/employee/availability handlers.
- Produces: closed tool allowlist and `processMessage(messageId)`.

- [ ] **Step 1: ثبت سلوك الكتالوج الحالي باختبار handler**

انقل الاختبارات التي تثبت الفلاتر، النشر، الأسعار المخفية والخدمات المؤرشفة من controller إلى handler.

- [ ] **Step 2: استخرج `GetPublicCatalogHandler` ووصل controller به**

Run: `pnpm --filter=backend test -- src/api/public/catalog.controller.spec.ts`

Expected: PASS دون تغيير response.

- [ ] **Step 3: اكتب اختبارات policy والأدوات**

Cases:

- لا توجد أداة تشخيص/تقييم/خطر.
- `clientId` لا يأتي من arguments.
- الأدوات الشخصية ترجع `AUTH_REQUIRED` إن كان context بلا عميل.
- custom prompt لا يستبدل policy الثابتة.
- خارج النطاق ينتج handoff option بلا تحليل.

- [ ] **Step 4: نفذ الأدوات العامة**

نفذ `getCenterInfo`, `listServices`, `listPractitioners`, `getAvailability`, `searchKnowledge`, `handoffToReception` عبر handlers، لا عبر نسخ queries.

- [ ] **Step 5: اكتب اختبارات orchestrator**

Cases:

- حد أربع tool rounds.
- آخر 20 رسالة فقط.
- لا يستدعي AI في `WAITING_FOR_STAFF/STAFF_ACTIVE/CLOSED`.
- يفحص الحالة مجددًا قبل حفظ الرد.
- duplicate response يستخدم `responseForMessageId` ولا ينشئ ردًا ثانيًا.
- فشل المزود يحفظ حالة قابلة لإعادة المحاولة ولا يسرب الخطأ.

- [ ] **Step 6: نفذ `AdministrativeAssistantService`**

استخدم `ChatAdapter` بدل `AgentLlmService`. لا تكتب إلى `ChatSession/ChatMessage`.

- [ ] **Step 7: شغل الاختبارات المركزة**

```bash
pnpm --filter=backend test -- src/modules/org-experience/public-catalog
pnpm --filter=backend test -- src/modules/comms/chat/assistant
```

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/modules/org-experience/public-catalog apps/backend/src/api/public/catalog.controller.ts apps/backend/src/modules/comms/chat/assistant
git commit -m "feat(chat): add channel-neutral administrative assistant"
```

---

### Task 5: التحويل وصندوق الاستقبال backend والصلاحيات

**Files:**
- Create: `apps/backend/src/modules/comms/chat/staff/request-handoff.handler.ts`
- Create: `apps/backend/src/modules/comms/chat/staff/claim-conversation.handler.ts`
- Create: `apps/backend/src/modules/comms/chat/staff/assign-conversation.handler.ts`
- Create: `apps/backend/src/modules/comms/chat/staff/release-conversation.handler.ts`
- Create: `apps/backend/src/modules/comms/chat/staff/close-conversation.handler.ts`
- Create: `apps/backend/src/modules/comms/chat/staff/list-inbox.handler.ts`
- Create: matching specs
- Create: `apps/backend/src/api/dashboard/conversations.controller.ts`
- Modify: `packages/shared/constants/permissions-catalog.ts`
- Modify: `packages/shared/constants/permissions-catalog.test.ts`
- Modify: `apps/backend/src/modules/identity/casl/built-in-rules.ts`

**Interfaces:**
- Consumes: Task 1 status contract and Task 3 messages.
- Produces: handoff/claim/assign/read/release/close APIs and `Conversation` permission subject.

- [ ] **Step 1: اكتب اختبارات طلب التحويل**

Cases:

- الضيف يحتاج اسمًا وجوالًا صالحًا.
- العميل المسجل لا يحتاج body هوية.
- لا تاغ خطر ولا reason طبي.
- الانتقال فقط من `AI_ACTIVE` إلى `WAITING_FOR_STAFF`.

- [ ] **Step 2: نفذ `RequestHandoffHandler` ووصل public/me endpoints**

- [ ] **Step 3: اكتب اختبار السباق في الاستلام**

شغل محاولتي claim متزامنتين؛ واحدة تنجح والثانية `409`.

- [ ] **Step 4: نفذ الاستلام الذري وبقية handlers**

استخدم update مشروطًا بالحالة والموظف. رد الموظف يحدد `STAFF` و`senderId` من JWT فقط.

- [ ] **Step 5: أضف subject `Conversation` للصلاحيات**

امنحه فقط لـ`SUPER_ADMIN`, `ADMIN`, `RECEPTIONIST` بحسب أسماء الأدوار الحالية. لا تغير token semantics أو guard logic.

- [ ] **Step 6: أنشئ controller الداشبورد واختباراته**

لا تعدل `DashboardCommsController` لتقليل التضارب؛ استخدم route/controller مستقلًا.

- [ ] **Step 7: شغل الاختبارات**

```bash
pnpm --filter=backend test -- src/modules/comms/chat/staff
pnpm --filter=backend test -- src/api/dashboard/conversations.controller.spec.ts
pnpm --filter=backend test -- src/modules/identity/casl
pnpm --filter=@sawaa/shared test -- constants/permissions-catalog.test.ts
```

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/modules/comms/chat/staff apps/backend/src/api/dashboard/conversations.controller.ts apps/backend/src/api/dashboard/conversations.controller.spec.ts apps/backend/src/modules/identity/casl/built-in-rules.ts packages/shared/constants
git commit -m "feat(chat): add reception handoff and inbox permissions"
```

---

### Task 6: عمليات الموعد والتأكيد وعدم التكرار

**Files:**
- Create: `apps/backend/src/modules/comms/chat/operations/prepare-booking.handler.ts`
- Create: `apps/backend/src/modules/comms/chat/operations/prepare-reschedule.handler.ts`
- Create: `apps/backend/src/modules/comms/chat/operations/prepare-cancellation.handler.ts`
- Create: `apps/backend/src/modules/comms/chat/operations/confirm-operation.handler.ts`
- Create: `apps/backend/src/modules/comms/chat/operations/decline-operation.handler.ts`
- Create: `apps/backend/src/modules/comms/chat/operations/chat-booking-quote.service.ts`
- Create: matching specs
- Modify: `apps/backend/src/modules/bookings/create-booking/create-booking.handler.ts`
- Modify: `apps/backend/src/modules/bookings/client/client-reschedule-booking.handler.ts`
- Modify: `apps/backend/src/modules/bookings/client/client-cancel-booking.handler.ts`
- Modify: assistant tools from Task 4

**Interfaces:**
- Consumes: client identity، booking handlers، Task 1 `ChatOperation`.
- Produces: prepare/ack/confirm/decline state machine، 15-minute expiry، booking result.

- [ ] **Step 1: اكتب اختبارات state machine للعملية**

Cases:

- guest يصبح `AWAITING_AUTH`.
- client بلا موعد قائم يصبح `AWAITING_CONFIRMATION` بتأكيد واحد.
- client بموعد مستقبلي يصبح `AWAITING_EXISTING_BOOKING_ACK` ويتطلب تأكيدين.
- expired/declined لا ينفذ.
- confirm يقبل `operationId` فقط.

- [ ] **Step 2: اكتب اختبارات قائمة الحالات المستقبلية**

استخدم constants/state machine الحالية بدل تكرار strings. استبعد الملغي والمكتمل والمنتهي و`isHistoricalImport=true`.

- [ ] **Step 3: اكتب اختبارات التعارض وعدم التكرار**

Cases:

- التطابق الكامل يمنع.
- overlap لمواعيد العميل يمنع.
- موعد مختلف يسمح بعد التأكيدين.
- نقر مزدوج يعيد booking نفسه.
- نافذتان متزامنتان لا تنشئان حجزين.
- نجاح DB ثم فشل تحديث بطاقة المحادثة يستعاد بالمفتاح.

- [ ] **Step 4: نفذ quote/prepare handlers**

خزن payload/summary ثابتين و`expiresAt = now + 15 minutes`. لا تنفذ mutation أثناء prepare.

- [ ] **Step 5: مدد `CreateBookingHandler` idempotently**

أضف مفتاح الإنشاء وقفل العميل وفحص overlap داخل transaction دون كسر حماية المعالج الحالية.

- [ ] **Step 6: نفذ confirm transaction**

رتب الأقفال: operation ثم client ثم موارد الحجز؛ أعد فحص version والمدة والسعر والتوفر والموعد القائم قبل handler.

- [ ] **Step 7: وصل reschedule/cancel بالhandlers الحالية**

لا تمرر مدة جديدة في reschedule. احترم نتيجة `CANCEL_REQUESTED` أو الإلغاء المباشر.

- [ ] **Step 8: شغل الاختبارات المركزة**

```bash
pnpm --filter=backend test -- src/modules/comms/chat/operations
pnpm --filter=backend test -- src/modules/bookings/create-booking/create-booking.handler.spec.ts
pnpm --filter=backend test -- src/modules/bookings/client/client-reschedule-booking.handler.spec.ts
pnpm --filter=backend test -- src/modules/bookings/client/client-cancel-booking.handler.spec.ts
```

- [ ] **Step 9: Commit**

```bash
git add apps/backend/src/modules/comms/chat/operations apps/backend/src/modules/comms/chat/assistant apps/backend/src/modules/bookings
git commit -m "feat(chat): add confirmed idempotent appointment operations"
```

---

### Task 7: عميل API اليدوي وعقود الواجهة

**Files:**
- Create: `packages/api-client/src/types/chat.ts`
- Create: `packages/api-client/src/modules/chat.ts`
- Create: `packages/api-client/src/modules/__tests__/chat.test.ts`
- Modify: `packages/api-client/src/types/index.ts`
- Modify: `packages/api-client/src/index.ts`
- Create: `apps/website/features/chat/chat.types.ts`
- Create: `apps/website/features/chat/chat.api.ts`
- Create: `apps/website/features/chat/chat.api.test.ts`

**Interfaces:**
- Consumes: API contract من Tasks 2, 3, 5, 6.
- Produces: typed functions للزائر والعميل دون تسريب guest token.

- [ ] **Step 1: عرف الأنواع العامة الآمنة**

تشمل conversation summary/detail، message union حسب `kind`، action card، operation status، cursor response. لا تتضمن `guestTokenHash`, internal metadata أو prompt.

- [ ] **Step 2: اكتب اختبارات URLs وcredentials وCSRF wrapper**

كل طلب يستخدم `credentials: 'include'`. لا يرسل `clientId` أو sender fields.

- [ ] **Step 3: نفذ module والexports**

- [ ] **Step 4: أضف wrapper الموقع واختباراته**

- [ ] **Step 5: شغل الاختبارات/typecheck**

```bash
pnpm --filter=@sawaa/api-client test -- src/modules/__tests__/chat.test.ts
pnpm --filter=@sawaa/api-client typecheck
pnpm --filter=website test -- features/chat/chat.api.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add packages/api-client apps/website/features/chat/chat.types.ts apps/website/features/chat/chat.api.ts apps/website/features/chat/chat.api.test.ts
git commit -m "feat(chat): add typed web conversation client"
```

---

### Task 8: Widget الموقع واستئناف المحادثة بعد الدخول

**Files:**
- Create: `apps/website/features/chat/ai-chat-widget.tsx`
- Create: `apps/website/features/chat/chat-message-list.tsx`
- Create: `apps/website/features/chat/chat-composer.tsx`
- Create: `apps/website/features/chat/chat-action-card.tsx`
- Create: `apps/website/features/chat/guest-handoff-form.tsx`
- Create: matching tests
- Modify carefully: `apps/website/app/layout.tsx`
- Modify: `apps/website/features/auth/login-form.tsx`
- Modify: `apps/website/features/locale/dictionary.ts`
- Delete after replacement: `apps/website/components/cta/floating-whatsapp.tsx`

**Interfaces:**
- Consumes: Task 7 API client، `redirect` الآمن الحالي.
- Produces: AI icon/widget، auth-resume، handoff form، action confirmations.

- [ ] **Step 1: اكتب اختبارات launcher والنافذة**

Cases: AR/EN، RTL، keyboard/focus، reduced motion، desktop/mobile، reopening دون token في storage.

- [ ] **Step 2: نفذ shell/composer/list**

استخدم design tokens؛ لا inline colors ولا لون واتساب. اسم الواجهة «مساعد سواء الإداري».

- [ ] **Step 3: اكتب اختبارات بطاقات العمليات**

Cases: login required، existing booking acknowledgement، final confirmation، expired، succeeded/failed، double-click disabled.

- [ ] **Step 4: نفذ action cards وhandoff form**

الاسم والجوال يظهران للضيف فقط عند التحويل.

- [ ] **Step 5: اكتب اختبار login return**

يثبت redirect داخليًا فقط، يحافظ على conversation id، يستدعي claim بعد الدخول، ثم يعيد فتح البطاقة دون token في URL.

- [ ] **Step 6: وصل widget في `layout.tsx` بحذر**

أعد دمج التغيير الحالي في الملف يدويًا؛ لا تستبدل الملف كاملًا. استخدم `NEXT_PUBLIC_WEB_CHAT_ENABLED`.

- [ ] **Step 7: احذف Floating WhatsApp ومفاتيحه بعد نجاح البديل**

لا تحذف رقم الاتصال العام من branding/contact pages.

- [ ] **Step 8: تحقق**

```bash
pnpm --filter=website test -- features/chat
pnpm --filter=website test -- features/auth
pnpm --filter=website typecheck
pnpm --filter=website lint
```

- [ ] **Step 9: Commit**

```bash
git add apps/website/features/chat apps/website/features/auth/login-form.tsx apps/website/features/locale/dictionary.ts apps/website/app/layout.tsx apps/website/components/cta/floating-whatsapp.tsx
git commit -m "feat(website): replace WhatsApp with administrative AI chat"
```

---

### Task 9: سجل المحادثات في حساب العميل

**Files:**
- Create: `apps/website/features/chat/account-conversations-tab.tsx`
- Create: `apps/website/features/chat/account-conversation-detail.tsx`
- Create: matching tests
- Modify: `apps/website/features/account/account-feature.tsx`
- Modify: `apps/website/features/account/account-feature.test.tsx`
- Modify: `apps/website/features/locale/dictionary.ts`

**Interfaces:**
- Consumes: `/public/me/chat/**` API.
- Produces: account tab `conversations` and continue/open behavior.

- [ ] **Step 1: اكتب اختبار tab والقائمة والملكية**

اختبر loading/empty/error، الحالات الأربع، آخر رسالة، وفتح detail.

- [ ] **Step 2: نفذ list/detail components**

استخدم نفس message renderer من widget لتفادي اختلاف السجل.

- [ ] **Step 3: مدد `AccountFeature`**

أضف `conversations` إلى union و`TABS`، مع مفاتيح AR/EN.

- [ ] **Step 4: اختبر المتابعة**

المحادثة المفتوحة تعيد فتح widget أو detail موحدًا؛ المغلقة read-only.

- [ ] **Step 5: تحقق وCommit**

```bash
pnpm --filter=website test -- features/account features/chat
pnpm --filter=website typecheck
git add apps/website/features/chat apps/website/features/account apps/website/features/locale/dictionary.ts
git commit -m "feat(website): show conversation history in client account"
```

---

### Task 10: صندوق استقبال الداشبورد

**Files:**
- Create: `apps/dashboard/app/(dashboard)/conversations/page.tsx`
- Create: `apps/dashboard/components/features/conversations/conversations-inbox.tsx`
- Create: `apps/dashboard/components/features/conversations/conversation-list.tsx`
- Create: `apps/dashboard/components/features/conversations/conversation-detail.tsx`
- Create: `apps/dashboard/components/features/conversations/conversation-composer.tsx`
- Create: `apps/dashboard/hooks/use-conversations.ts`
- Create: `apps/dashboard/hooks/use-conversation-mutations.ts`
- Create: `apps/dashboard/lib/api/conversations.ts`
- Create: `apps/dashboard/lib/types/conversations.ts`
- Create: `apps/dashboard/lib/translations/ar.conversations.ts`
- Create: `apps/dashboard/lib/translations/en.conversations.ts`
- Modify by orchestrator: `apps/dashboard/lib/query-keys.ts`, `apps/dashboard/lib/translations.ts`
- Modify: `apps/dashboard/components/sidebar-config.ts`
- Modify: `apps/dashboard/test/unit/components/sidebar-config.spec.tsx`
- Create: focused component/API tests

**Interfaces:**
- Consumes: dashboard conversation APIs and `Conversation` permission.
- Produces: `/conversations` inbox with polling and staff actions.

- [ ] **Step 1: اكتب اختبارات API/hooks**

اختبر filters، 5–10s polling، invalidation بعد claim/reply/release/close، و409 claim.

- [ ] **Step 2: نفذ types/API/hooks**

- [ ] **Step 3: اكتب اختبارات القائمة والتفاصيل**

Cases: waiting/staff/AI/closed، unread badge، guest identity، Arabic RTL، empty/error/loading.

- [ ] **Step 4: نفذ المكونات والصفحة**

الصفحة orchestration فقط وتحت 150 سطرًا؛ كل component تحت حدود المشروع.

- [ ] **Step 5: أضف navigation والصلاحية**

استبدل مدخل واتساب بمدخل «محادثات العملاء» بعد تفعيل الجديد، واستخدم HugeIcons والتوكنز.

- [ ] **Step 6: أضف AR/EN وتحقق من parity**

Run: `pnpm --filter=dashboard i18n:verify`

- [ ] **Step 7: تحقق وCommit**

```bash
pnpm --filter=dashboard test -- test/unit/lib/conversations-api.spec.ts
pnpm --filter=dashboard test -- test/unit/components/sidebar-config.spec.tsx
pnpm --filter=dashboard typecheck
pnpm --filter=dashboard lint
git add apps/dashboard/app/\(dashboard\)/conversations apps/dashboard/components/features/conversations apps/dashboard/hooks apps/dashboard/lib apps/dashboard/components/sidebar-config.ts apps/dashboard/test
git commit -m "feat(dashboard): add reception conversation inbox"
```

---

### Task 11: الاحتفاظ والحدود والتدقيق

**Files:**
- Modify: `apps/backend/src/modules/ops/cron-tasks/data-retention.cron.ts`
- Modify: `apps/backend/src/modules/ops/cron-tasks/data-retention.cron.spec.ts`
- Modify: `apps/backend/src/config/env.validation.ts`
- Modify: `apps/backend/src/config/env.validation.spec.ts`
- Modify: `apps/backend/.env.example`
- Modify: `apps/backend/.env.prod.example`
- Modify: `docker/.env.example`
- Modify: `docker/docker-compose.yml`
- Modify: `docker/docker-compose.prod.yml`
- Create: `apps/backend/src/modules/comms/chat/chat-audit.service.ts`
- Create: matching spec

**Interfaces:**
- Consumes: closedAt، ActivityLog، Redis throttler.
- Produces: 365-day purge، env validation، semantic audit، daily budget.

- [ ] **Step 1: اكتب اختبار retention**

يثبت حذف محادثات `CLOSED` الأقدم من `RETENTION_CHAT_DAYS` فقط، واعتماد cascade، وعدم حذف المفتوحة.

- [ ] **Step 2: نفذ retention 365 يومًا**

استبدل مهام واتساب فقط في مرحلة القطع، ولا تحذفها قبل Task 14.

- [ ] **Step 3: اكتب اختبارات env**

Keys: `WEB_CHAT_ENABLED`, `CHAT_GUEST_TOKEN_SECRET`, `CHAT_MAX_MESSAGE_LENGTH`, `CHAT_RATE_LIMIT_PER_MINUTE`, `CHAT_DAILY_TOKEN_BUDGET`, `CHAT_GUEST_SESSION_DAYS`, `RETENTION_CHAT_DAYS`.

- [ ] **Step 4: نفذ rate/daily budget**

استخدم Redis key keyed by guest hash/client id plus IP defense، مع expiry يومي. لا تسجل raw identifier.

- [ ] **Step 5: اكتب اختبارات audit**

يثبت أن claim/assign/release/close/operation events لا تحتوي message body أو guest phone.

- [ ] **Step 6: تحقق وCommit**

```bash
pnpm --filter=backend test -- src/modules/ops/cron-tasks/data-retention.cron.spec.ts
pnpm --filter=backend test -- src/config/env.validation.spec.ts
pnpm --filter=backend test -- src/modules/comms/chat/chat-audit.service.spec.ts
git add apps/backend/src/modules/ops apps/backend/src/config apps/backend/.env.example apps/backend/.env.prod.example docker apps/backend/src/modules/comms/chat/chat-audit.service.ts apps/backend/src/modules/comms/chat/chat-audit.service.spec.ts
git commit -m "feat(chat): add retention limits and safe audit events"
```

---

### Task 12: تسجيل الوحدات وOpenAPI وبوابة التكامل

**Files:**
- Modify: `apps/backend/src/modules/comms/comms.module.ts`
- Modify: `apps/backend/src/api/public/public.module.ts`
- Modify: `apps/backend/openapi.json`
- Modify: `apps/dashboard/lib/types/api.generated.ts`
- Modify as required: module exports in bookings/org-experience/people
- Create: `apps/dashboard/e2e/smoke/conversations.spec.ts`

**Interfaces:**
- Consumes: جميع Tasks 1–11.
- Produces: runtime wired، snapshot متزامن، smoke كامل.

- [ ] **Step 1: سجل providers/controllers مركزيًا**

حل تعارض imports يدويًا. تأكد أن `AiModule` الفعلي مسجل أو أن handlers المطلوبة exported عبر module واضح؛ الوضع الحالي يحتاج فحصًا لأن `AiModule` ليس ظاهرًا في `AppModule`.

- [ ] **Step 2: شغل وحدات backend المتأثرة**

```bash
pnpm --filter=backend test -- src/modules/comms/chat
pnpm --filter=backend test -- src/api/public/public-chat.controller.spec.ts
pnpm --filter=backend test -- src/api/public/my-chat.controller.spec.ts
pnpm --filter=backend test -- src/api/dashboard/conversations.controller.spec.ts
```

- [ ] **Step 3: جدد OpenAPI مرة واحدة**

Run: `pnpm openapi:sync`

Expected: snapshot وdashboard generated types يتغيران مع endpoints الجديدة، دون محو تغييرات عقود حجز مقصودة من العمل الجاري.

- [ ] **Step 4: شغل API client tests وtypecheck**

```bash
pnpm --filter=@sawaa/api-client test
pnpm typecheck
```

- [ ] **Step 5: اكتب smoke الداشبورد**

يغطي waiting → claim → staff reply → release-to-ai → close.

- [ ] **Step 6: شغل مصفوفة التكامل**

```bash
pnpm --filter=website test -- features/chat features/account features/auth
pnpm --filter=dashboard test -- test/unit/lib/conversations-api.spec.ts
pnpm --filter=dashboard i18n:verify
pnpm --filter=dashboard run e2e:smoke
pnpm typecheck
pnpm lint
```

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/modules apps/backend/src/api apps/backend/openapi.json apps/dashboard/lib/types/api.generated.ts apps/dashboard/e2e/smoke/conversations.spec.ts
git commit -m "feat(chat): integrate unified web conversation flow"
```

---

### Task 13: الإطلاق خلف flags والتحقق اليدوي

**Files:**
- Modify: deployment environment only after approval
- Create: `docs/operations/unified-web-chat-rollout.md`

**Interfaces:**
- Consumes: integrated build.
- Produces: evidence gate قبل إزالة واتساب.

- [ ] **Step 1: انشر والـflags مغلقة**

`WEB_CHAT_ENABLED=false`, `NEXT_PUBLIC_WEB_CHAT_ENABLED=false` مع secrets/config المطلوبة.

- [ ] **Step 2: فعّلها داخليًا ونفذ السيناريو الكامل**

زائر → سؤال إداري → تسجيل دخول → عرض موعد قائم → إقرار موعد إضافي → تأكيد → سجل العميل → handoff → claim موظف → رد → إغلاق.

- [ ] **Step 3: اختبر حالات الفشل**

مزود AI غير متاح، operation منتهية، double click، claim متزامن، slot تغير، محاولة ownership غير صحيحة.

- [ ] **Step 4: سجل أدلة runtime**

توثق timestamps، HTTP status، booking id واحد، conversation id واحد، وعدم وجود رد AI بعد takeover. لا توثق secrets أو نصوص حساسة.

- [ ] **Step 5: فعّل widget للعامة وأخفِ زر واتساب**

لا تحذف runtime واتساب بعد؛ افصله فقط.

- [ ] **Step 6: راقب فترة الاستقرار المعتمدة**

مؤشرات: error rate، AI latency/cost، handoff rate، operation success، duplicate prevention.

---

### Task 14: حذف كود وواجهات واتساب

**Files:**
- Delete: `apps/backend/src/modules/whatsapp-agent/`
- Delete: `apps/backend/src/modules/integrations/whatsapp/`
- Delete: `apps/backend/src/infrastructure/whatsapp/`
- Delete: WhatsApp controllers under `apps/backend/src/api/`
- Modify: `apps/backend/src/app.module.ts`
- Modify: `apps/backend/src/main.ts`
- Delete: `apps/dashboard/app/(dashboard)/whatsapp/`
- Delete: `apps/dashboard/components/features/whatsapp/`
- Delete: `apps/dashboard/hooks/use-whatsapp.ts`
- Delete: `apps/dashboard/hooks/use-whatsapp-mutations.ts`
- Delete: `apps/dashboard/lib/api/whatsapp.ts`
- Delete: `apps/dashboard/lib/types/whatsapp.ts`
- Delete: `apps/dashboard/lib/translations/ar.whatsapp.ts`
- Delete: `apps/dashboard/lib/translations/en.whatsapp.ts`
- Modify: dashboard navigation/settings/translations/permissions
- Modify: backend env/Docker/CI validation surfaces

**Interfaces:**
- Consumes: نجاح Task 13 وإذن القطع.
- Produces: build بلا runtime أو UI أو config واتساب، مع بقاء الجداول مؤقتًا حتى Task 15.

- [ ] **Step 1: افصل Evolution وأوقف webhook/worker**

تحقق runtime أن لا رسائل تدخل أو تخرج. أزل الأسرار من secret manager بعد توثيق rollback window.

- [ ] **Step 2: احذف backend WhatsApp code والتسجيل**

أزل CSRF webhook exemption وأي startup sync/queue registration.

- [ ] **Step 3: احذف dashboard WhatsApp surface**

تأكد أن `/conversations` هو المدخل الوحيد وأن settings لا يعرض اتصال واتساب.

- [ ] **Step 4: نظف env/Docker/CI والترجمات والصلاحيات**

لا تحذف `Conversation` الجديد. احذف `WhatsappConversation` permission بعد ترحيل الأدوار.

- [ ] **Step 5: جدد OpenAPI واختبر**

```bash
pnpm openapi:sync
pnpm --filter=backend test -- src/config/env.validation.spec.ts
pnpm --filter=dashboard i18n:verify
pnpm typecheck
pnpm lint
pnpm --filter=dashboard run e2e:smoke
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(comms): remove WhatsApp runtime and interfaces"
```

---

### Task 15: الهجرة التدميرية النهائية وتنظيف AI القديم

**Files:**
- Modify: `apps/backend/prisma/schema/comms.prisma`
- Modify: `apps/backend/prisma/schema/ai.prisma`
- Create: `apps/backend/prisma/migrations/<timestamp>_drop_retired_chat_channels/migration.sql`
- Modify: retention cron tests after removal

**Interfaces:**
- Consumes: production gate، backup، counts.
- Produces: حذف جداول واتساب و`ChatSession/ChatMessage` المتقاعدة دون فقد سجل مطلوب.

- [ ] **Step 1: خذ backup واكتب timestamp/checksum ومسار الاستعادة**

هذه الخطوة تتطلب موافقة تشغيلية صريحة. لا تستمر إن لم ينجح اختبار قابلية الاستعادة المتفق عليه.

- [ ] **Step 2: نفذ فحوص البيانات read-only**

```sql
SELECT COUNT(*) FROM "WhatsappAgentConfig";
SELECT COUNT(*) FROM "WhatsappConversation";
SELECT COUNT(*) FROM "WhatsappMessage";
SELECT COUNT(*) FROM "Booking" WHERE source = 'WHATSAPP';
SELECT COUNT(*) FROM "Client" WHERE source = 'WHATSAPP';
SELECT COUNT(*) FROM "ChatSession";
SELECT COUNT(*) FROM "ChatMessage";
```

Expected: جداول واتساب الثلاثة صفر كما ذكر المالك؛ أي قيمة غير صفرية توقف الحذف. بيانات source أو AI القديمة تحتاج mapping/migration موثقًا ولا تحذف عميانيًا.

- [ ] **Step 3: اكتب migration الحذف فقط بعد اجتياز البوابة**

احذف جداول واتساب وأنواعها، ثم جداول AI القديمة بعد نقل أي سجل مطلوب. لا تعدل migration تاريخية.

- [ ] **Step 4: لا تحذف enum values التاريخية إن كانت مستخدمة**

إن كانت counts لـ`Booking/Client source=WHATSAPP` غير صفرية، احتفظ بالقيمة legacy. إزالة PostgreSQL enum value ليست جزءًا من drop tables.

- [ ] **Step 5: شغل migration في staging ثم smoke**

```bash
pnpm db:migrate
pnpm --filter=backend run test:smoke
pnpm --filter=dashboard run e2e:smoke
```

- [ ] **Step 6: طبق production migration وحقق counts/runtime**

بعد هذه النقطة rollback يعني استعادة DB والصورة السابقة معًا.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/prisma apps/backend/src/modules/ops
git commit -m "chore(db): drop retired WhatsApp and legacy AI chat tables"
```

---

### Task 16: التحقق النهائي والمراجعة والتسليم

**Files:**
- Review: all diff
- Update: operational runbook and release notes only

**Interfaces:**
- Consumes: Tasks 0–15.
- Produces: claim موثق: implemented، locally verified، staging verified، أو production proven.

- [ ] **Step 1: راجع diff والحدود**

```bash
git status --short --branch
git diff --check
git diff --stat
rg -n -i "whatsapp|wa\.me|WHATSAPP" apps packages docker .github --glob '!apps/backend/prisma/migrations/**'
```

Expected: لا runtime/UI واتساب؛ الاستثناءات التاريخية الموثقة فقط.

- [ ] **Step 2: شغل المصفوفة الكاملة**

```bash
pnpm --filter=backend run test
pnpm --filter=backend run test:e2e
pnpm --filter=website test
pnpm --filter=dashboard test
pnpm openapi:sync
pnpm typecheck
pnpm lint
pnpm build
pnpm --filter=dashboard run e2e:smoke
```

- [ ] **Step 3: نفذ الفحص اليدوي النهائي**

زائر، عميل، موعد قائم، موعد إضافي، duplicate/overlap، reschedule، cancel request، handoff، claim race، release، close، history، retention dry-run.

- [ ] **Step 4: اطلب مراجعة كود مستقلة**

استخدم `requesting-code-review` مع مراجعات منفصلة للأمن/الملكية، عمليات الحجز، والواجهات.

- [ ] **Step 5: أصلح الملاحظات وأعد الاختبارات المتأثرة ثم البوابة الكاملة**

- [ ] **Step 6: سلم تقريرًا بالأدلة**

افصل بوضوح بين implemented، locally verified، staging verified، وproduction proven. اذكر backup وmigration وflags ومقاييس المراقبة دون أسرار.

---

## توزيع الوكلاء المقترح عند التنفيذ

### Batch 1

- **Agent schema-contract:** Task 1 فقط.
- **Orchestrator:** مراجعة migration وتثبيت الأنواع ثم الدمج.

### Batch 2 — متوازية

- **Agent guest-api:** Tasks 2 و3؛ يملك `guest/`, `messages/`, public controllers.
- **Agent assistant-core:** Task 4؛ يملك `assistant/` واستخراج الكتالوج.
- **Agent staff-backend:** Task 5؛ يملك `staff/`, dashboard controller, permissions.
- **Orchestrator:** يسجل modules فقط بعد انتهاء الثلاثة ويشغل backend focused gate.

### Batch 3 — متوازية

- **Agent booking-operations:** Task 6؛ ملكية حصرية لملفات bookings المتقاطعة.
- **Agent website-chat:** Tasks 7–9؛ لا يلمس backend snapshots.
- **Agent dashboard-inbox:** Task 10؛ لا يلمس WhatsApp القديم بعد.
- **Orchestrator:** يدمج registrations وquery keys/translations المشتركة.

### Batch 4 — متوازية

- **Agent reliability:** Task 11.
- **Agent contract-integration:** Task 12 حتى OpenAPI/API client checks.
- **Agent review:** مراجعة spec compliance وownership/idempotency read-only.
- **Orchestrator:** الاختبارات الكاملة وTask 13.

### Batch 5 — بعد بوابة الإنتاج

- **Agent whatsapp-backend-removal:** backend/env/CI من Task 14.
- **Agent whatsapp-dashboard-removal:** dashboard/settings/translations من Task 14.
- **Agent residual-audit:** `rg` وبيانات counts وrunbook، قراءة فقط.
- **Orchestrator:** Task 15 migration النهائية ثم Task 16.

لا تبدأ أي دفعة حتى تحقق الدفعة السابقة acceptance الخاص بها. لا يسمح لوكلاء الإزالة بتشغيل migration أو حذف بيانات؛ المنسق وحده ينفذ ذلك بعد موافقة تشغيلية وbackup.

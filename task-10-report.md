# Task 10 — Dashboard reception conversation inbox

## Result

- Added `/conversations` as the guarded dashboard inbox for the backend `DashboardConversationsController` contract.
- Added 7.5-second polling, inbox filters, statuses, unread badges, authorized guest identity display, cursor response types, and loading/error/empty states.
- Added claim, reply, admin assignment, release, close, and automatic mark-read actions with conversation-cache invalidation.
- Claim HTTP 409 is preserved by the API and shown as a dedicated translated conflict state.
- Replaced the WhatsApp sidebar entry with `nav.conversations`, `/conversations`, and `conversation:read`.
- Did not reuse WhatsApp UI/API and did not modify backend guards or CASL.
- Did not modify `apps/dashboard/lib/query-keys.ts` or `apps/dashboard/lib/translations.ts`.

## Verification

- Focused Vitest: 4 files, 27 tests passed.
- `pnpm --filter=dashboard i18n:verify`: passed.
- `pnpm --filter=dashboard typecheck`: passed.
- `pnpm --filter=dashboard lint`: passed with 11 pre-existing warnings and zero errors.
- All new pages/components/hooks/API/types/translations are below their applicable 150/300/200/250/300 line limits.

## Required central integration hunks

Apply the following centrally after this commit. The translation hunk is required for the new page text to resolve at runtime. The query-key hunk plus hook migrations remove the temporary feature-local query-key factory.

### `apps/dashboard/lib/query-keys.ts`

```diff
@@
   contactMessages: {
     all: ["contact-messages"] as const,
     list: (filters?: object) => ["contact-messages", "list", filters] as const,
   },
+
+  /* ─── Reception conversations ─── */
+  conversations: {
+    all: ["conversations"] as const,
+    list: (filters?: object) => ["conversations", "list", filters ?? {}] as const,
+    detail: (id: string) => ["conversations", "detail", id] as const,
+    messages: (id: string, filters?: object) =>
+      ["conversations", "messages", id, filters ?? {}] as const,
+    staff: () => ["conversations", "assignable-staff"] as const,
+  },
```

### `apps/dashboard/hooks/use-conversations.ts`

```diff
@@
+import { queryKeys } from "@/lib/query-keys"
@@
-export const conversationQueryKeys = { ... }
@@
-    queryKey: conversationQueryKeys.list(filters),
+    queryKey: queryKeys.conversations.list(filters),
@@
-    queryKey: conversationQueryKeys.detail(conversationId ?? ""),
+    queryKey: queryKeys.conversations.detail(conversationId ?? ""),
@@
-    queryKey: conversationQueryKeys.messages(conversationId ?? "", filters),
+    queryKey: queryKeys.conversations.messages(conversationId ?? "", filters),
@@
-    queryKey: conversationQueryKeys.staff,
+    queryKey: queryKeys.conversations.staff(),
```

### `apps/dashboard/hooks/use-conversation-mutations.ts`

```diff
@@
-import { conversationQueryKeys } from "@/hooks/use-conversations"
+import { queryKeys } from "@/lib/query-keys"
@@
-  const invalidate = () => queryClient.invalidateQueries({ queryKey: conversationQueryKeys.all })
+  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all })
```

### `apps/dashboard/lib/translations.ts`

```diff
@@
 import { enWhatsapp } from "./translations/en.whatsapp"
+import { enConversations } from "./translations/en.conversations"
@@
 import { arWhatsapp } from "./translations/ar.whatsapp"
+import { arConversations } from "./translations/ar.conversations"
@@
-  en: { ...en, ...enChatbot, ...enChatbotExtended, ...enWhatsapp },
-  ar: { ...ar, ...arChatbot, ...arChatbotExtended, ...arWhatsapp },
+  en: { ...en, ...enChatbot, ...enChatbotExtended, ...enWhatsapp, ...enConversations },
+  ar: { ...ar, ...arChatbot, ...arChatbotExtended, ...arWhatsapp, ...arConversations },
```

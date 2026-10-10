# Task 10 — Dashboard reception conversation inbox

## Result

- Added `/conversations` as the guarded dashboard inbox for the backend `DashboardConversationsController` contract.
- Added 7.5-second polling, inbox filters, statuses, unread badges, authorized guest identity display, cursor response types, and loading/error/empty states.
- Added claim, reply, admin assignment, release, close, and automatic mark-read actions with conversation-cache invalidation.
- Claim HTTP 409 is preserved by the API and shown as a dedicated translated conflict state.
- Replaced the WhatsApp sidebar entry with `nav.conversations`, `/conversations`, and `conversation:read`.
- Did not reuse WhatsApp UI/API and did not modify backend guards or CASL.
- The review round did not modify `apps/dashboard/lib/query-keys.ts` or `apps/dashboard/lib/translations.ts`; their previously requested registration was applied separately in `59d7957a`.

## Verification

- Focused backend Jest: 4 files, 22 tests passed.
- Focused dashboard Vitest: 7 files, 51 tests passed.
- `pnpm --filter=dashboard i18n:verify`: passed.
- `pnpm --filter=dashboard typecheck`: passed.
- `pnpm --filter=dashboard lint`: passed with 11 pre-existing warnings and zero errors.
- `git diff --check`: passed.
- All new pages/components/hooks/API/types/translations are below their applicable 150/300/200/250/300 line limits.

## Historical central integration hunks (applied)

> Applied centrally in follow-up commit `59d7957a`; no additional central query-key or translation-assembly change is required by the review round below.

The following hunks were applied in `59d7957a` and are retained here as integration history.

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

## Review round

- Added the existing safe `isAiChat` boolean to the staff conversation projection. Release is now offered only for confirmed AI conversations; legacy non-AI staff conversations never infer eligibility.
- Claim conflicts invalidate the full conversation cache immediately on HTTP 409, causing active inbox/detail queries to refetch without waiting for polling.
- Inbox and message queries now use cursor-aware infinite queries. Both surfaces expose load-more controls and preserve filters plus the 7.5-second polling interval.
- Added explicit detail loading/error states; stale list summaries are no longer used to expose identity or actions while detail authorization is unresolved.
- Added backend-supported assignment filters for reception and administrators, permission-aware update actions, admin close for AI-active conversations, and forbidden/error surfacing.
- Mark-read uses the actual `{ markedReadCount, readAt }` response, clears its attempt marker on failure, surfaces the error, and retries on the next detail refresh.
- Reply drafts are cleared only after a successful mutation. Failed replies preserve the text for retry.
- Legacy `EMPLOYEE` messages render as outgoing staff messages, `/conversations` has a translated breadcrumb, and waiting status uses the existing `text-warning` token.
- Runtime controller registration, OpenAPI regeneration, and dashboard E2E remain explicitly scoped to Task 12.

## Final review fixes

- Conversation reply drafts are scoped by conversation identity. Switching from conversation A to B starts with an empty composer.
- Async reply completion clears only the exact submitted draft; text typed while the request is pending is preserved, and failures retain the submitted draft.
- The sidebar footer now derives its `/conversations` shortcut from permission-filtered navigation and no longer links to `/whatsapp`.
- Restored the backend-supported `from` and `to` filter contract and exposed inclusive UTC date controls. Reception staff can use the safe `all`, `me`, and `unassigned` assignment filters supported by the backend access predicate.
- Conversation timestamps use the selected Arabic or English locale.
- Automatic mark-read waits for the message page before choosing `throughMessageId`, tracks one in-flight request per conversation, and keeps completed message-generation markers independently. This prevents both A → B → A duplicates and the initial detail-before-messages `all` → message-ID race.

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

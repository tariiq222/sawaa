# Home screen cleanup and live session card — 2026-10-11

## Change

- **Live session bug.** The "next appointment" card vanished the moment a session started. The backend `list-client-upcoming-bookings.handler.ts` no longer filters on `scheduledAt > now`; only `endsAt > now` remains, so an in-progress booking is returned. The response shape is unchanged, so no `openapi:sync` is needed.
- **Mobile live state.** `nextPortalBooking` returns an in-progress booking first; new helpers `isPortalBookingLive` and `portalBookingEndInstant` (`lib/portal-booking-time.ts`). The home timer now fires at the next boundary: start while upcoming, end while live. `UpNextCard` shows «جلستك بدأت», a «مباشر الآن» pill, the time range and, for online bookings, `JoinVideoCallButton`. The upcoming state shows day + month in the date box, weekday + time, service · therapist · delivery, and a status pill. `PortalBookingRow` gained `zoomMeetingStatus`.
- **Duplicate section removed.** `HomeDiscoveryCards` (and its test) deleted along with the «اختر من هنا» / «تعرّف على خدماتنا» headers. The `assets/discovery/*.webp` images are now unreferenced and were left in place.
- **Shorter rows.** Therapists: first 6 with «عرض الكل (N)». Assessment services: first 3; «عرض الكل (N)» opens Explore with `filter=service` (new `filter` search param in `ExploreDirectory`). Clinics without a description show only the therapist count.
- **Copy and header.** `home.packageBalance` is «رصيد جلساتك»; only two greetings (morning 5–12, otherwise evening); date label uses the Gregorian calendar in Arabic; guest header uses an unmirrored `LogIn` icon (a `scaleX: -1` transform made the SVG invisible on iOS 26); pull-to-refresh also refetches package purchases; the balance card is hidden when no sessions remain; `home.bookNow` is «احجز موعدًا».
- **Rename.** «البرامج» is now «مجموعات الدعم» (`guest.programs`, and the `guest.subtitle` sentence). `clinics.therapistsCount` now says «مختص» with Arabic plural forms.

- **Follow-up fixes (2026-10-12).** Header bell and login buttons use `Glass` `onPress`/`interactive` directly. Arabic plurals: added `@formatjs/intl-pluralrules@6.2.4` polyfill (Hermes has no `Intl.PluralRules`, so `_two`/`_few`/`_many` never resolved). Gregorian dates: `lib/session-format.ts` `localeOf` now returns `ar-SA-u-ca-gregory` because Hermes ignored the `calendar` option and the home header showed a Hijri date. `UpNextCard` reads `deliveryType` (falling back to `type`); it previously read `type`, which is the booking kind, so online sessions showed «حضوري».

## Git state

Uncommitted on local `develop`. Not pushed, merged or deployed.

## Checks

See the final report of the implementing session for exact pass counts (backend `src/modules/bookings/client` + `src/api/mobile/client/portal`, mobile `typecheck` and `test`).

## Verified on simulator (iPhone 17, iOS 26.5, local backend, 2026-10-12)

Debug build via `xcodebuild`, Metro, local backend on `sawaa_local_20260730` (after applying 10 pending local migrations). Guest home: carousel with 3 local test cards, therapists «عرض الكل (9)», clinics «مختصان», login icon visible. Client home (local synthetic review account with temporary test data, all removed afterwards): «جلستك بدأت» + «مباشر الآن», time range, «عن بُعد», Gregorian date, bell icon visible.

## Not verified

Join button (video calls are feature-flagged off), the card flipping away at the end time, the upcoming (non-live) card, the package balance card and the Explore `filter=service` link were not exercised live.

## Second round — whole-app audit fixes (2026-10-12)

Uncommitted on local `develop`, alongside the home changes above.

- **Auth:** Email prompt «لاحقًا» persists 7 days per user (`features/auth/client-email-snooze.ts`); `email-verify` treats only `mode=prompt` as prompt. `suspended` shows «تواصل مع الإدارة» (dials centre phone). `forgot-password` uses the default keyboard. Consent uses a real `CheckboxRow` instead of ☑/☐ glyphs.
- **Notifications:** retry calls `refresh`; payment notifications route to the appointment or appointments tab; conversation notifications no longer push the list onto itself; one unread count; back falls back to home.
- **Groups:** load-error copy, full-session contact action instead of register, navigate to appointments after a free registration, card button «عرض التفاصيل».
- **Appointments tab:** i18n chip labels; empty state «احجز موعدًا» → clinics.
- **Rating:** removed client-side `isPublic: true` (backend already stores `false`; admin controls visibility) and added a note.
- **Account / packages:** «التواصل مع المركز» replaces the «٢٤/٧ اتصال فوري» claim; one name «رصيد جلساتك»; «عرض الباقة»; flexible credit gets «اتصل بالمركز»; `MenuGroup` key warning fixed.
- **Booking flow:** clinic CTA switches to the tab (single-service clinics go straight to specialists) with consistent `steps`; `steps` carried through explore/profile/public-detail and payment-recovery redirects (navigation params only, no payment logic changed); UpNext empty CTA → clinics; stale guest screens dismissed after login; guest tabs pass `redirect`; `goBackOrHome` fallbacks; package-credit hint on confirm; kind-specific guest sign-in copy.
- **Terminology:** «المختص/المختصون», «مجموعات الدعم», «موعد» instead of «زيارة», unified retry wording; removed unused `welcome.sub` superlative and `settings.tenant.*`.

Not changed (owner decision / payments tier): the three payment-resume screens.

Checks: mobile typecheck clean; full mobile jest 239/240 suites (the remaining failure, `clients-load-failure`, is an employee-screen timeout under load that passes alone).

Simulator (iPhone 17, local backend): cold start without the email prompt, home empty state, appointments chips and «احجز موعدًا» → clinics, «مختصان», clinic tab «المختصون» and CTA → «اختر المختص» «الخطوة ٢ من ٤», account «رصيد جلساتك» / «آخر موعد» / «التواصل مع المركز» without the key warning, login page «دخول الحساب التجريبي». Not exercised live: notifications, groups, rating, packages, guest→login→confirm stack, suspended screen.
- Apple review sign-in: the email screen («المتابعة بالبريد الإلكتروني») now has «الدخول بكلمة المرور», which signs in any client that has a password via the existing `/mobile/auth/password-login` endpoint (no backend change). The separate «دخول الحساب التجريبي» link on the phone step was removed. App Review uses: «الدخول بالبريد الإلكتروني» → «الدخول بكلمة المرور» → review email + password.

## Third round — guest login and account tab (2026-10-12)

Uncommitted on local `develop`.

- **Login:** removed «المتابعة كزائر» from the phone step and from `staff-login.tsx`; the header back arrow is the only way back (falls back to guest home without history).
- **Preferences (client, employee, guest):** language is now a switch row («English», on = English) in the same card as «الوضع الليلي», replacing the Arabic/English segmented control. The restart prompt is unchanged.
- **Therapist profile and card:** the «متاح اليوم» pill is gone from both (the backend flag only meant an availability rule exists for today's weekday). The hero pill now shows «ابتداءً من <lowest price>» from `minServicePrice` (never a zero); the card keeps its price line with the same wording (`therapists.fromPrice` → «ابتداءً من {{price}}»). The «يظهر السعر في الخطوة التالية» hint under «احجز موعدًا» was removed with no replacement (`employeeProfile.priceAtNextStep` deleted). `PublicEmployeeItem` gained `availableDaysOfWeek` (typed only, not displayed).
- **Therapist description and About tab:** the one-line description under the name is now the job title only (`title`, falling back to the specialty when the title is empty) instead of «specialty · title». The About tab is a card with the bio plus InfoRows for التخصص, سنوات الخبرة and اللغات (rows omitted when empty); `employeeSelfProfile.publicLanguages/publicExperience` are no longer used there.
- **About section:** the build-number row was removed from every account screen; only «الإصدار» remains (`getAppVersion` still exposes the build for diagnostics).
- **Guest account tab (`app/(guest)/guest-account.tsx`):** rebuilt on `AccountScaffold` to mirror the client account tab. A `GuestWelcomeCard` on top (logo, «سجّل دخولك لحجز مواعيدك ومتابعتها», three benefits, primary «الدخول أو إنشاء حساب» → `/(auth)/login` with `redirect=/(client)/(tabs)/account`), then language + dark mode (`AccountPreferences role="guest"`, no push row, no profile sync), «التواصل مع المركز», and «عن التطبيق» (privacy, version, build). Removed `guest.visitorAccount` / `guest.accountIntro`.
- **Email entry:** removed the always-visible «تعديل البريد / البدء من جديد» button. A pencil (`EditableEmail`, a11y «تعديل البريد الإلكتروني») now sits beside the email in the code step («أُرسل الرمز إلى …») and the register / verify-phone steps; it returns to the email field with the typed address kept (new `editEmail` reducer action). The phone-code step has no pencil; the back arrow exits as before.
- **Email entry layout:** error, expired-flow and resend countdown now sit directly under the primary action; «الدخول بكلمة المرور» / «الدخول برمز التحقق» and «الدخول برقم الجوال» are grouped at the end. Arabic countdown reads «يمكنك إعادة الإرسال بعد {{seconds}} ث» (avoids the «6 ثانية» grammar error; used by all OTP screens).
- **Error box:** new `components/ui/InlineAlert.tsx` (centered, tinted one-row error box: icon + message). Used for errors on the email-entry (code and password modes) and phone login screens; switching between password and code mode clears the previous error; the countdown under it is centered too.
- **Email entry defaults to password:** the email screen opens in password mode; «الدخول برمز التحقق» and «الدخول برقم الجوال» sit on one row with a faint divider. The staff email fallback (`autoStart`) still opens in code mode. App Review note updated in `docs/mobile-app/review-account.md`.
- **Home clinics:** kept the horizontal photo slider (a vertical stack was tried and rejected as too long) but it now shows every clinic instead of the first six. The clinics «عرض الكل» link on home was removed; each card opens its clinic directly.
- **Home packages and support groups:** two new horizontal sliders under clinics (`HomePackagesSlider`, `HomeGroupsSlider`), same card shape: icon tile (date box for a scheduled group) + two-line name, two-line description, price («تبدأ من» when several options) and a pill (sessions / seats left). Every item is shown, no «عرض الكل»; a tap opens the package or group (public detail for guests). Home pull-to-refresh also refetches both.
- **Guest appointments tab:** rebuilt on `AccountScaffold`: calendar hero, «مواعيدك في مكان واحد», three benefits, «الدخول لعرض مواعيدي» (redirect to the appointments tab) and a ghost «احجز موعدًا» → public clinics list. `guest.accountAppointmentsHint` removed.
- **Public package / group detail (guests):** `PackageOverview` (image, name, description, «packages.intro», every option with price, VAT note, session count and group composition) and `GroupOverview` (name, seats pill, description, rows for date, days, hours per day, duration, participants, price, deposit). Header shows the kind title; the sign-in prompt is a card at the end.
- **Package purchase and group enrollment as steps (shared by guests and clients):** packages: details (`/(client)/packages/[id]` = `/public-detail/package/[id]`, shared `PackageDetailsStep`, option radios when >1) → confirm (`/(client)/packages/confirm`, guest `/public-packages/confirm`, InfoRows summary with VAT rows when applicable). The branch is never asked for (single-branch centre): `resolveDefaultBranch` picks the main branch, else the first; purchase stays disabled with «يلزم اختيار فرع قبل الدفع» while no branch is known. Groups: details (`GroupDetailsStep`) → confirm (`/(client)/groups/confirm`, guest `/public-groups/confirm`). Guests see «الدخول أو التسجيل للمتابعة» on confirm and return to the same confirm after login via `loginRedirectHref`. Payment logic moved unchanged: `recoverPending` → `features/packages/use-pending-package-recovery.ts`, `handlePurchase`/`checkoutInFlight`/`userRef` → `packages/confirm.tsx`, `onJoin` → `groups/confirm.tsx`; `lib/package-checkout.ts`, `packages/return.tsx`, `payments/**` untouched. `guest.signInToBuyPackage` / `guest.signInToJoinProgram` are now unused.
- **Explore tab rebuilt as a directory:** search + chips («الكل» and the five kinds) with results always visible (`ExploreResults`: grouped by kind, 4 per kind with «عرض الكل (N)» in «الكل» mode, unlimited for a chip or a search), kind icons and chevrons; then «الفروع» (`ExploreBranches` → new public `app/branch/[id].tsx`: name, address, phone, opening hours, «اتصال» and «فتح في الخرائط» via maps:/geo: with a Google Maps fallback; new `usePublicBranch`) and «المركز» (`ExploreCenter`: phone + email from branding). `PublicBranchDetail.businessHours` fields corrected to `startTime`/`endTime` to match the API.
- **Local test data only:** the centre coordinates (24.7244103, 46.6477824) were set on «الفرع الرئيسي» (and `isMain` moved to it from a leftover e2e branch) in the local `sawaa_local_20260730` database to exercise the maps button; the dashboard has no field for branch coordinates yet (backend DTO accepts `latitude`/`longitude`).
- **No duplicate error popup on sign-in:** `services/query-client.ts` honours `meta.silentError` for mutations; the email-entry and phone-entry flows set it because they show inline errors, so the global «حدث خطأ» alert no longer appears on top of them.
- **Shared:** «التواصل مع المركز» row extracted to `components/features/account/CenterSupportSection.tsx`, used by both client and guest account tabs. It now also shows «التوجه إلى المركز» (opens the main branch coordinates in the maps app via the shared `lib/maps-link.ts` `openInMaps`, also used by the branch page) when the main branch has coordinates.

Checks: mobile typecheck clean; full mobile jest 241/241 suites (new `AccountPreferences.test.tsx`, edit-email tests in `email-entry.test.tsx` and `email-entry-state.test.ts`).

Simulator (iPhone 18 Pro Max, local backend): login phone step without the guest button; guest account tab renders the welcome card, preferences, centre phone and about; «الدخول أو إنشاء حساب» opens the phone step; language switch flips Arabic → English → Arabic. Simulator also showed the Explore directory (chips, grouped results, branches list), the branch page (hours), the guest package flow details → confirm (2 steps) → login screen, the guest group flow details → confirm (step 2 of 2, summary rows, sign-in CTA), the branch page «فتح في الخرائط» handing off to Apple Maps, the home packages/groups sliders, the guest appointments tab, the public group detail (rows and sign-in card) and the public package detail; and the email step's 503 case: inline «تعذّر إرسال الرمز…» + «يمكنك إعادة الإرسال بعد 60 ث» under the button, no popup.

Not exercised live: the post-login return to packages/groups confirm and the client purchase/enrol buttons (no usable local test credentials this session; covered by `flow-steps.test.tsx`, `groups-confirm.test.tsx` and navigation tests), the call button, phone-entry error case, staff login screen, dark-mode switch from the guest tab, the call action, and the email code step with its pencil (the local backend has no email provider, so `email-entry/request` returns 503; covered by `app/__tests__/email-entry.test.tsx`).

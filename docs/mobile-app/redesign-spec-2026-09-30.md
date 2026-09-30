# Mobile redesign — implementation spec (2026-09-30)

Source of truth for the visuals: the design canvas published as the artifact `https://claude.ai/artifact/EeVoaUdC1TBFtXVKnRbAUk` (about 45 artboards, 390 px wide). Its static layout is the target; its colours, shadows and background are **translated to the current app tokens** as below. Owner decision: follow `develop`'s quiet canvas and solid cards (glass only for the bottom navigation), not the canvas's photo background or translucent cards.

## Non-negotiables (from CLAUDE.md files)
- Fixed Sawa brand. No configurable theming, no new hex colours in components (use `useSawaaColors()` / `getSawaaRoles()` / tokens), no `organization*`/`tenant*` concepts.
- Icons come from **Lucide only** (`lucide-react-native`). No emoji, no other icon set.
- Client-facing copy says «موعد», not «حجز». Plain, unexaggerated Arabic. Do not display VAT. Money is integer halalas.
- New strings go in `i18n/ar.json` and `i18n/en.json` (no hard-coded strings in new code). RTL through `useDir()` (`row`, `textAlign`, `alignStart`).
- Do not invent data. If a design element has no field behind it (ratings, clinic hours, specialist count, prices that do not exist), omit it and say so in the report. Placeholder text in brackets in the canvas (`[اسم الأخصائي]`) means "real field goes here".
- Clinic/service screens follow `docs/architecture/clinic-service-booking-contract.md` (keep `includeDirectClinics`, preserve `clinicId`/`serviceId`).
- Do not change API calls, hooks' data contracts, routes, auth, payments or booking logic. This is a presentation pass: layout, components, copy, styles.
- Keep files under 350 lines; screens stay in `app/`, reusable pieces in `components/`.
- Accessibility: touch targets >= 44, real roles/labels on icon-only buttons, text contrast per `theme/sawaa/__tests__/contrast.test.ts`.

## Token translation
| Canvas value | Use |
|---|---|
| `#066962` | `colors.teal[700]` (accent text/icons); CTA fill is the `action` role (PrimaryButton) |
| `#098a7d` / `#14a89a` | `colors.teal[600]` / `colors.teal[500]` |
| `#9ae0d6` / `#c5f0ea` / `#e6fbf8` | `colors.teal[200]` / `[100]` / `[50]` |
| `#0a2a2a` / `#2e4747` / `#5c7878` | `colors.ink[900]` / `[700]` / `[500]` |
| `#ef7a6b` / `#e8a84a` | `colors.accent.coral` / `.amber` |
| white cards | `Glass` default (solid `surface`), radius `sawaaRadius.lg` (20); hero cards `xl` (24) |
| page background | `AquaBackground` (quiet canvas) |
| bottom bar | native tabs (already in `app/(client)/(tabs)`, `(employee)/(tabs)`, `(guest)`) |

Type: root (tab) screen title 28/38 bold; pushed-screen header title ~20 bold centred; section heading 18/24 bold; card title 16 bold; body 15; secondary 14; meta 13; never below 12. Spacing: screen padding 16, gap between sections 20, inside a section 12, card padding 16. Primary button 56 high capsule (`PrimaryButton`), secondary = outlined capsule.

## Shared primitives (already in this branch, use them)
`components/ui/`: `ScreenHeader` (back + centred title), `SectionHeader` (title + optional action), `Chip`, `Pill`, `Thumb` (photo or tinted placeholder), `InfoRows` (icon/label/value card), `FloatingCta` (bottom fade + buttons), plus existing `BackButton`, `EmptyState`, `Skeleton`, `StatusPill`, `GlassSegmented`. `PrimaryButton` is now 56 high, 17 pt label. If a screen needs a new shared piece, add a **new** file; do not reshape the primitives.

## Screen groups
Reference PNGs of every artboard: see the path given in your task (rendered from the canvas HTML; holes such as `{{t.label}}` in interactive boards are an artifact of the static render).

1. **Home and discovery**: canvas `After` (client home), `Guest` (guest home), `DarkHome`; existing `app/(client)/(tabs)/home.tsx`, `app/(guest)/home.tsx`, `components/features/home/*`, `explore`.
2. **Lists and profiles**: `Therapists`, `TherapistProfile`, `Clinics`, `ClinicProfile`, `Packages`; `app/(client)/therapists.tsx`, `clinics.tsx`, `employee/[id].tsx`, `clinic/[id].tsx`, `packages/*`, `public-list`, `public-detail`, `public-clinic`.
3. **Booking and sessions**: `Schedule`, `Confirm`, `Success`, `Failure`, `Appointments`, `AppointmentDetails`, `Rate`, `VideoWait`, `VideoReady`, `Groups`, `GroupDetail`; `app/(client)/booking/*`, `appointment/*`, `rate/*`, `groups/*`, `video-call`.
4. **Auth and account**: `Login`, `Register`, `Otp`, `Suspended`, `Account`, `Settings`, `Profile`, `DeleteAccount`, `Notifications`, `NotificationsEmpty`; `app/(auth)/*`, `(client)/(tabs)/account.tsx`, `settings*.tsx`, `notifications.tsx`, `components/features/settings/*`.
5. **Employee**: `Today`, `EmpCalendar`, `Clients`, `EmpAccount`, `EmpAppointment`, `ClientRecord`, `Availability`; `app/(employee)/**`.
6. **States**: `Loading`, `Error`, `Offline`, `NoResults`; shared `EmptyState` / `Skeleton` usage across the screens above.

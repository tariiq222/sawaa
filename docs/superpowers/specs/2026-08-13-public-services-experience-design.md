# Public Services Experience Design

## Goal

Replace the customer-facing clinics discovery experience with the real, bookable services in the public catalog. Categories remain internal organization/filtering metadata, while customers discover a service first and then enter booking with that service preselected.

## Customer journey

```text
Home services section
  -> /services
  -> /booking?serviceId=<service-id>
  -> therapist and slot selection
```

The legacy `/clinics` URL permanently redirects to `/services` so existing links do not break.

## Data contract

A service is customer-visible in these surfaces only when all of the following are true:

- It is returned by `GET /public/services` (active, not hidden, and not archived).
- Its category belongs to the public clinics department.
- At least one public employee has `isBookable === true` and includes the service ID in `serviceIds`.

Group programs and bundles stay on their dedicated surfaces and must not be duplicated in the individual-services experience.

Each service card uses the public catalog fields for localized name and description, image/icon, price, duration, and delivery types. `showPrice` and `showDuration` are authoritative. The card links directly to `/booking?serviceId=<service-id>`.

## Content

Arabic:

- Eyebrow: `خدماتنا`
- Heading: `خدمات متاحة للحجز`
- Supporting copy: `اختر الخدمة المناسبة لاحتياجك، وتعرّف على مدتها وتكلفتها، ثم أكمل الحجز مع أحد مختصينا.`
- Primary discovery action: `عرض جميع الخدمات`
- Card action: `ابدأ الحجز`

English:

- Eyebrow: `Our Services`
- Heading: `Services available to book`
- Supporting copy: `Choose the service that fits your needs, review its duration and price, then continue booking with one of our specialists.`
- Primary discovery action: `View all services`
- Card action: `Start booking`

## Visual direction

Inherit the existing Sawaa palette and typography without introducing a parallel design system:

- Deep navy `#071F2C`
- Dark green `#0E4B43`
- Turquoise `#55CCB0`
- Sandy gold `#D9BE8A`
- Warm ivory `#FBF6ED`

The signature element is a compact facts rail on every service card. It encodes useful service facts (duration, price, delivery, and practitioner availability) instead of decorative numbering. Cards retain the existing restrained radius, mint section surface, visible focus treatment, and horizontal home carousel. The full services page uses a responsive grid and category filters only when more than one used category exists.

## Routes and navigation

- Add `/services` with Arabic/English metadata and the full bookable-services grid.
- Permanently redirect `/clinics` to `/services`.
- Rename the navbar entry from clinics to services and point it to `/services`.
- Rename the footer column to services and list bookable services as links to their booking deep links.

## Empty and failure behavior

If the catalog or employees request fails, or no service satisfies the bookability contract, show a services-specific empty state with a contact action. Do not fall back to static clinic cards or expose a service that will dead-end in booking.

## Non-goals

- No database migration.
- No backend endpoint change.
- No OpenAPI regeneration.
- No changes to support groups, packages, mobile, or dashboard service administration.
- No deletion of clinic/category records in the database.


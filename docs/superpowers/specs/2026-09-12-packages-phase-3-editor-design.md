# Phase 3 — practitioner package editor design

Approved intent: the user said “ابدأ” after the four-part design in conversation: clear fixed/choose-at-booking items, package-level practitioner, explicit session pricing, four editor steps. This is a cross-interface change. The written spec records that approved design; no new approval gate is imposed.

## Design
Use the existing eligibility constraints, with a nullable ownerEmployeeId on the catalog package and owner inherited into new item constraints. Keep a general package option for shared/legacy packages. Additive migration only; legacy rows remain ownerless. A purchase already snapshots its item eligibility and monetary allocation, so changing a template affects subsequent purchases only.

The four editor steps are data/practitioner, eligible sessions, counts/prices, and review. Fixed rows select one concrete session; flexible rows state that the session is chosen at booking and need a fixed unit price. Advanced rules remain available for current inclusion/exclusion records. Preserve existing data, image upload behavior and errors. Review displays actual eligibility, total sessions, free extras, discounts and final price.

Unify the duplicated practitioner-service/duration/delivery validation between regular booking and package-credit booking. Credit spending still reserves a seat and costs zero at booking. Existing purchase snapshots and financial policies remain unchanged.

## Alternatives considered
A UI-only stepper would improve navigation but leave practitioner ownership implicit and target validation divergent. Replacing the eligibility model would cause needless migrations and risk prior purchases. The selected approach adds ownership metadata plus inherited constraints and reuses current accounting/matching.

## Acceptance
Create a practitioner package with both fixed and flexible rows, navigate back without loss, reject missing selections/prices on their step, save and reopen identically. Demonstrate another eligible service can consume the flexible row with the same owner; another practitioner/unsupported delivery/foreign duration is rejected without changing counters. Change template owner after a sale and prove sold credit constraints/net values remain unchanged. Existing general and exclusion packages survive a no-op edit. AR/EN, desktop/narrow layout and real HTTP/browser checks required.

## Global constraints
No production DB access. No expiry. No capacity reduction on partial refund. No payment gateway, auth/permissions, commission, client self-service or historical-data repair changes. Preserve unrelated work. Migrations additive and immutable. Regenerate OpenAPI and dashboard types. Only coordinator runs integrated validation and publishes to staging within standing authorization.

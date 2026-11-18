import type { components } from './generated/openapi'

type Schemas = components['schemas']

/** `GET /api/v1/public/branches` row (`PublicBranchListItemDto`). */
export type PublicBranch = Schemas['PublicBranchListItemDto']

/** `GET /api/v1/public/employees(/ {key})` user projection (`PublicEmployeeSyntheticUserDto`). */
export type PublicEmployeeSyntheticUser = Schemas['PublicEmployeeSyntheticUserDto']

/**
 * `GET /api/v1/public/employees` and `GET /api/v1/public/employees/{key}`
 * (`PublicEmployeeProfileDto`).
 *
 * Derived from the documented profile, with one deliberate deviation: the
 * snapshot documents the scalar display fields (`slug`, `nameAr`, `gender`,
 * `ratingAverage`, `minServicePrice`, …) as `Record<string, never> | null`
 * because the DTO decorators omit their `type`. The handler emits real
 * strings/numbers/enums, so those keys are re-typed locally below. The
 * `public-directory.test.ts` key-set guard still covers the shape.
 */
export type PublicEmployee = Omit<
  Schemas['PublicEmployeeProfileDto'],
  | 'slug'
  | 'nameAr'
  | 'nameEn'
  | 'title'
  | 'specialty'
  | 'specialtyAr'
  | 'publicBioAr'
  | 'publicBioEn'
  | 'publicImageUrl'
  | 'gender'
  | 'ratingAverage'
  | 'minServicePrice'
> & {
  /** Documented as untyped; the handler emits a string slug. */
  slug: string | null
  /** Documented as untyped; the handler emits an Arabic name. */
  nameAr: string | null
  /** Documented as untyped; the handler emits an English name. */
  nameEn: string | null
  /** Documented as untyped; the handler emits a job title. */
  title: string | null
  /** Documented as untyped; the handler emits a specialty. */
  specialty: string | null
  /** Documented as untyped; the handler emits an Arabic specialty. */
  specialtyAr: string | null
  /** Documented as untyped; the handler emits an Arabic bio. */
  publicBioAr: string | null
  /** Documented as untyped; the handler emits an English bio. */
  publicBioEn: string | null
  /** Documented as untyped; the handler emits an image URL. */
  publicImageUrl: string | null
  /** Documented as untyped; free string so fixtures may pass any value. */
  gender: string | null
  /** Documented as untyped; the handler emits an average rating. */
  ratingAverage: number | null
  /** Documented as untyped; the handler emits a minimum price. */
  minServicePrice: number | null
}

/** `ContactMessageResponseDto['status']` enum. */
export type ContactMessageStatus = Schemas['ContactMessageResponseDto']['status']

/**
 * `GET /api/v1/dashboard/comms/contact-messages` row, as documented by
 * `ContactMessageResponseDto` (full message entity).
 */
export type ContactMessage = Schemas['ContactMessageResponseDto']

/** Request body of `POST /api/v1/public/contact-messages` (`CreateContactMessageDto`). */
export type CreateContactMessagePayload = Schemas['CreateContactMessageDto']

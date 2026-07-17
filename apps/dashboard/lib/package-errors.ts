import { toast } from "sonner"
import { ApiError } from "@/lib/api"
import { showApiError } from "@/lib/mutation-helpers"

type Translate = (key: string) => string

const PACKAGE_ERROR_KEYS: Array<[RegExp, string]> = [
  [/Session package not found/i, "packages.errors.notFound"],
  [
    /Service not found|service(?:Id)? must be a UUID/i,
    "packages.errors.serviceNotFound",
  ],
  [/Employee not found/i, "packages.errors.practitionerNotFound"],
  [
    /Duration option not found or inactive/i,
    "packages.errors.durationNotFound",
  ],
  [
    /Duration option not found for this service/i,
    "packages.errors.durationNotForService",
  ],
  [
    /Employee does not provide this service/i,
    "packages.errors.employeeDoesNotProvideService",
  ],
  [/Invalid delivery type target/i, "packages.errors.invalidDeliveryTarget"],
  [
    /flexible package item requires a fixed unitPrice/i,
    "packages.errors.unitPriceRequired",
  ],
  [
    /PERCENTAGE discountValue must be between 0 and 100/i,
    "packages.errors.discountPercentageRange",
  ],
  [
    /FIXED discountValue must not exceed the item's payable amount/i,
    "packages.errors.discountFixedExceedsPayable",
  ],
  [
    /Each item must have at least one session|items must contain at least 1 elements/i,
    "packages.errors.minQuantity",
  ],
  [
    /needs at least one target|scopeNeedsTarget/i,
    "packages.errors.scopeNeedsTarget",
  ],
  [/DURATION can only be constrained/i, "packages.errors.durationNeedsService"],
]

function packageErrorKey(message: string): string | undefined {
  return PACKAGE_ERROR_KEYS.find(([pattern]) => pattern.test(message))?.[1]
}

/** Show package-specific 4xx validation in the active locale. */
export function showPackageApiError(
  err: unknown,
  opts: { fallback: string; t: Translate }
): void {
  if (err instanceof ApiError && err.status === 403) {
    toast.error(opts.t("common.noPermission"))
    return
  }
  if (
    err instanceof ApiError &&
    err.status >= 400 &&
    err.status < 500 &&
    err.status !== 401
  ) {
    const key = packageErrorKey(err.message)
    toast.error(key ? opts.t(key) : opts.t("packages.errors.apiValidation"))
    return
  }
  showApiError(err, opts)
}

export function packageErrorTranslationKey(
  message: string
): string | undefined {
  return packageErrorKey(message)
}

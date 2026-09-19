import type { GlobalDiscount } from '../types/session-package-v2'

export type GroupedSessionNetAllocation = {
  subtotal: number
  discountAmount: number
  amountPaid: number
  sessionNet: number[]
}

type DecimalFraction = { numerator: bigint; denominator: bigint }

const MAX_SAFE_INTEGER_BIGINT = BigInt(Number.MAX_SAFE_INTEGER)

function invalid(message: string): never {
  throw new RangeError(message)
}

/**
 * Convert a finite JavaScript number to the exact decimal represented by its
 * canonical string form. This avoids binary floating point multiplication
 * when flooring a percentage discount.
 */
function decimalFraction(value: number): DecimalFraction {
  const match = String(value).match(/^(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i)
  if (!match) {
    invalid('Percentage discount value must be a finite number from 0 to 100')
  }

  const whole = match[1]
  const fraction = match[2] ?? ''
  const exponent = match[3] ? Number(match[3]) : 0
  const digits = BigInt(`${whole}${fraction}`)
  const decimalPlaces = fraction.length - exponent

  if (decimalPlaces >= 0) {
    return {
      numerator: digits,
      denominator: 10n ** BigInt(decimalPlaces),
    }
  }

  return {
    numerator: digits * 10n ** BigInt(-decimalPlaces),
    denominator: 1n,
  }
}

function validateDiscount(discount: GlobalDiscount, subtotal: bigint): bigint {
  if (discount == null || typeof discount !== 'object') {
    invalid('Discount must be an object with type and value')
  }

  const candidate = discount as { type?: unknown; value?: unknown }
  if (candidate.type === 'NONE') {
    if (candidate.value !== 0) {
      invalid('NONE discount value must be 0')
    }
    return 0n
  }

  if (candidate.type === 'PERCENTAGE') {
    if (
      typeof candidate.value !== 'number' ||
      !Number.isFinite(candidate.value) ||
      candidate.value < 0 ||
      candidate.value > 100
    ) {
      invalid('Percentage discount value must be a finite number from 0 to 100')
    }

    const percentage = decimalFraction(candidate.value)
    return (subtotal * percentage.numerator) / (percentage.denominator * 100n)
  }

  if (candidate.type === 'FIXED') {
    if (
      typeof candidate.value !== 'number' ||
      !Number.isSafeInteger(candidate.value) ||
      candidate.value < 0
    ) {
      invalid('Fixed discount value must be a non-negative safe integer')
    }
    const discountAmount = BigInt(candidate.value)
    if (discountAmount > subtotal) {
      invalid('Fixed discount cannot exceed the session price subtotal')
    }
    return discountAmount
  }

  invalid('Discount type must be NONE, PERCENTAGE, or FIXED')
}

/**
 * Compute grouped package totals and freeze proportional per-session values.
 * Prices and all returned amounts are integer halalas.
 */
export function calculateGroupedSessionNet(
  prices: number[],
  discount: GlobalDiscount,
): GroupedSessionNetAllocation {
  if (!Array.isArray(prices) || prices.length === 0) {
    invalid('Prices must be a non-empty array')
  }

  let subtotalBigInt = 0n
  for (const [index, price] of prices.entries()) {
    if (!Number.isSafeInteger(price) || price < 0) {
      invalid(`Price at index ${index} must be a non-negative safe integer`)
    }
    subtotalBigInt += BigInt(price)
    if (subtotalBigInt > MAX_SAFE_INTEGER_BIGINT) {
      invalid('Session price subtotal must be a safe integer')
    }
  }

  const discountBigInt = validateDiscount(discount, subtotalBigInt)
  const amountPaidBigInt = subtotalBigInt - discountBigInt
  const sessionNetBigInts = prices.map(() => 0n)

  if (amountPaidBigInt > 0n) {
    const portions = prices.map((price, index) => {
      const priceBigInt = BigInt(price)
      const numerator = amountPaidBigInt * priceBigInt
      return {
        index,
        price: priceBigInt,
        quotient: numerator / subtotalBigInt,
        remainder: numerator % subtotalBigInt,
      }
    })

    let allocated = 0n
    for (const portion of portions) {
      sessionNetBigInts[portion.index] = portion.quotient
      allocated += portion.quotient
    }

    // Largest remainder with stable index ordering. Excluding zero-price
    // sessions keeps them at zero even when remainders tie.
    const remaining = Number(amountPaidBigInt - allocated)
    const remainderOrder = portions
      .filter((portion) => portion.price > 0n)
      .sort((left, right) => {
        if (left.remainder === right.remainder) return left.index - right.index
        return left.remainder > right.remainder ? -1 : 1
      })

    for (let index = 0; index < remaining; index += 1) {
      sessionNetBigInts[remainderOrder[index].index] += 1n
    }
  }

  return {
    subtotal: Number(subtotalBigInt),
    discountAmount: Number(discountBigInt),
    amountPaid: Number(amountPaidBigInt),
    sessionNet: sessionNetBigInts.map(Number),
  }
}

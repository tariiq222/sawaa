/**
 * payment-method-picker.spec.tsx
 *
 * Unit spec for the shared manual payment-method helpers and picker
 * (`apps/dashboard/components/features/shared/payment-method-picker.tsx`).
 *
 * Closes the P2 finding from the W2 review: the canonical option list,
 * the enabled-methods/active-method resolvers, and the rendered radiogroup
 * were only covered indirectly via `record-payment-dialog.spec.tsx`. This
 * file pins the live financial-surface fallback semantics so future waves
 * can build on a stable contract.
 *
 * Conventions borrowed from `record-payment-dialog.spec.tsx`:
 *   - `vi.mock('@/components/locale-provider', ...)` returning `{ t: key => key }`
 *     so each consumer's namespace is asserted by inspecting the raw key.
 *   - RTL queries via `screen.getByRole('radiogroup' | 'radio', { name })`
 *     and `screen.queryByRole(...)` for absent-method assertions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import type { PaymentSettings } from '@/lib/api/organization-settings'

vi.mock('@/components/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}))

import {
  PAYMENT_METHODS,
  PaymentMethodPicker,
  resolveActiveMethod,
  resolveEnabledMethods,
  type PayMethod,
} from '@/components/features/shared/payment-method-picker'

/* ─── Fixtures ─────────────────────────────────────────────────────────── */

const allOn: PaymentSettings = {
  paymentMoyasarEnabled: true,
  paymentAtClinicEnabled: true,
  payMethodCashEnabled: true,
  payMethodBankEnabled: true,
  payMethodMadaEnabled: true,
  payMethodTabbyEnabled: true,
}

const allOff: PaymentSettings = {
  paymentMoyasarEnabled: false,
  paymentAtClinicEnabled: false,
  payMethodCashEnabled: false,
  payMethodBankEnabled: false,
  payMethodMadaEnabled: false,
  payMethodTabbyEnabled: false,
}

const LABEL_KEYS: Record<PayMethod, string> = {
  CASH: 'ns.cash',
  BANK_TRANSFER: 'ns.bank',
  MADA: 'ns.mada',
  TABBY: 'ns.tabby',
}

const sharedOnChange = vi.fn()

interface RenderOverrides {
  ariaLabel?: string
  className?: string
  labelKeys?: Record<PayMethod, string>
  onChange?: (m: PayMethod) => void
}

function renderPicker(
  paymentSettings: PaymentSettings | undefined,
  method: PayMethod = 'CASH',
  overrides: RenderOverrides = {},
) {
  return render(
    <PaymentMethodPicker
      paymentSettings={paymentSettings}
      method={method}
      onChange={overrides.onChange ?? sharedOnChange}
      labelKeys={overrides.labelKeys ?? LABEL_KEYS}
      ariaLabel={overrides.ariaLabel ?? 'test-radiogroup'}
      className={overrides.className}
    />,
  )
}

/* ─── PAYMENT_METHODS (canonical option list) ─────────────────────────── */

describe('PAYMENT_METHODS', () => {
  it('contains exactly the four reception methods in canonical order', () => {
    expect(PAYMENT_METHODS.map((m) => m.value)).toEqual([
      'CASH',
      'BANK_TRANSFER',
      'MADA',
      'TABBY',
    ])
  })

  it('maps each method to its correct PaymentSettings boolean key', () => {
    const expectedSettingKey = {
      CASH: 'payMethodCashEnabled',
      BANK_TRANSFER: 'payMethodBankEnabled',
      MADA: 'payMethodMadaEnabled',
      TABBY: 'payMethodTabbyEnabled',
    }
    for (const option of PAYMENT_METHODS) {
      expect(option.settingKey).toBe(expectedSettingKey[option.value])
    }
  })

  it('does not include ONLINE_CARD or COUPON', () => {
    const values = PAYMENT_METHODS.map((m) => m.value)
    expect(values).not.toContain('ONLINE_CARD')
    expect(values).not.toContain('COUPON')
  })
})

/* ─── resolveEnabledMethods ────────────────────────────────────────────── */

describe('resolveEnabledMethods', () => {
  it('returns CASH only when settings is undefined (loading-state fallback)', () => {
    expect(resolveEnabledMethods(undefined).map((m) => m.value)).toEqual(['CASH'])
  })

  it('returns CASH only when every flag is false (never-actionless fallback)', () => {
    expect(resolveEnabledMethods(allOff).map((m) => m.value)).toEqual(['CASH'])
  })

  it('returns only the enabled methods, in canonical order', () => {
    const subset: PaymentSettings = {
      ...allOn,
      payMethodCashEnabled: false,
      payMethodTabbyEnabled: false,
    }
    expect(resolveEnabledMethods(subset).map((m) => m.value)).toEqual([
      'BANK_TRANSFER',
      'MADA',
    ])
  })

  it('preserves canonical order even when only the last method is enabled', () => {
    const only: PaymentSettings = {
      ...allOff,
      payMethodTabbyEnabled: true,
    }
    expect(resolveEnabledMethods(only).map((m) => m.value)).toEqual(['TABBY'])
  })
})

/* ─── resolveActiveMethod ──────────────────────────────────────────────── */

describe('resolveActiveMethod', () => {
  it('returns the given method when it is enabled', () => {
    expect(resolveActiveMethod(allOn, 'MADA')).toBe('MADA')
    expect(resolveActiveMethod(allOn, 'BANK_TRANSFER')).toBe('BANK_TRANSFER')
  })

  it('falls back to the first enabled method when the given method is disabled — CASH off, BANK_TRANSFER on, passed CASH', () => {
    const settings: PaymentSettings = {
      ...allOff,
      payMethodCashEnabled: false,
      payMethodBankEnabled: true,
    }
    expect(resolveActiveMethod(settings, 'CASH')).toBe('BANK_TRANSFER')
  })

  it('returns CASH when settings is undefined, regardless of the passed method', () => {
    expect(resolveActiveMethod(undefined, 'MADA')).toBe('CASH')
    expect(resolveActiveMethod(undefined, 'BANK_TRANSFER')).toBe('CASH')
    expect(resolveActiveMethod(undefined, 'TABBY')).toBe('CASH')
  })

  it('returns CASH when every flag is false', () => {
    expect(resolveActiveMethod(allOff, 'MADA')).toBe('CASH')
  })
})

/* ─── PaymentMethodPicker component ────────────────────────────────────── */

describe('PaymentMethodPicker', () => {
  beforeEach(() => {
    sharedOnChange.mockClear()
  })

  it('renders a radiogroup with the supplied ariaLabel', () => {
    renderPicker(allOn, 'CASH', { ariaLabel: 'my-aria' })
    expect(screen.getByRole('radiogroup', { name: 'my-aria' })).toBeInTheDocument()
  })

  it('renders one radio per enabled method only — disabled methods are not in the DOM', () => {
    renderPicker(
      {
        ...allOn,
        payMethodBankEnabled: false,
        payMethodTabbyEnabled: false,
      },
      'CASH',
    )
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(2)
    expect(screen.getByRole('radio', { name: 'ns.cash' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'ns.mada' })).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: 'ns.bank' })).not.toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: 'ns.tabby' })).not.toBeInTheDocument()
  })

  it('marks exactly one radio as aria-checked', () => {
    renderPicker(allOn, 'MADA')
    const radios = screen.getAllByRole('radio')
    const checked = radios.filter((r) => r.getAttribute('aria-checked') === 'true')
    expect(checked).toHaveLength(1)
  })

  it('highlights the resolved active method — including the late-settings case (CASH off, BANK_TRANSFER on, passed CASH)', () => {
    const settings: PaymentSettings = {
      ...allOff,
      payMethodCashEnabled: false,
      payMethodBankEnabled: true,
    }
    renderPicker(settings, 'CASH')
    const checked = screen
      .getAllByRole('radio')
      .filter((r) => r.getAttribute('aria-checked') === 'true')
    expect(checked).toHaveLength(1)
    // Painted chip must match the resolved value — proves the chip cannot
    // diverge from what the container will POST.
    const resolved = resolveActiveMethod(settings, 'CASH')
    expect(resolved).toBe('BANK_TRANSFER')
    expect(checked[0]).toBe(screen.getByRole('radio', { name: LABEL_KEYS[resolved] }))
  })

  it('calls onChange exactly once with the clicked method value', () => {
    const onChange = vi.fn()
    renderPicker(allOn, 'CASH', { onChange })
    fireEvent.click(screen.getByRole('radio', { name: 'ns.bank' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('BANK_TRANSFER')
  })

  it('renders each radio label from the caller-supplied labelKeys map — each consumer owns its translation namespace', () => {
    const customKeys: Record<PayMethod, string> = {
      CASH: 'consumerA.cash',
      BANK_TRANSFER: 'consumerA.bank',
      MADA: 'consumerA.mada',
      TABBY: 'consumerA.tabby',
    }
    renderPicker(allOn, 'CASH', { labelKeys: customKeys })
    expect(screen.getByRole('radio', { name: 'consumerA.cash' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'consumerA.bank' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'consumerA.mada' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'consumerA.tabby' })).toBeInTheDocument()
    // Sanity: the shared default namespace must NOT be used when a custom
    // labelKeys map is supplied.
    expect(screen.queryByRole('radio', { name: 'ns.cash' })).not.toBeInTheDocument()
  })

  it('applies the default wrapper className when no className prop is given', () => {
    renderPicker(allOn, 'CASH')
    const group = screen.getByRole('radiogroup')
    expect(group.className).toContain('grid')
    expect(group.className).toContain('grid-cols-3')
    expect(group.className).toContain('gap-2')
  })

  it('merges an explicit className prop with the default wrapper className', () => {
    renderPicker(allOn, 'CASH', { className: 'extra-class' })
    const group = screen.getByRole('radiogroup')
    expect(group.className).toContain('grid')
    expect(group.className).toContain('grid-cols-3')
    expect(group.className).toContain('extra-class')
  })
})

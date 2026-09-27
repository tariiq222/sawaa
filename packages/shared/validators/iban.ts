/** Remove display spacing and normalize Saudi IBANs before validation/storage. */
export function normalizeSaudiIban(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase();
}

/** Saudi IBANs contain `SA` plus 22 digits and pass the ISO 13616 mod-97 check. */
export function isValidSaudiIban(value: string): boolean {
  const iban = normalizeSaudiIban(value);
  if (!/^SA\d{22}$/.test(iban)) return false;

  const rearranged = `${iban.slice(4)}${iban.slice(0, 4)}`;
  let remainder = 0;
  for (const character of rearranged) {
    const digits = character >= 'A' && character <= 'Z'
      ? String((character.codePointAt(0) ?? 0) - 55)
      : character;
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

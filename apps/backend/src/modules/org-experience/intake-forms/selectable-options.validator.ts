import { ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';
@ValidatorConstraint({ name: 'selectableOptions', async: false })
export class SelectableOptionsValidator implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const type = (args.object as { fieldType?: string }).fieldType;
    const selectable = ['RADIO', 'SELECT', 'CHECKBOX'].includes(type ?? '');
    if (value === undefined) return !selectable;
    if (!Array.isArray(value) || value.some(option => typeof option !== 'string')) return false;
    return !selectable || (value.length > 0 && value.every(option => option.trim().length > 0));
  }
  defaultMessage(): string { return 'Selectable fields require non-empty text options'; }
}

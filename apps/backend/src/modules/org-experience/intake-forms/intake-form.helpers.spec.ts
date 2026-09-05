import { fieldsSemanticallyEqual } from './intake-form.helpers';

describe('intake field semantic order', () => {
  const first = { labelAr: 'الأول', fieldType: 'TEXT', position: 10 };
  const second = { labelAr: 'الثاني', fieldType: 'TEXT', position: 20 };

  it('compares display order independently of array order and gaps in positions', () => {
    expect(fieldsSemanticallyEqual([first, second], [
      { ...second, position: 1 }, { ...first, position: 0 },
    ])).toBe(true);
  });

  it('detects a real reorder so answered fields stay protected', () => {
    expect(fieldsSemanticallyEqual([first, second], [
      { ...second, position: 0 }, { ...first, position: 1 },
    ])).toBe(false);
  });
});

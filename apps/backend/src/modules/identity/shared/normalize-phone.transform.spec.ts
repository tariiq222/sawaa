import { NormalizePhone, NormalizePhoneOrEmail } from './normalize-phone.transform';

describe('NormalizePhone', () => {
  it('should be defined', () => {
    expect(NormalizePhone).toBeDefined();
    expect(typeof NormalizePhone()).toBe('function');
  });

  it('should use default region', () => {
    expect(typeof NormalizePhone()).toBe('function');
  });
});

describe('NormalizePhoneOrEmail', () => {
  it('should be defined', () => {
    expect(NormalizePhoneOrEmail).toBeDefined();
    expect(typeof NormalizePhoneOrEmail()).toBe('function');
  });
});

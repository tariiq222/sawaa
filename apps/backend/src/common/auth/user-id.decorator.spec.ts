import { UserId } from './user-id.decorator';


describe('UserId', () => {
  it('should be defined', () => {
    expect(UserId).toBeDefined();
    expect(typeof UserId).toBe('function');
  });
});

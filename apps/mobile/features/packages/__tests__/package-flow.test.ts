import { packageStepPath, resolveDefaultBranch } from '../package-flow';
import { groupStepPath } from '../../groups/group-flow';

describe('package and group step paths', () => {
  it('keeps signed-in clients inside the client group', () => {
    expect(packageStepPath('confirm', true)).toBe('/(client)/packages/confirm');
    expect(groupStepPath('confirm', true)).toBe('/(client)/groups/confirm');
  });

  it('sends guests to the public re-exports of the same screens', () => {
    expect(packageStepPath('confirm', false)).toBe('/public-packages/confirm');
    expect(groupStepPath('confirm', false)).toBe('/public-groups/confirm');
  });
});

describe('resolveDefaultBranch', () => {
  it('prefers the main branch, then the first one, and nothing while unloaded', () => {
    expect(resolveDefaultBranch([{ id: 'a', isMain: false }, { id: 'b', isMain: true }])?.id).toBe('b');
    expect(resolveDefaultBranch([{ id: 'a', isMain: false }, { id: 'c', isMain: false }])?.id).toBe('a');
    expect(resolveDefaultBranch([])).toBeUndefined();
    expect(resolveDefaultBranch(undefined)).toBeUndefined();
  });
});

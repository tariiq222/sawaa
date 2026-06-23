import { Test } from '@nestjs/testing';
import {
  PERMISSION_SUBJECTS,
  PERMISSION_ACTIONS,
} from '@sawaa/shared/constants/permissions-catalog';
import { ListPermissionsHandler } from './list-permissions.handler';

describe('ListPermissionsHandler', () => {
  let handler: ListPermissionsHandler;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ListPermissionsHandler],
    }).compile();
    handler = module.get(ListPermissionsHandler);
  });

  it('returns the cross-product of subjects × actions', async () => {
    const result = await handler.execute();
    expect(result.length).toBe(PERMISSION_SUBJECTS.length * PERMISSION_ACTIONS.length);
  });

  it('builds each id as "<SUBJECT>:<action>" (uppercase subject + lowercase action)', async () => {
    const result = await handler.execute();
    for (const item of result) {
      expect(item.id).toBe(`${item.module}:${item.action}`);
      // id must match the canonical "module:action" shape used by the
      // dashboard's canDo() helper.
      expect(item.id).toMatch(/^[A-Z][A-Za-z]+:(manage|create|read|update|delete)$/);
    }
  });

  it('emits every (subject, action) pair from the shared catalog', async () => {
    const result = await handler.execute();
    const ids = new Set(result.map((r) => r.id));
    for (const subject of PERMISSION_SUBJECTS) {
      for (const action of PERMISSION_ACTIONS) {
        expect(ids).toContain(`${subject}:${action}`);
      }
    }
  });

  it('attaches the canonical subject and action to each entry', async () => {
    const result = await handler.execute();
    const sample = result.find((r) => r.module === 'User' && r.action === 'read');
    expect(sample).toBeDefined();
    expect(sample).toEqual({ id: 'User:read', module: 'User', action: 'read' });
  });

  it('emits NO duplicate ids even when the catalog has duplicates (defensive)', async () => {
    const result = await handler.execute();
    const ids = result.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('contains at least one entry per PermissionAction (catalog sanity)', async () => {
    const result = await handler.execute();
    const actionsSeen = new Set(result.map((r) => r.action));
    for (const a of PERMISSION_ACTIONS) {
      expect(actionsSeen.has(a)).toBe(true);
    }
  });

  it('contains at least one entry per PermissionSubject (catalog sanity)', async () => {
    const result = await handler.execute();
    const subjectsSeen = new Set(result.map((r) => r.module));
    for (const s of PERMISSION_SUBJECTS) {
      expect(subjectsSeen.has(s)).toBe(true);
    }
  });
});

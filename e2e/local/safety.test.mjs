import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertIsolatedDatabase } from './safety.mjs';

test('only a dedicated loopback test database on the isolated port is writable', () => {
  assert.doesNotThrow(() => assertIsolatedDatabase('postgresql://e2e:secret@127.0.0.1:55761/sawaa_e2e_123'));
  assert.doesNotThrow(() => assertIsolatedDatabase('postgresql://e2e:secret@127.0.0.1:55771/sawaa_e2e_123'));
  for (const value of [
    'postgresql://e2e:secret@127.0.0.1:3453/sawaa_dev',
    'postgresql://e2e:secret@127.0.0.1:5432/sawaa_e2e_123',
    'postgresql://e2e:secret@staging.example.com:55771/sawaa_e2e_123',
    'postgresql://e2e:secret@staging.example.com:55761/sawaa_e2e_123',
    'postgresql://e2e:secret@127.0.0.1:55761/sawaa_dev',
    'postgresql://e2e:secret@127.0.0.1:55761/sawaa_e2e_prod',
    'postgresql://e2e:secret@127.0.0.1:55761/sawaa_e2e_123?host=remote.example.com',
    'file:./dev.db', '',
  ]) assert.throws(() => assertIsolatedDatabase(value), /isolated/);
});

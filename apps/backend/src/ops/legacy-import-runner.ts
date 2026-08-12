import { main } from './legacy-import-cli';

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'unknown import error';
  process.stderr.write(`legacy import failed: ${message}\n`);
  process.exitCode = 1;
});

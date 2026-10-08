import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { assertIsolatedDatabase } from './safety.mjs';

const [dir, bin, ...args] = process.argv.slice(2);
if (!dir || !bin) throw new Error('Usage: node e2e/local/with-env.mjs <run-directory> <command> [arguments]');
const runDir = resolve(dir);
const owner = JSON.parse(readFileSync(resolve(runDir, 'ownership.json'), 'utf8'));
if (owner.runDir !== runDir || !/^sawaa-e2e-\d+$/.test(owner.project)) throw new Error('Invalid local run ownership');
const env = JSON.parse(readFileSync(resolve(runDir, 'environment.json'), 'utf8'));
assertIsolatedDatabase(env.DATABASE_URL);
const child = spawn(bin, args, { env, stdio: 'inherit' });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
process.once('SIGINT', () => child.kill('SIGINT'));
process.once('SIGTERM', () => child.kill('SIGTERM'));

#!/usr/bin/env node
'use strict';

const { spawn } = require('node:child_process');
const { constants } = require('node:os');

// Resolve the CLI beside the caller's test dependency, not the hoisted
// `playwright` binary, which may belong to the separate agentic harness.
const cwd = process.cwd();
let cli;
try {
  cli = require.resolve('@playwright/test/cli', { paths: [cwd] });
} catch (error) {
  console.error(`Cannot resolve @playwright/test from ${cwd}: ${error.message}`);
  process.exit(1);
}

const child = spawn(process.execPath, [cli, ...process.argv.slice(2)], {
  cwd,
  env: process.env,
  stdio: 'inherit',
});

const signalHandlers = new Map();
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  const handler = () => {
    if (child.exitCode === null && child.signalCode === null) child.kill(signal);
  };
  signalHandlers.set(signal, handler);
  process.on(signal, handler);
}

function cleanup() {
  for (const [signal, handler] of signalHandlers) process.removeListener(signal, handler);
}

child.once('error', (error) => {
  cleanup();
  console.error(`Cannot start @playwright/test: ${error.message}`);
  process.exitCode = 1;
});

child.once('exit', (code, signal) => {
  cleanup();
  if (signal) {
    // Restore the same signal termination for the invoking package manager.
    process.exitCode = 128 + (constants.signals[signal] || 1);
    process.kill(process.pid, signal);
  } else {
    process.exitCode = code ?? 1;
  }
});

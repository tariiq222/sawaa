#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const keyFile = process.env.JEV_API_KEY_FILE || path.join(os.homedir(), '.config/jev-review/api-key');
const serverFile = process.env.JEV_REVIEW_SERVER || path.join(os.homedir(), 'code/jev-review/dist/server.js');

let apiKey = (process.env.JEV_API_KEY || '').trim();
if (!apiKey) {
  try {
    apiKey = fs.readFileSync(keyFile, 'utf8').trim();
  } catch {
    console.error('Jev: set JEV_API_KEY or provide the private ~/.config/jev-review/api-key file.');
    process.exit(1);
  }
}
if (!apiKey || !fs.existsSync(serverFile)) {
  console.error('Jev: API key or server bundle is missing. See the project jev-review skill.');
  process.exit(1);
}

const child = spawn(process.execPath, [serverFile], {
  env: { ...process.env, JEV_API_KEY: apiKey },
  stdio: 'inherit',
});

child.on('error', () => {
  console.error('Jev: could not start the MCP server.');
  process.exit(1);
});
child.on('exit', (code, signal) => {
  process.exit(code ?? (signal === 'SIGINT' ? 130 : signal === 'SIGTERM' ? 143 : 1));
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}

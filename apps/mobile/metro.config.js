// Metro config for the pnpm monorepo. apps/mobile is intentionally NOT a
// pnpm-workspace member, so Expo's automatic monorepo detection misses it and
// Metro cannot follow the @sawaa/shared symlink into ../../packages. Watch the
// repo root and resolve from both node_modules trees explicitly.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;

// Metro config for the pnpm monorepo. apps/mobile is intentionally NOT a
// pnpm-workspace member, so Expo's automatic monorepo detection misses it and
// Metro cannot follow the @sawaa/shared symlink into ../../packages. Watch the
// repo root and resolve from both node_modules trees explicitly.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Git worktrees without their own install can point at another checkout's
// mobile node_modules (e.g. MOBILE_NODE_MODULES=/path/to/sawaa/apps/mobile/node_modules).
// Metro only resolves inside watched folders, so the real path must be watched too.
const externalNodeModules = process.env.MOBILE_NODE_MODULES
  ? [path.resolve(process.env.MOBILE_NODE_MODULES)]
  : [];

config.watchFolders = [workspaceRoot, ...externalNodeModules];
// Always resolve the shared package from THIS checkout, never from a linked
// node_modules of another checkout.
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  '@sawaa/shared': path.resolve(workspaceRoot, 'packages/shared'),
};
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  ...externalNodeModules,
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;

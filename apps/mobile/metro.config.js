const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// --- Monorepo (pnpm) resolution -------------------------------------------
// Watch the workspace root and resolve from both the app's and the root's
// node_modules so workspace packages (@getsava/*) and hoisted deps resolve.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// --- Privy + stellar-sdk "exports" collision shim -------------------------
// Several packages pulled in by @privy-io/expo ship separate Node.js and
// browser builds. In the React Native runtime Metro must use the browser
// builds (the Node builds import native `crypto`/`util` that don't exist).
// When a package is imported from an .mjs file Metro inserts the "import"
// export condition before the user-configured ones, so the Node ESM build
// wins. These overrides bypass the exports field for the affected packages
// and point straight at their browser entry points.
const browserOverrides = {
  // uuid: wrapper.mjs (node.import) returns undefined via CJS interop; the CJS
  // dist/index.js works everywhere.
  uuid: (pkgDir) => path.join(pkgDir, 'dist/index.js'),
  // jose: dist/node/esm imports Node `crypto`; the browser build uses WebCrypto.
  jose: (pkgDir) => path.join(pkgDir, 'dist/browser/index.js'),
};

// Node built-ins with no React Native equivalent — provide empty shims.
const nodeBuiltinShims = ['url', 'http', 'https', 'os', 'path', 'fs', 'net', 'tls', 'zlib'];
const emptyModule = require.resolve('./empty-module.js');
// `util` needs a real (tiny) polyfill: eventsource uses util.inherits.
const utilShim = require.resolve('./util-shim.js');

// Packages we deliberately exclude from the bundle. `eventsource` is the Horizon
// Server-Sent-Events client (used only by `Horizon.Server.stream()`); Sava reads
// chain state via Soroban RPC + Horizon REST and never streams, so empty-shimming
// it avoids pulling Node-only `events`/`url` that it requires at module load.
const emptyPackages = new Set(['eventsource']);

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (emptyPackages.has(moduleName)) {
    return { filePath: emptyModule, type: 'sourceFile' };
  }
  const override = browserOverrides[moduleName];
  if (override) {
    try {
      const pkgJsonPath = require.resolve(`${moduleName}/package.json`, {
        paths: [path.dirname(context.originModulePath)],
      });
      return { filePath: override(path.dirname(pkgJsonPath)), type: 'sourceFile' };
    } catch {
      // fall through to default resolution if the package isn't found
    }
  }
  if (moduleName === 'util') {
    return { filePath: utilShim, type: 'sourceFile' };
  }
  if (nodeBuiltinShims.includes(moduleName)) {
    return { filePath: emptyModule, type: 'sourceFile' };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

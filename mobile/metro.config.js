const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo root
config.watchFolders = [workspaceRoot];

// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

const sharedRoot = path.resolve(workspaceRoot, "src/shared");
const coreRoot = path.resolve(workspaceRoot, "src/core");

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "@shared" || moduleName.startsWith("@shared/")) {
    const subpath = moduleName.slice("@shared".length).replace(/^\//, "");
    const mapped = subpath ? path.join(sharedRoot, subpath) : sharedRoot;
    return (defaultResolveRequest || context.resolveRequest)(
      context,
      mapped,
      platform
    );
  }

  if (moduleName === "@core" || moduleName.startsWith("@core/")) {
    const subpath = moduleName.slice("@core".length).replace(/^\//, "");
    const mapped = subpath ? path.join(coreRoot, subpath) : coreRoot;
    return (defaultResolveRequest || context.resolveRequest)(
      context,
      mapped,
      platform
    );
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;


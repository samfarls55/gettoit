const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);
const defaultResolveRequest = config.resolver.resolveRequest;
const wsStubPath = path.resolve(__dirname, "src/native/wsStub.js");

config.resolver.resolverMainFields = ["react-native", "browser", "module", "main"];
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  ws: wsStubPath,
};
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "ws") {
    return { type: "sourceFile", filePath: wsStubPath };
  }

  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

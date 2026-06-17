const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

module.exports = (() => {
  const config = getDefaultConfig(__dirname);

  const { transformer, resolver } = config;

  config.transformer = {
    ...transformer,
    babelTransformerPath: require.resolve("react-native-svg-transformer"),
  };
  
  config.resolver = {
    ...resolver,
    assetExts: resolver.assetExts.filter((ext) => ext !== "svg"),
    sourceExts: [...resolver.sourceExts, "svg"],
    // Properly resolve socket.io-client for React Native
    extraNodeModules: {
      "socket.io-client": path.resolve(__dirname, "node_modules/socket.io-client/dist/socket.io.cjs"),
    },
    // Block ESM-only modules and non-mobile directories from being resolved
    blockList: [
      /.*\/node_modules\/(socket\.io-client\/build\/esm|.*\.mjs).*$/,
      /backend\/.*/,
      /rag-model\/.*/,
      /dist\/.*/,
      /Depression-Cure-\/.*/,
    ],
  };

  return config;
})();

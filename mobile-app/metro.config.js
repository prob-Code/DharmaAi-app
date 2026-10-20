const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

/**
 * Firebase JS SDK + Expo (package exports ON) ka known issue.
 *
 * `firebase` package ke exports map me "./auth" ke liye sirf node/browser/default
 * conditions hain — koi "react-native" condition nahi. Expo me package exports
 * default ON hai, isliye `import ... from 'firebase/auth'` BROWSER build par resolve
 * hota hai, jahan getReactNativePersistence hota hi nahi. Result: auth ki session
 * AsyncStorage me persist nahi hoti aur har restart par user logged out.
 *
 * Andar wala @firebase/auth package sahi RN build ship karta hai
 * ("react-native": "dist/rn/index.js"). Neeche hum Metro ko sirf isi ek module ke
 * liye wahan point kar dete hain — baaki koi resolution nahi badalti.
 *
 * Ye @firebase/auth top-level par hona chahiye (ek hi copy) — nested copy ho to
 * "Component auth has not been registered yet" error aata hai, kyunki auth
 * component us @firebase/app instance me register hi nahi hota jo initializeApp use karta hai.
 */
function findFirebaseAuthRN() {
  const candidates = [
    path.resolve(__dirname, "node_modules/@firebase/auth/dist/rn/index.js"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  console.warn("[metro] @firebase/auth RN build nahi mila — firebase/auth default resolution par chalega");
  return null;
}

const FIREBASE_AUTH_RN = findFirebaseAuthRN();

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
    sourceExts: [...resolver.sourceExts, "svg", "mjs", "cjs"],
    // Properly resolve socket.io-client for React Native
    extraNodeModules: {
      "socket.io-client": path.resolve(__dirname, "node_modules/socket.io-client/dist/socket.io.cjs"),
    },
    // Block ESM-only modules and non-mobile directories from being resolved
    blockList: [
      /.*\/node_modules\/socket\.io-client\/build\/esm.*$/,
      new RegExp('^' + path.resolve(__dirname, 'backend').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([/\\\\].*)?$'),
      new RegExp('^' + path.resolve(__dirname, 'rag-model').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([/\\\\].*)?$'),
      new RegExp('^' + path.resolve(__dirname, 'dist').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([/\\\\].*)?$'),
      new RegExp('^' + path.resolve(__dirname, 'Depression-Cure-').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([/\\\\].*)?$'),
    ],
  };

  // Sirf firebase/auth ko RN build par redirect karo. Baaki sab waisa hi.
  const defaultResolveRequest = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (FIREBASE_AUTH_RN && moduleName === "firebase/auth" && platform !== "web") {
      return { type: "sourceFile", filePath: FIREBASE_AUTH_RN };
    }
    return (defaultResolveRequest || context.resolveRequest)(context, moduleName, platform);
  };

  return config;
})();

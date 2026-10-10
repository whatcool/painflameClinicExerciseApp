module.exports = {
  preset: '@react-native/jest-preset',
  // @noble/hashes ships ES modules only, so it must be transformed too.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@noble)/)',
  ],
};

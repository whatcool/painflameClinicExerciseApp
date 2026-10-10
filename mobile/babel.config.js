module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // Required by react-native-reanimated (used for drag-to-reorder). Must be last.
  plugins: ['react-native-worklets/plugin'],
};

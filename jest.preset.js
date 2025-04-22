const path = require('path');

const nxPreset = require('@nx/jest/preset').default;

module.exports = {
  ...nxPreset,
  setupFiles: [path.resolve(__dirname, './tools/scripts/jest-setup.js')],
  testTimeout: 10_000,
  watchman: false,
};

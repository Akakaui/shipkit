export default {
  testEnvironment: 'node',
  transform: {},
  moduleNameMapper: {},
  testMatch: ['**/__tests__/**/*.test.js'],
  coverageDirectory: './coverage',
  collectCoverage: true,
  collectCoverageFrom: ['lib/detect.js', 'lib/router.js', 'lib/pipeline.js', 'lib/quality.js', 'lib/install.js', 'lib/convert.js'],
  coverageReporters: ['text', 'lcov'],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};

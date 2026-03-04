module.exports = {
  testEnvironment: "node",
  testMatch: ["**/test/**/*.test.js"],
  collectCoverageFrom: [
    "src/**/*.js",
    "!src/**/*.test.js",
    "!src/**/node_modules/**",
  ],
  coverageDirectory: "coverage",
  verbose: true,
  testTimeout: 10000, // 10 seconds for integration tests
};

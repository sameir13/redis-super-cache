/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/*.test.ts"],
  testPathIgnorePatterns: ["/node_modules/", "integration.test.ts"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.test.json",
      },
    ],
  },
  collectCoverageFrom: [
    "*.ts",
    "!*.test.ts",
    "!integration.test.ts",
    "!index.ts",
    "!**/node_modules/**",
  ],
  coverageThreshold: {
    global: {
      branches: 72,
      functions: 85,
      lines: 88,
      statements: 87,
    },
  },
};

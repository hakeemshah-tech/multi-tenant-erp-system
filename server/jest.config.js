/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/__mocks__"],
  testMatch: ["**/*.spec.ts", "**/*.test.ts"],

  // Transpile without a full type-check. `npm run typecheck` owns type safety;
  // doing it again per test file made the suite take minutes rather than
  // seconds on a cold cache.
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { isolatedModules: true, diagnostics: false }],
  },

  // `forceExit` is deliberately NOT set.
  //
  // It was set, and it hid a real defect: a spec pointed a live ioredis client
  // at a closed port, the client retried on a backoff for the whole run, and
  // the suite stalled until CI cancelled the job at 15 minutes. forceExit only
  // applies once every test file has finished, so it could never have helped,
  // while the warning it prints made the leak look benign. External clients are
  // mocked instead, and the suite now exits on its own. If it ever stops doing
  // so, that is a leak worth fixing rather than forcing past.

  // A hung test fails in seconds instead of consuming the job's whole budget.
  testTimeout: 15000,

  moduleNameMapper: {
    // Mirrors the `@/*` -> `src/*` alias from tsconfig.json so tests resolve
    // imports the same way the application does.
    "^@/(.*)$": "<rootDir>/src/$1",

    // Redirect ioredis to a test double, for every suite, unconditionally.
    //
    // This was previously only a manual mock in __mocks__/, which Jest applies
    // automatically but has to *discover* through its haste map. That worked
    // locally and is exactly the kind of resolution that can behave differently
    // on another platform or runner; if the discovery had failed in CI, a real
    // client would have been constructed and its reconnect loop would hang the
    // run with no indication why. A moduleNameMapper entry is resolved
    // deterministically, so no suite can reach the real package by accident.
    "^ioredis$": "<rootDir>/__mocks__/ioredis.ts",
  },

  setupFiles: ["<rootDir>/src/tests/setup.ts"],
  clearMocks: true,
  restoreMocks: true,

  // These tests cover pure logic only. Anything requiring a live MongoDB or
  // Redis belongs in an integration suite run against the compose stack.
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
};

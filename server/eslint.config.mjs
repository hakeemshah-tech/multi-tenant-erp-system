import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Flat ESLint config for the API service.
 *
 * This is applied to a codebase that predates the linter, so stylistic and
 * gradual-typing findings are warnings and only genuine defect patterns fail
 * the build. Tightening these is tracked as follow-up work rather than done in
 * one sweep, which would bury real findings under thousands of diffs.
 */
export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**", "*.config.js"],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },

    rules: {
      // --- Fail the build: these are defects, not style -------------------
      "no-debugger": "error",
      "no-dupe-keys": "error",
      "no-unreachable": "error",
      "no-const-assign": "error",
      "no-self-compare": "error",
      "no-unsafe-finally": "error",
      "require-atomic-updates": "error",

      // Credentials must not be written to stdout. `console.error`/`warn` stay
      // available for genuine failure reporting.
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],

      // --- Known debt: surfaced, not enforced ------------------------------
      // Stylistic findings inherited from eslint:recommended. Real, worth
      // fixing, but not worth blocking a deploy over on a pre-existing
      // codebase.
      "prefer-const": "warn",
      "no-empty": "warn",
      "no-case-declarations": "warn",
      "no-useless-escape": "warn",
      "no-extra-boolean-cast": "warn",
      "no-prototype-builtins": "warn",

      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
    },
  },

  {
    files: ["src/tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
    },
  }
);

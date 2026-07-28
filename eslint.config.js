import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import importX from "eslint-plugin-import-x";
import globals from "globals";

export default tseslint.config(
  {
    ignores: ["dist/", "node_modules/", "**/*.js", "**/*.cjs", "**/*.mjs"],
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "import-x": importX,
    },
    extends: [...tseslint.configs.recommended],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "import-x/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./core/**/*",
              from: "./adapters/**/*",
              message: "core/ must not import from adapters/ (dependency direction violation)",
            },
          ],
        },
      ],
    },
  },
  eslintConfigPrettier,
);

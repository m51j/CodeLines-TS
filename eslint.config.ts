import tseslint from "typescript-eslint";
export default tseslint.config(
  {
    ignores: ["dist/**", "release/**", "node_modules/**", "tests/fixtures/**"],
  },
  ...tseslint.configs.recommended,
  { rules: { "@typescript-eslint/no-explicit-any": "error" } },
);

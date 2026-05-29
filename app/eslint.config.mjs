import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Catch unhandled async — would have caught the geo race condition.
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/no-misused-promises": [
        "warn",
        { checksVoidReturn: false },
      ],
    },
  },
  {
    // Effects here legitimately set state on input change (async resolution
    // hooks, debounced place search, mount/exit transitions) — their purpose.
    files: [
      "src/lib/useTileFileUrl.ts",
      "src/lib/useReverseGeocode.ts",
      "src/components/ScreenTransition.tsx",
      "src/components/WallpaperGenerator.tsx",
      "src/components/viewer/TileEditSheet.tsx",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    // React Three Fiber mutates three.js objects (camera.position, refs)
    // directly — that's the intended API, not an immutability violation.
    files: ["src/components/viewer/TileScene.tsx"],
    rules: {
      "react-hooks/immutability": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

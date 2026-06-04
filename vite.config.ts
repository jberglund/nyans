import { defineConfig } from "vite-plus";

export default defineConfig({
  base: "/nyans/",
  staged: {
    "*": "vp check --fix",
  },
  fmt: {},
  lint: { options: { typeAware: true, typeCheck: true } },
  test: {
    include: ["src/**/*.test.ts"],
  },
});

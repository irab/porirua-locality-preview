import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  use: {
    baseURL: process.env.BASE_URL || "http://127.0.0.1:5173",
  },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "python3 -m http.server 5173",
        port: 5173,
        reuseExistingServer: !process.env.CI,
      },
});

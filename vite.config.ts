import vinext from "vinext";
import { defineConfig } from "vite";

// Local development and builds do not require a Cloudflare account.
export default defineConfig(async () => {
  process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= "false";
  process.env.WRANGLER_SEND_METRICS ??= "false";
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  const { cloudflare } = await import("@cloudflare/vite-plugin");
  return {
    plugins: [
      vinext(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: {
          name: "rush-hour",
          main: "vinext/server/fetch-handler",
          compatibility_date: "2026-09-22",
          compatibility_flags: ["nodejs_compat"],
        },
      }),
    ],
  };
});

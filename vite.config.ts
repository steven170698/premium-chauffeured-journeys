// Standalone Vite config — replaces @lovable.dev/vite-tanstack-config so the
// build no longer depends on a Lovable package. This mirrors what that wrapper
// composed internally (plugin order matters):
//   tailwindcss → tsConfigPaths → tanstackStart → nitro (build only) → react
// Dropped from the wrapper: Lovable's dev error loggers, HMR gate, sandbox
// dev-server bridge and asset proxy (all Lovable-sandbox-only), and its
// Cloudflare default preset — deployment target now comes from NITRO_PRESET.
import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

export default defineConfig(({ mode, command }) => {
  // Inline VITE_* vars at build time (this is how VITE_PAYMENTS_CLIENT_TOKEN,
  // i.e. the Stripe publishable key, gets baked into the client bundle).
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const define: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    define[`import.meta.env.${key}`] = JSON.stringify(value);
  }

  return {
    define,
    resolve: {
      alias: { "@": `${process.cwd()}/src` },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
    },
    plugins: [
      tailwindcss(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        importProtection: {
          behavior: "error",
          client: { files: ["**/server/**"], specifiers: ["server-only"] },
        },
        // Build the SSR entry from src/server.ts (our error wrapper).
        server: { entry: "server" },
      }),
      // Nitro only participates in builds; the preset comes from NITRO_PRESET
      // (set to "vercel" in the Vercel project).
      ...(command === "build" ? [nitro()] : []),
      viteReact(),
    ],
  };
});

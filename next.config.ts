import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Only the explicitly configured app host may request development assets.
  allowedDevOrigins: process.env.APP_URL
    ? [new URL(process.env.APP_URL).hostname]
    : [],
  logging: {
    incomingRequests: {
      ignore: [
        /^\/(?:api\/(?:auth|integrations|invitations)|auth\/callback|sign-in|sign-up|forgot-password|reset-password|verify-email|email-verification|invitations)(?:[/?]|$)/,
      ],
    },
  },
  experimental: {
    agentFeedback: true,
    // Keep React's development data in the HTTP response. A tunnel can lose
    // its HMR WebSocket; hydration must not wait for that separate channel.
    reactDebugChannel: false,
  },
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return [
      "/sign-in",
      "/sign-up",
      "/forgot-password",
      "/reset-password",
      "/verify-email",
      "/email-verification",
      "/auth/:path*",
      "/dashboard/:path*",
      "/account/:path*",
      "/onboarding",
      "/workspaces/:path*",
      "/invitations/:path*",
      "/api/:path*",
    ].map((source) => ({
      source,
      headers: [
        {
          key: "Referrer-Policy",
          value: [
            "/sign-in",
            "/sign-up",
            "/forgot-password",
            "/reset-password",
            "/verify-email",
            "/email-verification",
          ].includes(source)
            ? "strict-origin"
            : "no-referrer",
        },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        {
          key: "Content-Security-Policy",
          value:
            "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'",
        },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=()",
        },
      ],
    }));
  },
  turbopack: {
    rules: {
      // Keep the Tailwind transform on its entrypoint; let Next handle CSS Modules.
      "globals.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // The same loader implements the Webpack loader API. Keep an optional build
  // path for environments that prohibit Turbopack's compiler IPC subprocess.
  webpack(config) {
    config.module.rules.push({ test: /[/\\]globals\.css$/, enforce: "pre", use: ["@tailwindcss/turbopack"] });
    return config;
  },
};

export default nextConfig;

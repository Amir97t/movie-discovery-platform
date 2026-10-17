import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    // Host and path are based on the owner-provided API documentation; the
    // live endpoint/image behavior still needs a browser verification pass.
    remotePatterns: [
      { protocol: "https", hostname: "moviesapi.codingfront.dev", pathname: "/images/**" },
    ],
  },
};

export default withNextIntl(nextConfig);

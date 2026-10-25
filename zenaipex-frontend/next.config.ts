import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // lucide-react 1.x has no exports map, which confuses Turbopack's ESM resolver.
  // transpilePackages forces Next.js to compile it through the CJS path instead.
  transpilePackages: ["lucide-react"],
};

export default nextConfig;

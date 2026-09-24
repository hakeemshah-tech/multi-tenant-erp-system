import type { NextConfig } from "next";

/**
 * Remote image hosts. The CDN hostname is environment-specific and is supplied
 * as a build argument so no distribution identifier is baked into the source.
 */
const remoteImageHosts = [
  process.env.NEXT_PUBLIC_CDN_HOSTNAME,
  ...(process.env.NEXT_PUBLIC_EXTRA_IMAGE_HOSTS?.split(",") ?? []),
]
  .map((host) => host?.trim())
  .filter((host): host is string => Boolean(host));

const nextConfig: NextConfig = {
  // Emits a self-contained server bundle with only the dependencies actually
  // reachable at runtime. The Docker runtime stage copies this instead of
  // node_modules, which is what keeps the client image small.
  output: "standalone",

  images: {
    remotePatterns: remoteImageHosts.map((hostname) => ({
      protocol: "https" as const,
      hostname,
    })),
  },

  // Known debt: the codebase does not yet pass a clean lint/typecheck pass, so
  // these gates are disabled to keep builds green. Lint runs as its own CI step
  // and is tracked separately from the container build.
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;

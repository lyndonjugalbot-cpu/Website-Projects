/** @type {import('next').NextConfig} */
const nextConfig = {
  // sharp ships native platform binaries — keep it out of the webpack
  // bundle and required as a real Node module at runtime instead, same
  // reasoning Next.js itself uses for sharp inside next/image.
  experimental: {
    serverComponentsExternalPackages: ["sharp"],
  },
};

export default nextConfig;

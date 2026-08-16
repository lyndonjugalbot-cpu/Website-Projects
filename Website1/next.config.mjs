/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3 is a native addon — it must run as a real Node require()
  // at runtime rather than be bundled by webpack, or its binding loader
  // breaks (see https://nextjs.org/docs/app/api-reference/next-config-js/serverComponentsExternalPackages).
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3"],
  },
};

export default nextConfig;

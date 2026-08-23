/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // `crm-core` is a workspace package of TypeScript sources, not a published
  // build, so Next has to compile it like the app's own files.
  transpilePackages: ["crm-core"],
}

export default nextConfig

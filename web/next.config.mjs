/** @type {import('next').NextConfig} */
const nextConfig = {
  // Output static-export-friendly build so Vercel can serve plain HTML.
  // Next.js still enforces strict mode through this output.
  reactStrictMode: true,
  // Future TB-15 (web fallback) will introduce dynamic routes; keep
  // this lean for the walking-skeleton placeholder.
};

export default nextConfig;

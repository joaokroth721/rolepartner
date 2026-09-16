import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

/** @type {import('next').NextConfig} */
const nextConfig = {};

// Makes the Cloudflare bindings/env of wrangler.jsonc reachable during `next dev`.
// Also required by the OpenNext build: it refuses to run without a next config file.
initOpenNextCloudflareForDev();

export default nextConfig;

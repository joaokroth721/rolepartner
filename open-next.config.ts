import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Defaults are enough here: "/" is prerendered and the API routes are dynamic,
// so there is no ISR cache to back with KV/R2/D1.
export default defineCloudflareConfig();

import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * OpenNext → Cloudflare Workers adapter config.
 *
 * Minimal setup: no R2 incremental cache override, so no R2 bucket is
 * required. This CRM is almost entirely dynamic (auth-gated, per-user
 * SSR + API routes), so there's little ISR output to cache. If heavy
 * `revalidate`/ISR usage is added later, wire up an incremental cache
 * here (see https://opennext.js.org/cloudflare/caching).
 */
export default defineCloudflareConfig();

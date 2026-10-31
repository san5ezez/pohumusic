/**
 * Unified API Configuration for PohuMusic Windows Desktop Client.
 * Single source of truth for Cloudflare Workers API endpoint.
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  'https://pohumusic-backend.4g-2551.workers.dev/api/v1';

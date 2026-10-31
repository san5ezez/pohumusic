/**
 * Unified API Configuration for PohuMusic Windows Desktop Client.
 * Single source of truth for Cloudflare Workers API endpoint.
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  'https://ais-dev-3ze7grpwzhpgtjzyhrq2t4-191765606642.asia-southeast1.run.app/api/v1';

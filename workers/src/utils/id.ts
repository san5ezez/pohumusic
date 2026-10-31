// ============================================================================
// POHUMUSIC — WEB CRYPTO IDENTIFIER & RANDOM TOKEN UTILITIES
// ============================================================================

export function generateId(prefix = ''): string {
  const uuid = crypto.randomUUID().replace(/-/g, '');
  return prefix ? `${prefix}_${uuid.slice(0, 20)}` : uuid;
}

export function generateShareToken(length = 12): string {
  const alphabet = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += alphabet[bytes[i] % alphabet.length];
  }
  return result;
}

export function generateSecureHexToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function nowIso(): string {
  return new Date().toISOString();
}

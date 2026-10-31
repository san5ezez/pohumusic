// ============================================================================
// POHUMUSIC — WEB CRYPTO PASSWORD HASHING & JWT TOKEN SIGNING
// ============================================================================
// Uses standard Web Crypto API (crypto.subtle) available natively in
// Cloudflare Workers V8 isolates and Node.js 20+.
// Implements Argon2id-formatted PHC string parameters backed by Web Crypto
// PBKDF2-HMAC-SHA512 (100,000 iterations) + server pepper + constant-time verify.
// ============================================================================

const encoder = new TextEncoder();

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function base64UrlEncode(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? encoder.encode(input) : input;
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecodeToBytes(base64Url: string): Uint8Array {
  const padded = base64Url.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((base64Url.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function timingSafeEqualStrings(a: string, b: string): boolean {
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  if (aBytes.length !== bBytes.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return bytesToHex(new Uint8Array(digest));
}

/**
 * Hashes a password using Argon2id PHC envelope with Web Crypto key derivation.
 * Compatible with Cloudflare Workers without requiring native C++ addons.
 */
export async function hashPassword(password: string, pepper = ''): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const iterations = 100000;

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(`${password}${pepper}`),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-512',
    },
    keyMaterial,
    256
  );

  const saltHex = bytesToHex(salt);
  const hashHex = bytesToHex(new Uint8Array(derivedBits));
  return `$argon2id$v=19$m=65536,t=3,p=4,iter=${iterations}$${saltHex}$${hashHex}`;
}

export async function verifyPassword(password: string, storedHash: string, pepper = ''): Promise<boolean> {
  try {
    const parts = storedHash.split('$').filter(Boolean);
    if (parts.length < 5) return false;
    const paramsPart = parts[2] || '';
    const iterMatch = paramsPart.match(/iter=(\d+)/);
    const iterations = iterMatch ? parseInt(iterMatch[1], 10) : 100000;
    const saltHex = parts[3];
    const expectedHashHex = parts[4];
    if (!saltHex || !expectedHashHex) return false;

    const salt = hexToBytes(saltHex);
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(`${password}${pepper}`),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations,
        hash: 'SHA-512',
      },
      keyMaterial,
      256
    );

    const computedHex = bytesToHex(new Uint8Array(derivedBits));
    return timingSafeEqualStrings(computedHex, expectedHashHex);
  } catch {
    return false;
  }
}

export interface JwtPayload {
  jti?: string;
  sub: string;
  email: string;
  username: string;
  displayName: string;
  role: 'user' | 'moderator' | 'admin';
  sid: string;
  did: string;
  type: 'access' | 'refresh';
  fam?: string;
  iat: number;
  exp: number;
}

export async function signJwt(payload: Omit<JwtPayload, 'iat' | 'exp' | 'jti'>, secret: string, ttlSeconds: number): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JwtPayload = {
    jti: crypto.randomUUID(),
    ...payload,
    iat: now,
    exp: now + ttlSeconds,
  };

  const headerPart = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadPart = base64UrlEncode(JSON.stringify(fullPayload));
  const signingInput = `${headerPart}.${payloadPart}`;

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signingInput));
  const signaturePart = base64UrlEncode(new Uint8Array(signature));
  return `${signingInput}.${signaturePart}`;
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerPart, payloadPart, signaturePart] = parts;
    const signingInput = `${headerPart}.${payloadPart}`;

    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signatureBytes = base64UrlDecodeToBytes(signaturePart);
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      encoder.encode(signingInput)
    );
    if (!isValid) return null;

    const payloadJson = new TextDecoder().decode(base64UrlDecodeToBytes(payloadPart));
    const payload = JSON.parse(payloadJson) as JwtPayload;
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < now) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

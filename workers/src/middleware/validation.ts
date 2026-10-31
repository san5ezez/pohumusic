// ============================================================================
// POHUMUSIC — INPUT VALIDATION & SANITIZATION UTILITIES
// ============================================================================

import { ApiError } from '../utils/errors';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_.-]{3,28}$/;

export function validateEmail(email: unknown): string {
  if (typeof email !== 'string') {
    throw new ApiError(400, 'INVALID_EMAIL', 'Email address is required and must be a string.');
  }
  const normalized = email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(normalized) || normalized.length > 160) {
    throw new ApiError(400, 'INVALID_EMAIL', 'Please provide a valid email address.');
  }
  return normalized;
}

export function validateUsername(username: unknown): string {
  if (typeof username !== 'string') {
    throw new ApiError(400, 'INVALID_USERNAME', 'Username is required and must be a string.');
  }
  const trimmed = username.trim();
  if (!USERNAME_REGEX.test(trimmed)) {
    throw new ApiError(
      400,
      'INVALID_USERNAME',
      'Username must be 3–28 characters and contain only letters, digits, underscores, dots, or hyphens.'
    );
  }
  return trimmed;
}

export function validatePassword(password: unknown): string {
  if (typeof password !== 'string') {
    throw new ApiError(400, 'INVALID_PASSWORD', 'Password is required.');
  }
  if (password.length < 8 || password.length > 128) {
    throw new ApiError(
      400,
      'WEAK_PASSWORD',
      'Password must be between 8 and 128 characters long.'
    );
  }
  return password;
}

export function sanitizeText(value: unknown, fieldName: string, maxLength = 200, allowEmpty = true): string {
  if (value === undefined || value === null) {
    if (allowEmpty) return '';
    throw new ApiError(400, 'MISSING_FIELD', `Field '${fieldName}' is required.`);
  }
  if (typeof value !== 'string') {
    throw new ApiError(400, 'INVALID_FIELD_TYPE', `Field '${fieldName}' must be a string.`);
  }
  const cleaned = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
  if (!allowEmpty && cleaned.length === 0) {
    throw new ApiError(400, 'EMPTY_FIELD', `Field '${fieldName}' cannot be empty.`);
  }
  if (cleaned.length > maxLength) {
    throw new ApiError(
      400,
      'FIELD_TOO_LONG',
      `Field '${fieldName}' cannot exceed ${maxLength} characters.`
    );
  }
  return cleaned;
}

export function parsePagination(query: Record<string, string | undefined>): {
  limit: number;
  offset: number;
} {
  const rawLimit = parseInt(query.limit || '20', 10);
  const rawOffset = parseInt(query.offset || '0', 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(50, Math.max(1, rawLimit)) : 20;
  const offset = Number.isFinite(rawOffset) ? Math.max(0, rawOffset) : 0;
  return { limit, offset };
}

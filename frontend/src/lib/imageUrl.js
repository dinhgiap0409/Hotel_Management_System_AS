import { API_BASE_URL } from '../config/constants';

// Backend origin, derived from the API base URL
// (http://localhost:8080/api/v1 -> http://localhost:8080).
const API_ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

/**
 * Resolves an image URL stored in the database for use in an <img src>.
 *
 * - Absolute URLs (Unsplash, https://...) and data:/blob: URLs pass through.
 * - Relative paths such as /uploads/room-types/xxx.jpg (returned by the
 *   image-upload endpoint) are prefixed with the backend origin, so photos
 *   display both in dev (Vite on :5173, backend on :8080) and when the
 *   frontend is deployed on a different origin than the backend.
 * - Empty/blank values resolve to '' — the caller picks its fallback image.
 */
export function resolveImageUrl(url) {
  if (!url || !String(url).trim()) return '';
  const value = String(url).trim();
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  if (value.startsWith('/')) return `${API_ORIGIN}${value}`;
  return value;
}

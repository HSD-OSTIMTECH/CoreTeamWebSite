/**
 * Security helper utilities for sanitizing inputs, links, and file uploads.
 */

/**
 * Sanitizes external URLs to prevent javascript:, data:, and other XSS vectors.
 * Only allows http: and https: protocols. Automatically prepends https:// if missing protocol.
 * @param {string} url
 * @returns {string|null} Safe URL or null if invalid/unsafe
 */
export const sanitizeUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (/^(javascript:|data:|vbscript:)/i.test(trimmed)) {
    return null;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  // If it looks like a domain name (e.g. google.com or github.com/user)
  if (/^[a-zA-Z0-9][a-zA-Z0-9-]{0,62}(\.[a-zA-Z0-9-]{1,62})+/i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return null;
};

/**
 * Validates file upload for maximum size and disallowed dangerous executable extensions.
 * @param {File} file
 * @param {number} [maxSizeMB=15]
 * @returns {{ valid: boolean, error?: string }}
 */
export const validateFileUpload = (file, maxSizeMB = 15) => {
  if (!file) return { valid: false, error: 'Dosya seçilmedi.' };

  const maxBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxBytes) {
    return { valid: false, error: `Dosya boyutu çok yüksek. Maksimum sınır: ${maxSizeMB}MB.` };
  }

  const blockedExtensions = ['exe', 'bat', 'cmd', 'sh', 'php', 'vbs', 'scr', 'msi', 'com', 'pif', 'html', 'htm'];
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (blockedExtensions.includes(ext)) {
    return { valid: false, error: 'Bu dosya türünün yüklenmesine güvenlik sebebiyle izin verilmiyor.' };
  }

  return { valid: true };
};

/**
 * Safely parses the payload of a JWT token without verifying the signature.
 * (Signature verification is strictly enforced server-side with JWT_SECRET).
 * @param {string} token
 * @returns {object|null}
 */
export const parseJwt = (token) => {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (err) {
    return null;
  }
};

/**
 * Checks whether the JWT token is expired based on its `exp` claim.
 * @param {string} token
 * @param {number} [bufferMs=0] - Optional buffer in ms (e.g. 5000ms for 5s early warning)
 * @returns {boolean}
 */
export const isTokenExpired = (token, bufferMs = 0) => {
  const payload = parseJwt(token);
  if (!payload || !payload.exp) return true;
  return Date.now() + bufferMs >= payload.exp * 1000;
};

/**
 * Returns remaining milliseconds until token expiration.
 * Returns 0 if already expired or invalid.
 * @param {string} token
 * @returns {number}
 */
export const getTokenRemainingMs = (token) => {
  const payload = parseJwt(token);
  if (!payload || !payload.exp) return 0;
  const remaining = payload.exp * 1000 - Date.now();
  return remaining > 0 ? remaining : 0;
};

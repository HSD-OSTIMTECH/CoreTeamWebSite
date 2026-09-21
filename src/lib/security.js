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

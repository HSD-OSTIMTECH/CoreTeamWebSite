/**
 * Central API Configuration & Request Utility
 * Automatically falls back to http://localhost:5000 if VITE_API_URL is not provided.
 */

export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

/**
 * Returns standard request headers, including JWT Authorization if present in localStorage.
 * @param {Object} [customHeaders={}]
 * @returns {Object}
 */
export const getAuthHeaders = (customHeaders = {}) => {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...customHeaders
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};

/**
 * Convenience wrapper for API fetch requests.
 * Prepends API_BASE_URL and attaches auth headers by default.
 * @param {string} endpoint - e.g. '/api/auth/users'
 * @param {RequestInit} [options={}]
 * @returns {Promise<Response>}
 */
export const apiFetch = (endpoint, options = {}) => {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  const headers = getAuthHeaders(options.headers || {});
  
  return fetch(url, {
    ...options,
    headers
  });
};

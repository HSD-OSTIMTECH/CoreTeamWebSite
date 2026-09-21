/**
 * Central API Configuration & Request Utility
 * Automatically falls back to http://localhost:5000 if VITE_API_URL is not provided.
 */

export const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

/**
 * Returns standard request headers, including JWT Authorization if present in localStorage.
 * @param {Object} [customHeaders={}]
 * @returns {Object}
 */
export const getAuthHeaders = (customHeaders = {}, isFormData = false) => {
  const token = localStorage.getItem('token');
  const headers = {
    ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
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
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = getAuthHeaders(options.headers || {}, isFormData);
  
  return fetch(url, {
    ...options,
    headers
  });
};


import { isTokenExpired } from './security';

/**
 * Central API Configuration & Request Utility
 * Automatically falls back to relative paths / current host if VITE_API_URL is not provided.
 */
export const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

let isDispatchingExpired = false;

/**
 * Purges local session tokens and announces session expiration across the application.
 * Debounced to prevent event floods when concurrent API requests fail simultaneously.
 * @param {string} [message]
 */
export const dispatchSessionExpired = (message = 'Oturum süreniz doldu. Lütfen tekrar giriş yapın.') => {
  const hadSession = !!localStorage.getItem('token') || !!localStorage.getItem('custom_user');
  
  localStorage.removeItem('token');
  localStorage.removeItem('custom_user');

  if (hadSession) {
    sessionStorage.setItem('session_expired_message', message);
    if (!isDispatchingExpired) {
      isDispatchingExpired = true;
      window.dispatchEvent(new CustomEvent('auth:session-expired', { detail: { message } }));
      setTimeout(() => {
        isDispatchingExpired = false;
      }, 1000);
    }
  }
};

/**
 * Returns standard request headers, including JWT Authorization if present in localStorage.
 * @param {Object} [customHeaders={}]
 * @param {boolean} [isFormData=false]
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
 * Prepends API_BASE_URL, attaches auth headers, verifies token validity beforehand,
 * and intercepts 401 Unauthorized responses to notify the user of session expiration.
 * @param {string} endpoint - e.g. '/api/auth/users'
 * @param {RequestInit} [options={}]
 * @returns {Promise<Response>}
 */
export const apiFetch = async (endpoint, options = {}) => {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const isLoginRequest = url.includes('/api/auth/login');
  const token = localStorage.getItem('token');

  // If token is locally known to be expired, intercept immediately without an unnecessary roundtrip
  if (token && isTokenExpired(token) && !isLoginRequest) {
    dispatchSessionExpired();
    return new Response(JSON.stringify({ error: 'Oturum süresi dolmuş veya geçersiz token. Lütfen tekrar giriş yapın.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const headers = getAuthHeaders(options.headers || {}, isFormData);
  
  const response = await fetch(url, {
    ...options,
    headers
  });

  // Intercept 401 Unauthorized errors from server (excluding standard login attempts)
  if (response.status === 401 && !isLoginRequest) {
    dispatchSessionExpired();
  }

  return response;
};

export const parseJsonResponse = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return await response.json();
  }
  const text = await response.text();
  throw new Error(
    !response.ok
      ? `Sunucu hatası (${response.status}): Vercel ayarlarını veya sunucu loglarını kontrol edin.`
      : 'Sunucudan beklenmeyen yanıt formatı alındı.'
  );
};

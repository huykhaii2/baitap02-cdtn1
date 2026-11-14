// NƠI DUY NHẤT trong giao diện gọi fetch() (slide buổi 10, TD-08).
// Các màn hình chỉ gọi hàm trong *.api.js; kiểm tra: grep -rn "fetch(" src/frontend/pages → rỗng.
const SESSION_KEY = 'smartcrm.session';

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || null;
  } catch (_) {
    return null;
  }
}

export function setSession(session) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export async function request(method, path, { body, query } = {}) {
  const url = new URL(`/api${path}`, window.location.origin);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  });
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const session = getSession();
  if (session && session.token) headers.Authorization = `Bearer ${session.token}`;

  let response;
  try {
    response = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (_) {
    throw new ApiError(0, 'NETWORK_ERROR', 'Không kết nối được máy chủ. Kiểm tra máy chủ đang chạy (npm start) rồi bấm Thử lại.');
  }
  if (response.status === 204) return null;

  let data = null;
  try {
    data = await response.json();
  } catch (_) {
    data = null;
  }
  if (!response.ok) {
    const err = (data && data.error) || {};
    if (response.status === 401 && path !== '/auth/login') {
      clearSession();
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }
    throw new ApiError(response.status, err.code || `HTTP_${response.status}`, err.message || `Máy chủ trả lỗi ${response.status}.`, err.details);
  }
  return data;
}

export const http = {
  get: (path, query) => request('GET', path, { query }),
  post: (path, body = {}) => request('POST', path, { body }),
  put: (path, body = {}) => request('PUT', path, { body }),
  del: (path) => request('DELETE', path),
};

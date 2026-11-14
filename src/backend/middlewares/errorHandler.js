// Bảng DUY NHẤT đổi loại lỗi nghiệp vụ (kind) → mã HTTP (TD-12). Lớp nghiệp vụ không biết mã HTTP.
const { AppError, KINDS } = require('../errors/AppError');

const KIND_TO_HTTP = Object.freeze({
  [KINDS.INVALID_INPUT]: 400,
  [KINDS.NOT_AUTHENTICATED]: 401,
  [KINDS.NOT_ALLOWED]: 403,
  [KINDS.NOT_FOUND]: 404,
  [KINDS.CONFLICT]: 409,
});

// Lỗi cho biết CSDL không kết nối được (PostgreSQL tắt, sai mật khẩu, sai host…) → 503 (TD-14).
const DB_UNAVAILABLE_CODES = new Set([
  'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'EAI_AGAIN', 'ECONNRESET', 'EHOSTUNREACH',
  '57P01', '57P02', '57P03', // admin_shutdown, crash_shutdown, cannot_connect_now
  '53300', // too_many_connections
  '28P01', '28000', '3D000', // sai mật khẩu, không có quyền, không có database
  '08000', '08001', '08003', '08004', '08006',
]);
const DB_UNAVAILABLE_MESSAGES = [/Connection terminated/i, /timeout exceeded when trying to connect/i, /Connection refused/i];

function isDbUnavailable(err) {
  if (!err) return false;
  if (DB_UNAVAILABLE_CODES.has(err.code)) return true;
  if (Array.isArray(err.errors) && err.errors.some(isDbUnavailable)) return true; // AggregateError (IPv4 + IPv6)
  return DB_UNAVAILABLE_MESSAGES.some((re) => re.test(String(err.message)));
}

function toHttp(err) {
  if (err instanceof AppError) {
    const body = { code: err.code, message: err.message };
    if (err.details !== undefined) body.details = err.details;
    return { status: KIND_TO_HTTP[err.kind] || 500, body };
  }
  if (err && err.type === 'entity.parse.failed') {
    return { status: 400, body: { code: 'INVALID_JSON', message: 'Dữ liệu gửi lên không phải JSON hợp lệ.' } };
  }
  if (err && err.type === 'entity.too.large') {
    return { status: 413, body: { code: 'PAYLOAD_TOO_LARGE', message: 'Dữ liệu gửi lên quá lớn.' } };
  }
  if (isDbUnavailable(err)) {
    return {
      status: 503,
      body: { code: 'DB_UNAVAILABLE', message: 'Không kết nối được cơ sở dữ liệu. Vui lòng thử lại sau ít phút.' },
    };
  }
  return { status: 500, body: { code: 'INTERNAL_ERROR', message: 'Có lỗi máy chủ. Vui lòng thử lại hoặc báo quản trị.' } };
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const { status, body } = toHttp(err);
  if (status === 503) console.warn(`[${req.method} ${req.originalUrl}] Mất kết nối CSDL: ${err.code || err.message}`);
  else if (status >= 500) console.error(`[${req.method} ${req.originalUrl}]`, err);
  res.status(status).json({ error: body });
}

function apiNotFound(req, res) {
  res.status(404).json({ error: { code: 'ROUTE_NOT_FOUND', message: `Không có API ${req.method} ${req.originalUrl}.` } });
}

module.exports = { errorHandler, apiNotFound, toHttp, isDbUnavailable, KIND_TO_HTTP };

// Kiểm tra và chuẩn hoá dữ liệu đầu vào ở lớp nghiệp vụ (không phụ thuộc HTTP).
const { invalidInput, notAllowed } = require('../errors/AppError');

// Chấp nhận "0901 234 567", "0901.234.567", "+84901234567" → "0901234567" (UC01-2a).
function normalizePhone(raw) {
  const digits = String(raw ?? '').replace(/[\s.\-()]/g, '');
  const local = digits.startsWith('+84') ? `0${digits.slice(3)}` : digits;
  if (!/^0[0-9]{9}$/.test(local)) {
    throw invalidInput('INVALID_PHONE', 'Số điện thoại không hợp lệ (10 chữ số, bắt đầu bằng 0).', { field: 'phone' });
  }
  return local;
}

// UC01-4a: IMEI gồm đúng 15 chữ số.
function normalizeImei(raw) {
  const value = String(raw ?? '').replace(/\s/g, '');
  if (!/^[0-9]{15}$/.test(value)) {
    throw invalidInput('INVALID_IMEI', 'IMEI phải gồm 15 chữ số.', { field: 'imei' });
  }
  return value;
}

function requireText(raw, { code, message, field, max }) {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) throw invalidInput(code, message, { field });
  if (max && value.length > max) {
    throw invalidInput(`${code.replace(/_REQUIRED$/, '')}_TOO_LONG`, `Tối đa ${max} ký tự.`, { field, max });
  }
  return value;
}

function parseDateOnly(raw, { code, message, field }) {
  const value = String(raw ?? '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = match ? new Date(Date.UTC(+match[1], +match[2] - 1, +match[3])) : null;
  if (!date || date.getUTCMonth() !== +match[2] - 1 || date.getUTCDate() !== +match[3]) {
    throw invalidInput(code, message, { field });
  }
  return value;
}

function parsePositiveInt(raw, { code, message, field }) {
  const n = typeof raw === 'number' ? raw : Number(String(raw ?? '').trim());
  if (!Number.isInteger(n) || n <= 0) throw invalidInput(code, message, { field });
  return n;
}

function parsePaging({ page, pageSize } = {}, { defaultSize = 20, maxSize = 100 } = {}) {
  const p = page === undefined || page === '' ? 1 : Number(page);
  const s = pageSize === undefined || pageSize === '' ? defaultSize : Number(pageSize);
  if (!Number.isInteger(p) || p < 1) throw invalidInput('INVALID_PAGE', 'Số trang phải là số nguyên ≥ 1.', { field: 'page' });
  if (!Number.isInteger(s) || s < 1 || s > maxSize) {
    throw invalidInput('INVALID_PAGE_SIZE', `Số dòng mỗi trang từ 1 đến ${maxSize}.`, { field: 'pageSize' });
  }
  return { page: p, pageSize: s, limit: s, offset: (p - 1) * s };
}

// NFR4: kiểm tra vai trò ngay ở lớp nghiệp vụ, không dựa vào việc ẩn nút trên giao diện.
function requireRole(actor, roles, action) {
  if (!actor || !roles.includes(actor.role)) {
    throw notAllowed('ROLE_NOT_ALLOWED', `Vai trò của bạn không được phép ${action}.`, { allowedRoles: roles });
  }
}

module.exports = { normalizePhone, normalizeImei, requireText, parseDateOnly, parsePositiveInt, parsePaging, requireRole };

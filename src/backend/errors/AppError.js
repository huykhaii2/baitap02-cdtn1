// Lỗi nghiệp vụ. KHÔNG mang mã HTTP (TD-12): lớp nghiệp vụ chỉ nói "loại lỗi" (kind),
// việc đổi kind → mã HTTP nằm duy nhất trong src/backend/middlewares/errorHandler.js.
const KINDS = Object.freeze({
  INVALID_INPUT: 'INVALID_INPUT',
  NOT_AUTHENTICATED: 'NOT_AUTHENTICATED',
  NOT_ALLOWED: 'NOT_ALLOWED',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
});

class AppError extends Error {
  constructor(kind, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.kind = kind;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

const invalidInput = (code, message, details) => new AppError(KINDS.INVALID_INPUT, code, message, details);
const notAuthenticated = (code, message, details) => new AppError(KINDS.NOT_AUTHENTICATED, code, message, details);
const notAllowed = (code, message, details) => new AppError(KINDS.NOT_ALLOWED, code, message, details);
const notFound = (code, message, details) => new AppError(KINDS.NOT_FOUND, code, message, details);
const conflict = (code, message, details) => new AppError(KINDS.CONFLICT, code, message, details);

module.exports = { AppError, KINDS, invalidInput, notAuthenticated, notAllowed, notFound, conflict };

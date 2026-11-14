// Bọc handler async để lỗi (kể cả Promise bị reject) đi tới errorHandler.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { asyncHandler };

// Mã lỗi PostgreSQL mà lớp truy cập dữ liệu đổi thành lỗi nghiệp vụ.
const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';

const isUnique = (err, constraint) =>
  err && err.code === UNIQUE_VIOLATION && (!constraint || err.constraint === constraint);
const isForeignKey = (err, constraint) =>
  err && err.code === FOREIGN_KEY_VIOLATION && (!constraint || err.constraint === constraint);

// Thoát ký tự đặc biệt của LIKE để từ khoá "50%" không thành mẫu tìm kiếm.
const escapeLike = (text) => text.replace(/[\\%_]/g, (ch) => `\\${ch}`);

module.exports = { isUnique, isForeignKey, escapeLike };

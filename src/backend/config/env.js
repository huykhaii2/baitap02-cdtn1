// Đọc cấu hình từ biến môi trường (.env khi chạy trực tiếp, environment khi chạy Docker).
// Chỉ kiểm tra khi thật sự cần (lazy) để unit test lớp nghiệp vụ chạy được mà không cần .env.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env'), quiet: true });

function missingError(names) {
  return new Error(
    `Thiếu biến môi trường ${names.join(', ')}. Sao chép .env.example thành .env rồi điền giá trị (README mục 3).`
  );
}

function getDbConfig() {
  const env = process.env;
  if (env.DATABASE_URL) {
    return {
      connectionString: env.DATABASE_URL,
      ssl: env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    };
  }
  const required = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  const missing = required.filter((name) => !env[name]);
  if (missing.length) throw missingError(missing);
  return {
    host: env.DB_HOST,
    port: Number(env.DB_PORT),
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    ssl: env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  };
}

function getAuthConfig() {
  const env = process.env;
  if (!env.SECRET_KEY) throw missingError(['SECRET_KEY']);
  return { secretKey: env.SECRET_KEY, tokenExpiresIn: env.TOKEN_EXPIRES_IN || '8h' };
}

function getAppPort() {
  return Number(process.env.APP_PORT || process.env.PORT || 3000);
}

module.exports = { getDbConfig, getAuthConfig, getAppPort };

// Connection pool và giao dịch. Pool chỉ được tạo ở lần truy vấn đầu tiên (lazy).
const { Pool, types } = require('pg');
const { getDbConfig } = require('./env');

// Cột DATE trả về đúng chuỗi 'YYYY-MM-DD', không đổi sang Date theo múi giờ máy chủ.
types.setTypeParser(1082, (value) => value);

let pool = null;

function getPool() {
  if (!pool) {
    pool = new Pool({ ...getDbConfig(), max: 10, connectionTimeoutMillis: 3000, idleTimeoutMillis: 10000 });
    // Lỗi trên kết nối rảnh (ví dụ PostgreSQL bị tắt) không được làm sập tiến trình.
    pool.on('error', (err) => console.error('[db] Kết nối rảnh bị lỗi:', err.message));
  }
  return pool;
}

function query(text, params) {
  return getPool().query(text, params);
}

// Chạy fn(client) trong một giao dịch; lỗi bất kỳ → ROLLBACK toàn bộ.
async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      // kết nối đã hỏng – lỗi gốc quan trọng hơn
    }
    throw err;
  } finally {
    client.release();
  }
}

async function close() {
  if (pool) {
    const p = pool;
    pool = null;
    await p.end();
  }
}

module.exports = { getPool, query, withTransaction, close };

// Kiểm tra CSDL còn kết nối được không (dùng cho GET /api/health).
const db = require('../config/db');

async function ping(exec) {
  await (exec || db).query('SELECT 1');
  return true;
}

module.exports = { ping };

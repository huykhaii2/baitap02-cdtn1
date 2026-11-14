// IssueCategoryRepository – bảng issue_category (danh mục lỗi).
const db = require('../config/db');

const toCategory = (r) => r && { id: Number(r.id), code: r.code, name: r.name, isActive: r.is_active };

async function listActive(exec) {
  const { rows } = await (exec || db).query('SELECT * FROM issue_category WHERE is_active ORDER BY id');
  return rows.map(toCategory);
}

async function findById(exec, id) {
  const { rows } = await (exec || db).query('SELECT * FROM issue_category WHERE id = $1', [id]);
  return toCategory(rows[0]) || null;
}

module.exports = { listActive, findById };

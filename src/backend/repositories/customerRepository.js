// CustomerRepository – bảng customer. Mọi câu SQL đều tham số hoá.
const db = require('../config/db');
const { conflict } = require('../errors/AppError');
const { isUnique, isForeignKey, escapeLike } = require('./pgErrors');

const toCustomer = (r) =>
  r && {
    id: Number(r.id),
    fullName: r.full_name,
    phone: r.phone,
    createdAt: r.created_at,
    ...(r.device_count !== undefined ? { deviceCount: Number(r.device_count) } : {}),
  };

function phoneTaken(err) {
  if (isUnique(err)) return conflict('PHONE_EXISTS', 'Số điện thoại này đã thuộc một khách hàng khác.', { field: 'phone' });
  return err;
}

async function findByPhone(exec, phone) {
  const { rows } = await (exec || db).query('SELECT * FROM customer WHERE phone = $1', [phone]);
  return toCustomer(rows[0]) || null;
}

async function findById(exec, id) {
  const { rows } = await (exec || db).query('SELECT * FROM customer WHERE id = $1', [id]);
  return toCustomer(rows[0]) || null;
}

async function list(exec, { q, limit, offset }) {
  const params = [];
  let where = '';
  if (q) {
    params.push(`%${escapeLike(q)}%`);
    where = `WHERE c.full_name ILIKE $1 OR c.phone LIKE $1`;
  }
  params.push(limit, offset);
  const { rows } = await (exec || db).query(
    `SELECT c.*, COUNT(*) OVER() AS total_count,
            (SELECT COUNT(*) FROM device d WHERE d.customer_id = c.id) AS device_count
       FROM customer c ${where}
      ORDER BY c.created_at DESC, c.id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { items: rows.map(toCustomer), total: rows.length ? Number(rows[0].total_count) : 0 };
}

async function insert(exec, { fullName, phone }) {
  try {
    const { rows } = await (exec || db).query(
      'INSERT INTO customer (full_name, phone) VALUES ($1, $2) RETURNING *',
      [fullName, phone]
    );
    return toCustomer(rows[0]);
  } catch (err) {
    throw phoneTaken(err);
  }
}

async function update(exec, id, { fullName, phone }) {
  try {
    const { rows } = await (exec || db).query(
      'UPDATE customer SET full_name = $2, phone = $3 WHERE id = $1 RETURNING *',
      [id, fullName, phone]
    );
    return toCustomer(rows[0]) || null;
  } catch (err) {
    throw phoneTaken(err);
  }
}

async function remove(exec, id) {
  try {
    const { rowCount } = await (exec || db).query('DELETE FROM customer WHERE id = $1', [id]);
    return rowCount > 0;
  } catch (err) {
    // Lưới an toàn thứ hai: khoá ngoại device.customer_id chặn xoá khi còn thiết bị.
    if (isForeignKey(err)) throw conflict('CUSTOMER_HAS_DEVICES', 'Khách hàng còn thiết bị nên không xoá được.');
    throw err;
  }
}

module.exports = { findByPhone, findById, list, insert, update, remove };

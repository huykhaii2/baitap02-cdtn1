// DeviceRepository – bảng device. "Hết hạn bảo hành" là giá trị tính khi truy vấn (BR3), không lưu cột.
const db = require('../config/db');
const { conflict, notFound } = require('../errors/AppError');
const { isUnique, isForeignKey } = require('./pgErrors');

const TODAY_VN = `(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`;

const toDevice = (r) =>
  r && {
    id: Number(r.id),
    customerId: Number(r.customer_id),
    imei: r.imei,
    model: r.model,
    warrantyEndDate: r.warranty_end_date,
    warrantyExpired: r.warranty_expired === undefined ? undefined : Boolean(r.warranty_expired),
    createdAt: r.created_at,
    ...(r.ticket_count !== undefined ? { ticketCount: Number(r.ticket_count) } : {}),
  };

function translate(err) {
  if (isUnique(err)) return conflict('IMEI_EXISTS', 'IMEI này đã được đăng ký cho một thiết bị khác.', { field: 'imei' });
  if (isForeignKey(err, 'device_customer_id_fkey')) return notFound('CUSTOMER_NOT_FOUND', 'Không tìm thấy khách hàng.');
  return err;
}

const SELECT = `SELECT d.*, ${TODAY_VN} > d.warranty_end_date AS warranty_expired,
                       (SELECT COUNT(*) FROM ticket t WHERE t.device_id = d.id) AS ticket_count
                  FROM device d`;

async function findByImei(exec, imei, { forUpdate = false } = {}) {
  const sql = forUpdate
    ? `SELECT d.*, ${TODAY_VN} > d.warranty_end_date AS warranty_expired FROM device d WHERE d.imei = $1 FOR UPDATE`
    : `${SELECT} WHERE d.imei = $1`;
  const { rows } = await (exec || db).query(sql, [imei]);
  return toDevice(rows[0]) || null;
}

async function findById(exec, id) {
  const { rows } = await (exec || db).query(`${SELECT} WHERE d.id = $1`, [id]);
  return toDevice(rows[0]) || null;
}

async function listByCustomer(exec, customerId) {
  const { rows } = await (exec || db).query(`${SELECT} WHERE d.customer_id = $1 ORDER BY d.created_at DESC, d.id DESC`, [
    customerId,
  ]);
  return rows.map(toDevice);
}

async function countByCustomer(exec, customerId) {
  const { rows } = await (exec || db).query('SELECT COUNT(*) AS n FROM device WHERE customer_id = $1', [customerId]);
  return Number(rows[0].n);
}

async function countTickets(exec, deviceId) {
  const { rows } = await (exec || db).query('SELECT COUNT(*) AS n FROM ticket WHERE device_id = $1', [deviceId]);
  return Number(rows[0].n);
}

async function insert(exec, { customerId, imei, model, warrantyEndDate }) {
  try {
    const { rows } = await (exec || db).query(
      `INSERT INTO device (customer_id, imei, model, warranty_end_date) VALUES ($1, $2, $3, $4)
       RETURNING *, ${TODAY_VN} > warranty_end_date AS warranty_expired`,
      [customerId, imei, model, warrantyEndDate]
    );
    return toDevice(rows[0]);
  } catch (err) {
    throw translate(err);
  }
}

async function update(exec, id, { imei, model, warrantyEndDate }) {
  try {
    const { rows } = await (exec || db).query(
      `UPDATE device SET imei = $2, model = $3, warranty_end_date = $4 WHERE id = $1
       RETURNING *, ${TODAY_VN} > warranty_end_date AS warranty_expired`,
      [id, imei, model, warrantyEndDate]
    );
    return toDevice(rows[0]) || null;
  } catch (err) {
    throw translate(err);
  }
}

async function remove(exec, id) {
  try {
    const { rowCount } = await (exec || db).query('DELETE FROM device WHERE id = $1', [id]);
    return rowCount > 0;
  } catch (err) {
    if (isForeignKey(err)) throw conflict('DEVICE_HAS_TICKETS', 'Thiết bị đã có phiếu bảo hành nên không xoá được.');
    throw err;
  }
}

module.exports = { findByImei, findById, listByCustomer, countByCustomer, countTickets, insert, update, remove };

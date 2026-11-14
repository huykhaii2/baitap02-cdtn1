// Tiện ích cho test chạy với CSDL thật (npm run test:db). Cần chạy npm run migrate && npm run seed trước.
const db = require('../../src/backend/config/db');

const created = { customers: [], devices: [], tickets: [] };

function randomDigits(n) {
  let s = '';
  while (s.length < n) s += Math.floor(Math.random() * 10);
  return s;
}
// IMEI / SĐT ngẫu nhiên để test không đụng dữ liệu mẫu và chạy lại được nhiều lần.
const randomImei = () => `99${randomDigits(13)}`;
const randomPhone = () => `09${randomDigits(8)}`;

async function staffActor(username) {
  const { rows } = await db.query('SELECT id, role, full_name FROM staff WHERE username = $1', [username]);
  if (!rows[0]) throw new Error(`Không thấy tài khoản ${username}. Chạy "npm run migrate && npm run seed" trước khi chạy npm run test:db.`);
  return { id: Number(rows[0].id), role: rows[0].role, fullName: rows[0].full_name };
}

async function makeCustomerWithDevice() {
  const c = await db.query('INSERT INTO customer (full_name, phone) VALUES ($1, $2) RETURNING id, phone', ['Khách kiểm thử', randomPhone()]);
  const d = await db.query(
    "INSERT INTO device (customer_id, imei, model, warranty_end_date) VALUES ($1, $2, 'Máy kiểm thử', '2027-12-31') RETURNING id, imei",
    [c.rows[0].id, randomImei()]
  );
  created.customers.push(Number(c.rows[0].id));
  created.devices.push(Number(d.rows[0].id));
  return { customerId: Number(c.rows[0].id), phone: c.rows[0].phone, deviceId: Number(d.rows[0].id), imei: d.rows[0].imei };
}

function track(kind, id) {
  created[kind].push(Number(id));
}

// Dọn dữ liệu test (chỉ test mới được xoá phiếu – ứng dụng thì không, BR6).
async function cleanup() {
  await db.withTransaction(async (tx) => {
    const deviceIds = created.devices;
    if (deviceIds.length) {
      await tx.query('DELETE FROM ticket_status_log WHERE ticket_id IN (SELECT id FROM ticket WHERE device_id = ANY($1))', [deviceIds]);
      await tx.query('DELETE FROM ticket WHERE device_id = ANY($1)', [deviceIds]);
      await tx.query('DELETE FROM device WHERE id = ANY($1)', [deviceIds]);
    }
    if (created.customers.length) {
      await tx.query('DELETE FROM device WHERE customer_id = ANY($1)', [created.customers]);
      await tx.query('DELETE FROM customer WHERE id = ANY($1)', [created.customers]);
    }
  });
  created.customers.length = 0;
  created.devices.length = 0;
}

module.exports = { db, randomImei, randomPhone, staffActor, makeCustomerWithDevice, track, cleanup };

#!/usr/bin/env node
// npm run seed – nạp dữ liệu mẫu. Chạy lại nhiều lần không tạo bản ghi trùng (ON CONFLICT DO NOTHING).
// Khách hàng, model và mô tả lỗi lấy từ dataset/ của case study (đã làm sạch SĐT và họ tên).
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('../src/backend/config/db');
const { SLA_HOURS, yearInVietnam } = require('../src/backend/services/rules');

const DATASET = path.join(__dirname, '..', 'dataset');
const DEMO_PASSWORD = 'Matkhau@123';
const HOUR = 60 * 60 * 1000;

const STAFF = [
  { username: 'tn1', fullName: 'Lê Thu', role: 'RECEPTIONIST', active: true },
  { username: 'dp1', fullName: 'Trần Minh', role: 'COORDINATOR', active: true },
  { username: 'kt1', fullName: 'Phạm Huy', role: 'TECHNICIAN', active: true },
  { username: 'kt2', fullName: 'Võ Lan', role: 'TECHNICIAN', active: true },
  { username: 'kt3', fullName: 'Đỗ Nam', role: 'TECHNICIAN', active: false },
];

// Danh mục lỗi theo category_id của dataset/tickets_history.csv.
const CATEGORIES = [
  { id: 1, code: 'MAN_HINH', name: 'Màn hình' },
  { id: 2, code: 'PIN', name: 'Pin' },
  { id: 3, code: 'SAC_NGUON', name: 'Sạc – nguồn' },
  { id: 4, code: 'PHAN_MEM', name: 'Phần mềm' },
  { id: 5, code: 'NUOC_VAO', name: 'Vào nước' },
  { id: 6, code: 'KHAC', name: 'Khác' },
];

// ---------- đọc CSV đơn giản (có hỗ trợ ô trong dấu ngoặc kép) ----------
function parseCsv(file) {
  const text = fs.readFileSync(path.join(DATASET, file), 'utf8').replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [header, ...data] = rows.filter((r) => r.length > 1);
  return data.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

function cleanPhone(raw) {
  let p = String(raw).replace(/[\s.\-]/g, '');
  if (p.startsWith('+84')) p = `0${p.slice(3)}`;
  else if (/^84\d{9}$/.test(p)) p = `0${p.slice(2)}`;
  return /^0\d{9}$/.test(p) ? p : null;
}

function cleanName(raw) {
  const name = String(raw).trim().replace(/\s+/g, ' ');
  if (!name) return null;
  return name
    .toLocaleLowerCase('vi')
    .split(' ')
    .map((w) => w.charAt(0).toLocaleUpperCase('vi') + w.slice(1))
    .join(' ');
}

function cleanDescription(raw) {
  const text = String(raw).trim().replace(/\s+/g, ' ');
  return text.charAt(0).toLocaleUpperCase('vi') + text.slice(1).toLocaleLowerCase('vi');
}

function buildData(now) {
  const customers = [{ fullName: 'Nguyễn Văn An', phone: '0901234567' }];
  const seen = new Set(customers.map((c) => c.phone));
  for (const r of parseCsv('customers_raw.csv')) {
    const phone = cleanPhone(r.so_dien_thoai);
    const fullName = cleanName(r.ho_ten);
    if (!phone || !fullName || seen.has(phone) || fullName.length > 100) continue;
    seen.add(phone);
    customers.push({ fullName, phone });
    if (customers.length === 25) break;
  }

  const models = parseCsv('products.csv')
    .filter((p) => /Điện thoại|Máy tính bảng/.test(p.nhom_san_pham))
    .map((p) => p.product_name);

  // Hai thiết bị của khách demo: một còn hạn (dùng ở README mục 3), một hết hạn (minh hoạ BR3).
  const devices = [
    { phone: '0901234567', imei: '356789012345678', model: 'Samsung Galaxy A55', warrantyEndDate: '2027-03-10' },
    { phone: '0901234567', imei: '356789012345679', model: 'Samsung Galaxy A12', warrantyEndDate: '2025-12-31' },
  ];
  customers.slice(1).forEach((c, i) => {
    const expired = i % 6 === 5;
    const month = String((i % 12) + 1).padStart(2, '0');
    devices.push({
      phone: c.phone,
      imei: `35${String(4100000000000 + (i + 1) * 7919).padStart(13, '0')}`,
      model: models[(i * 7) % models.length],
      warrantyEndDate: expired ? `2026-${month}-15` : `2027-${month}-28`,
    });
  });

  const history = parseCsv('tickets_history.csv');
  const descFor = (categoryId, k) => cleanDescription(history.filter((t) => t.category_id === String(categoryId))[k].issue_desc);

  // 16 phiếu mẫu đủ các trạng thái; mốc thời gian tính lùi từ lúc seed lần đầu.
  const plan = [
    { status: 'NEW', cat: 1, hoursAgo: 2 },
    { status: 'NEW', cat: 2, hoursAgo: 5 },
    { status: 'NEW', cat: 5, hoursAgo: 9 },
    { status: 'NEW', cat: 4, hoursAgo: 20 },
    { status: 'CLASSIFIED', cat: 1, priority: 'HIGH', hoursAgo: 30, classifiedAfter: 1 },
    { status: 'CLASSIFIED', cat: 3, priority: 'MEDIUM', hoursAgo: 26, classifiedAfter: 2 },
    { status: 'CLASSIFIED', cat: 2, priority: 'HIGH', hoursAgo: 80, classifiedAfter: 2 }, // quá hạn
    { status: 'CLASSIFIED', cat: 6, priority: 'LOW', hoursAgo: 12, classifiedAfter: 1 },
    { status: 'ASSIGNED', cat: 1, priority: 'HIGH', hoursAgo: 14, classifiedAfter: 1, tech: 'kt1' },
    { status: 'ASSIGNED', cat: 4, priority: 'LOW', hoursAgo: 40, classifiedAfter: 3, tech: 'kt2' },
    { status: 'ASSIGNED', cat: 3, priority: 'MEDIUM', hoursAgo: 50, classifiedAfter: 2, tech: 'kt1' },
    { status: 'IN_PROGRESS', cat: 2, priority: 'MEDIUM', hoursAgo: 60, classifiedAfter: 2, tech: 'kt2' },
    { status: 'IN_PROGRESS', cat: 5, priority: 'HIGH', hoursAgo: 36, classifiedAfter: 1, tech: 'kt1' },
    { status: 'IN_PROGRESS', cat: 1, priority: 'HIGH', hoursAgo: 70, classifiedAfter: 1, tech: 'kt2' }, // quá hạn
    { status: 'REJECTED', cat: 5, hoursAgo: 48, reason: 'Máy vào nước do sử dụng, không thuộc điều kiện bảo hành' },
    { status: 'REJECTED', cat: 6, hoursAgo: 96, reason: 'Khách đổi ý, không tiếp tục bảo hành' },
  ];
  const year = yearInVietnam(now);
  const tickets = plan.map((p, i) => {
    const createdAt = new Date(now.getTime() - p.hoursAgo * HOUR);
    const t = {
      code: `BH-${year}-${String(i + 1).padStart(6, '0')}`,
      imei: devices[i + 2].imei,
      description: descFor(p.cat, i % 3),
      status: p.status,
      createdAt,
      logs: [{ from: null, to: 'NEW', by: 'tn1', at: createdAt, note: 'Tiếp nhận phiếu bảo hành' }],
    };
    if (p.priority) {
      const classifiedAt = new Date(createdAt.getTime() + p.classifiedAfter * HOUR);
      Object.assign(t, { categoryId: p.cat, priority: p.priority, dueDate: new Date(classifiedAt.getTime() + SLA_HOURS[p.priority] * HOUR) });
      t.logs.push({ from: 'NEW', to: 'CLASSIFIED', by: 'dp1', at: classifiedAt, note: `Phân loại: ${CATEGORIES[p.cat - 1].name}` });
      if (p.tech) {
        const assignedAt = new Date(classifiedAt.getTime() + HOUR);
        t.tech = p.tech;
        const techName = STAFF.find((s) => s.username === p.tech).fullName;
        t.logs.push({ from: 'CLASSIFIED', to: 'ASSIGNED', by: 'dp1', at: assignedAt, note: `Phân công cho ${techName}` });
        if (p.status === 'IN_PROGRESS') {
          t.logs.push({ from: 'ASSIGNED', to: 'IN_PROGRESS', by: p.tech, at: new Date(assignedAt.getTime() + 2 * HOUR), note: 'Kỹ thuật viên xác nhận nhận phiếu' });
        }
      }
    }
    if (p.status === 'REJECTED') {
      t.logs.push({ from: 'NEW', to: 'REJECTED', by: 'dp1', at: new Date(createdAt.getTime() + 3 * HOUR), note: p.reason });
    }
    t.updatedAt = t.logs[t.logs.length - 1].at;
    return t;
  });

  return { customers, devices, tickets };
}

async function seed({ log = console.log, now = new Date() } = {}) {
  const data = buildData(now);
  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 10);
  const added = { staff: 0, issue_category: 0, customer: 0, device: 0, ticket: 0, ticket_status_log: 0 };

  await db.withTransaction(async (tx) => {
    for (const s of STAFF) {
      const r = await tx.query(
        `INSERT INTO staff (username, password_hash, full_name, role, is_active)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
        [s.username, passwordHash, s.fullName, s.role, s.active]
      );
      added.staff += r.rowCount;
    }
    for (const c of CATEGORIES) {
      const r = await tx.query('INSERT INTO issue_category (code, name) VALUES ($1, $2) ON CONFLICT DO NOTHING', [c.code, c.name]);
      added.issue_category += r.rowCount;
    }
    for (const c of data.customers) {
      const r = await tx.query('INSERT INTO customer (full_name, phone) VALUES ($1, $2) ON CONFLICT DO NOTHING', [c.fullName, c.phone]);
      added.customer += r.rowCount;
    }
    for (const d of data.devices) {
      const r = await tx.query(
        `INSERT INTO device (customer_id, imei, model, warranty_end_date)
         SELECT id, $2, $3, $4 FROM customer WHERE phone = $1
         ON CONFLICT DO NOTHING`,
        [d.phone, d.imei, d.model, d.warrantyEndDate]
      );
      added.device += r.rowCount;
    }
    const staffId = Object.fromEntries((await tx.query('SELECT id, username FROM staff')).rows.map((r) => [r.username, r.id]));
    const categoryId = Object.fromEntries((await tx.query('SELECT id, code FROM issue_category')).rows.map((r) => [r.code, r.id]));
    for (const t of data.tickets) {
      // ON CONFLICT DO NOTHING bỏ qua cả trùng mã phiếu lẫn vi phạm BR2 (ux_ticket_open_device).
      const r = await tx.query(
        `INSERT INTO ticket (ticket_code, device_id, issue_description, issue_category_id, priority, due_date,
                             status, assigned_to, created_by, created_at, updated_at)
         SELECT $1, d.id, $3, $4, $5, $6, $7, $8, $9, $10, $11 FROM device d WHERE d.imei = $2
         ON CONFLICT DO NOTHING RETURNING id`,
        [
          t.code, t.imei, t.description,
          t.categoryId ? categoryId[CATEGORIES[t.categoryId - 1].code] : null,
          t.priority || null, t.dueDate || null, t.status,
          t.tech ? staffId[t.tech] : null, staffId.tn1, t.createdAt, t.updatedAt,
        ]
      );
      if (!r.rowCount) continue;
      added.ticket += 1;
      for (const l of t.logs) {
        await tx.query(
          `INSERT INTO ticket_status_log (ticket_id, from_status, to_status, note, changed_by, changed_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [r.rows[0].id, l.from, l.to, l.note, staffId[l.by], l.at]
        );
        added.ticket_status_log += 1;
      }
    }
  });

  const counts = (
    await db.query(`SELECT (SELECT COUNT(*) FROM staff) AS staff, (SELECT COUNT(*) FROM issue_category) AS issue_category,
                           (SELECT COUNT(*) FROM customer) AS customer, (SELECT COUNT(*) FROM device) AS device,
                           (SELECT COUNT(*) FROM ticket) AS ticket, (SELECT COUNT(*) FROM ticket_status_log) AS ticket_status_log`)
  ).rows[0];
  for (const table of Object.keys(added)) log(`  ${table.padEnd(18)} mới ${String(added[table]).padStart(3)} · tổng ${counts[table]}`);
  log("Seed xong. Tài khoản mẫu: tn1, dp1, kt1, kt2 (kt3 đã khoá) – mật khẩu xem README mục 3.");
  return added;
}

if (require.main === module) {
  seed()
    .catch((err) => {
      console.error('Seed lỗi:', err.message);
      if (err.code === '42P01') console.error('→ Chưa có bảng. Chạy npm run migrate trước.');
      process.exitCode = 1;
    })
    .finally(() => db.close());
}

module.exports = { seed, buildData };

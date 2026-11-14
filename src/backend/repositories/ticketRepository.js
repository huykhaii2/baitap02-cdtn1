// TicketRepository – bảng ticket. Lọc, tìm, phân trang làm ngay trong CSDL (NFR1).
const db = require('../config/db');
const { conflict } = require('../errors/AppError');
const { isUnique, escapeLike } = require('./pgErrors');

// Khoá tư vấn dùng để sinh mã phiếu tuần tự trong năm (TD-07).
const CODE_LOCK_NAMESPACE = 7102;
const OPEN = `('NEW', 'CLASSIFIED', 'ASSIGNED', 'IN_PROGRESS')`;

const DETAIL_SELECT = `
  SELECT t.*,
         d.imei, d.model, d.warranty_end_date, d.customer_id,
         c.full_name AS customer_name, c.phone AS customer_phone,
         ic.code AS category_code, ic.name AS category_name,
         a.full_name AS assignee_name,
         cb.full_name AS creator_name,
         (t.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date > d.warranty_end_date AS warranty_expired,
         (t.due_date IS NOT NULL AND t.due_date < now()
            AND t.status IN ('CLASSIFIED', 'ASSIGNED', 'IN_PROGRESS')) AS overdue
    FROM ticket t
    JOIN device d          ON d.id = t.device_id
    JOIN customer c        ON c.id = d.customer_id
    JOIN staff cb          ON cb.id = t.created_by
    LEFT JOIN issue_category ic ON ic.id = t.issue_category_id
    LEFT JOIN staff a      ON a.id = t.assigned_to`;

const toRow = (r) =>
  r && {
    id: Number(r.id),
    ticketCode: r.ticket_code,
    deviceId: Number(r.device_id),
    issueDescription: r.issue_description,
    issueCategoryId: r.issue_category_id === null ? null : Number(r.issue_category_id),
    priority: r.priority,
    dueDate: r.due_date,
    status: r.status,
    assignedTo: r.assigned_to === null ? null : Number(r.assigned_to),
    createdBy: Number(r.created_by),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };

const toDetail = (r) =>
  r && {
    ...toRow(r),
    warrantyExpired: Boolean(r.warranty_expired),
    overdue: Boolean(r.overdue),
    customer: { id: Number(r.customer_id), fullName: r.customer_name, phone: r.customer_phone },
    device: { id: Number(r.device_id), imei: r.imei, model: r.model, warrantyEndDate: r.warranty_end_date },
    issueCategory: r.issue_category_id === null ? null : { id: Number(r.issue_category_id), code: r.category_code, name: r.category_name },
    assignee: r.assigned_to === null ? null : { id: Number(r.assigned_to), fullName: r.assignee_name },
    creator: { id: Number(r.created_by), fullName: r.creator_name },
  };

// Sinh mã BH-YYYY-NNNNNN. Phải gọi trong giao dịch: khoá được nhả khi giao dịch kết thúc,
// nên hai nhân viên tạo phiếu cùng lúc không bị trùng mã.
async function nextCode(tx, year) {
  await tx.query('SELECT pg_advisory_xact_lock($1, $2)', [CODE_LOCK_NAMESPACE, year]);
  const { rows } = await tx.query(
    `SELECT COALESCE(MAX(substring(ticket_code FROM 9)::int), 0) + 1 AS n
       FROM ticket WHERE ticket_code LIKE $1`,
    [`BH-${year}-%`]
  );
  const n = Number(rows[0].n);
  if (n > 999999) throw new Error(`Hết dải mã phiếu của năm ${year}`);
  return `BH-${year}-${String(n).padStart(6, '0')}`;
}

async function insert(tx, { ticketCode, deviceId, issueDescription, createdBy }) {
  try {
    const { rows } = await tx.query(
      `INSERT INTO ticket (ticket_code, device_id, issue_description, status, created_by)
       VALUES ($1, $2, $3, 'NEW', $4) RETURNING *`,
      [ticketCode, deviceId, issueDescription, createdBy]
    );
    return toRow(rows[0]);
  } catch (err) {
    // Tầng thứ hai của BR2: UNIQUE một phần trong CSDL (khi hai yêu cầu chen nhau).
    if (isUnique(err, 'ux_ticket_open_device')) {
      throw conflict('OPEN_TICKET_EXISTS', 'Thiết bị đang có phiếu bảo hành chưa đóng.');
    }
    throw err;
  }
}

async function findOpenByDevice(exec, deviceId) {
  const { rows } = await (exec || db).query(
    `SELECT * FROM ticket WHERE device_id = $1 AND status IN ${OPEN} LIMIT 1`,
    [deviceId]
  );
  return toRow(rows[0]) || null;
}

async function findByCode(exec, code, { forUpdate = false } = {}) {
  const { rows } = await (exec || db).query(
    `SELECT * FROM ticket WHERE ticket_code = $1${forUpdate ? ' FOR UPDATE' : ''}`,
    [code]
  );
  return toRow(rows[0]) || null;
}

async function findDetailByCode(exec, code) {
  const { rows } = await (exec || db).query(`${DETAIL_SELECT} WHERE t.ticket_code = $1`, [code]);
  return toDetail(rows[0]) || null;
}

// filters: { status, priority, dueFrom, dueTo, q, assignedTo, limit, offset }
async function list(exec, filters) {
  const where = [];
  const params = [];
  const add = (sql, value) => {
    params.push(value);
    where.push(sql.replace('?', `$${params.length}`));
  };
  if (filters.status) add('t.status = ?', filters.status);
  if (filters.priority) add('t.priority = ?', filters.priority);
  if (filters.assignedTo) add('t.assigned_to = ?', filters.assignedTo);
  // Khoảng hạn xử lý tính theo ngày giờ Việt Nam, "đến ngày" lấy trọn ngày.
  if (filters.dueFrom) add(`t.due_date >= (?::date)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'`, filters.dueFrom);
  if (filters.dueTo) add(`t.due_date < ((?::date) + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'`, filters.dueTo);
  if (filters.q) {
    params.push(`%${escapeLike(filters.q)}%`);
    where.push(`(t.ticket_code ILIKE $${params.length} OR c.phone LIKE $${params.length})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const exe = exec || db;
  const countSql = `SELECT COUNT(*) AS n FROM ticket t JOIN device d ON d.id = t.device_id
                      JOIN customer c ON c.id = d.customer_id ${whereSql}`;
  const total = Number((await exe.query(countSql, params)).rows[0].n);
  const { rows } = await exe.query(
    `${DETAIL_SELECT} ${whereSql}
      ORDER BY t.created_at DESC, t.id DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, filters.limit, filters.offset]
  );
  return { items: rows.map(toDetail), total };
}

// TD-10: đổi trạng thái cùng các cột nghiệp vụ trong MỘT câu UPDATE, có điều kiện status = fromStatus.
// Trả về null nếu phiếu đã bị người khác đổi trạng thái (UC03-4b → DATA_CHANGED).
async function updateStatus(tx, id, fromStatus, toStatus, fields = {}) {
  const { rows } = await tx.query(
    `UPDATE ticket
        SET status = $3,
            issue_category_id = COALESCE($4, issue_category_id),
            priority          = COALESCE($5, priority),
            due_date          = COALESCE($6, due_date),
            assigned_to       = COALESCE($7, assigned_to),
            updated_at        = now()
      WHERE id = $1 AND status = $2
      RETURNING *`,
    [
      id,
      fromStatus,
      toStatus,
      fields.issueCategoryId ?? null,
      fields.priority ?? null,
      fields.dueDate ?? null,
      fields.assignedTo ?? null,
    ]
  );
  return toRow(rows[0]) || null;
}

module.exports = { nextCode, insert, findOpenByDevice, findByCode, findDetailByCode, list, updateStatus };

// StatusLogRepository – bảng ticket_status_log. Chỉ thêm, không sửa, không xoá (NFR5).
const db = require('../config/db');

const toLog = (r) => ({
  id: Number(r.id),
  ticketId: Number(r.ticket_id),
  fromStatus: r.from_status,
  toStatus: r.to_status,
  note: r.note,
  changedBy: { id: Number(r.changed_by), fullName: r.changed_by_name, role: r.changed_by_role },
  changedAt: r.changed_at,
});

async function insert(tx, { ticketId, fromStatus, toStatus, note, changedBy }) {
  const { rows } = await tx.query(
    `INSERT INTO ticket_status_log (ticket_id, from_status, to_status, note, changed_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [ticketId, fromStatus, toStatus, note || null, changedBy]
  );
  return Number(rows[0].id);
}

async function listByTicket(exec, ticketId) {
  const { rows } = await (exec || db).query(
    `SELECT l.*, s.full_name AS changed_by_name, s.role AS changed_by_role
       FROM ticket_status_log l JOIN staff s ON s.id = l.changed_by
      WHERE l.ticket_id = $1
      ORDER BY l.changed_at, l.id`,
    [ticketId]
  );
  return rows.map(toLog);
}

module.exports = { insert, listByTicket };

// StaffRepository – bảng staff (nhân viên, vai trò).
const db = require('../config/db');

const toStaff = (r) =>
  r && {
    id: Number(r.id),
    username: r.username,
    fullName: r.full_name,
    role: r.role,
    isActive: r.is_active,
    ...(r.open_ticket_count !== undefined ? { openTicketCount: Number(r.open_ticket_count) } : {}),
  };

// Trả kèm password_hash – chỉ AuthService dùng, không bao giờ trả ra API.
async function findByUsernameWithHash(exec, username) {
  const { rows } = await (exec || db).query('SELECT * FROM staff WHERE username = $1', [username]);
  if (!rows[0]) return null;
  return { ...toStaff(rows[0]), passwordHash: rows[0].password_hash };
}

async function findById(exec, id) {
  const { rows } = await (exec || db).query('SELECT * FROM staff WHERE id = $1', [id]);
  return toStaff(rows[0]) || null;
}

// Số phiếu kỹ thuật viên đang giữ được tính khi truy vấn, không lưu cột.
async function listActiveTechnicians(exec) {
  const { rows } = await (exec || db).query(
    `SELECT s.*,
            (SELECT COUNT(*) FROM ticket t
              WHERE t.assigned_to = s.id AND t.status IN ('ASSIGNED', 'IN_PROGRESS')) AS open_ticket_count
       FROM staff s
      WHERE s.role = 'TECHNICIAN' AND s.is_active
      ORDER BY s.full_name`
  );
  return rows.map(toStaff);
}

module.exports = { findByUsernameWithHash, findById, listActiveTechnicians };

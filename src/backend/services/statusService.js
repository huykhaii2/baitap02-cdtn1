// StatusService – NƠI DUY NHẤT đổi ticket.status và ghi ticket_status_log, luôn trong cùng giao dịch (NFR5).
const { conflict } = require('../errors/AppError');
const { canTransition, STATUS_LABELS } = require('./rules');

function createStatusService({ ticketRepo, statusLogRepo }) {
  // Dòng lịch sử đầu tiên (→ Mới) khi phiếu vừa được tạo.
  async function recordCreation(tx, ticket, actor) {
    await statusLogRepo.insert(tx, {
      ticketId: ticket.id,
      fromStatus: null,
      toStatus: ticket.status,
      note: 'Tiếp nhận phiếu bảo hành',
      changedBy: actor.id,
    });
  }

  // fields: cột nghiệp vụ ghi cùng trạng thái (issueCategoryId, priority, dueDate, assignedTo) – TD-10.
  async function changeStatus(tx, { ticket, toStatus, actor, note, fields }) {
    const fromStatus = ticket.status; // chốt trước khi UPDATE
    if (!canTransition(fromStatus, toStatus)) {
      throw conflict(
        'INVALID_TRANSITION',
        `Không thể chuyển phiếu từ «${STATUS_LABELS[fromStatus]}» sang «${STATUS_LABELS[toStatus]}».`,
        { from: fromStatus, to: toStatus }
      );
    }
    const updated = await ticketRepo.updateStatus(tx, ticket.id, fromStatus, toStatus, fields);
    if (!updated) {
      throw conflict(
        'DATA_CHANGED',
        'Phiếu vừa được người khác cập nhật. Hãy tải lại để xem trạng thái mới nhất.',
        { ticketCode: ticket.ticketCode }
      );
    }
    await statusLogRepo.insert(tx, {
      ticketId: ticket.id,
      fromStatus,
      toStatus,
      note,
      changedBy: actor.id,
    });
    return updated;
  }

  return { recordCreation, changeStatus };
}

module.exports = { createStatusService };

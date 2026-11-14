// AssignService – UC03: phân công kỹ thuật viên; UC05: kỹ thuật viên xác nhận nhận phiếu.
const { notFound, invalidInput, notAllowed } = require('../errors/AppError');
const { ROLES } = require('./rules');
const v = require('./validators');

function createAssignService({ db, ticketRepo, staffRepo, statusService }) {
  async function loadForUpdate(tx, code) {
    const ticket = await ticketRepo.findByCode(tx, String(code || '').toUpperCase(), { forUpdate: true });
    if (!ticket) throw notFound('TICKET_NOT_FOUND', 'Không tìm thấy phiếu bảo hành.', { ticketCode: code });
    return ticket;
  }

  async function assign(actor, code, input = {}) {
    v.requireRole(actor, [ROLES.COORDINATOR], 'phân công kỹ thuật viên'); // BR5, NFR4
    if (input.technicianId === undefined || input.technicianId === null || input.technicianId === '') {
      throw invalidInput('TECHNICIAN_REQUIRED', 'Vui lòng chọn kỹ thuật viên.', { field: 'technicianId' });
    }
    const technicianId = v.parsePositiveInt(input.technicianId, {
      code: 'TECHNICIAN_INVALID',
      message: 'Kỹ thuật viên không hợp lệ.',
      field: 'technicianId',
    });
    await db.withTransaction(async (tx) => {
      const ticket = await loadForUpdate(tx, code);
      const technician = await staffRepo.findById(tx, technicianId);
      // BR5: chỉ phân công cho kỹ thuật viên đang hoạt động.
      if (!technician || technician.role !== ROLES.TECHNICIAN || !technician.isActive) {
        throw invalidInput('TECHNICIAN_INVALID', 'Kỹ thuật viên không tồn tại hoặc đã bị khoá.', { field: 'technicianId' });
      }
      await statusService.changeStatus(tx, {
        ticket,
        toStatus: 'ASSIGNED',
        actor,
        note: `Phân công cho ${technician.fullName}`,
        fields: { assignedTo: technician.id },
      });
    });
    return ticketRepo.findDetailByCode(db, String(code).toUpperCase());
  }

  // UC05 – kỹ thuật viên được giao xác nhận nhận phiếu: Đã phân công → Đang xử lý.
  async function acknowledge(actor, code) {
    v.requireRole(actor, [ROLES.TECHNICIAN], 'xác nhận nhận phiếu');
    await db.withTransaction(async (tx) => {
      const ticket = await loadForUpdate(tx, code);
      if (ticket.assignedTo !== actor.id) {
        throw notAllowed('TICKET_NOT_ASSIGNED_TO_YOU', 'Phiếu này không được phân công cho bạn.');
      }
      await statusService.changeStatus(tx, {
        ticket,
        toStatus: 'IN_PROGRESS',
        actor,
        note: 'Kỹ thuật viên xác nhận nhận phiếu',
      });
    });
    return ticketRepo.findDetailByCode(db, String(code).toUpperCase());
  }

  // L2 – kỹ thuật viên đang hoạt động kèm số phiếu đang giữ.
  async function listTechnicians(actor) {
    v.requireRole(actor, [ROLES.COORDINATOR], 'xem danh sách kỹ thuật viên');
    return staffRepo.listActiveTechnicians(db);
  }

  return { assign, acknowledge, listTechnicians };
}

module.exports = { createAssignService };

// ClassifyService – UC02: phân loại (danh mục lỗi + mức ưu tiên, hạn xử lý theo BR4) hoặc Từ chối kèm lý do.
const { notFound, invalidInput } = require('../errors/AppError');
const { ROLES, PRIORITIES, computeDueDate } = require('./rules');
const v = require('./validators');

function createClassifyService({ db, ticketRepo, issueCategoryRepo, statusService, clock = () => new Date() }) {
  async function loadForUpdate(tx, code) {
    const ticket = await ticketRepo.findByCode(tx, String(code || '').toUpperCase(), { forUpdate: true });
    if (!ticket) throw notFound('TICKET_NOT_FOUND', 'Không tìm thấy phiếu bảo hành.', { ticketCode: code });
    return ticket;
  }

  async function classify(actor, code, input = {}) {
    v.requireRole(actor, [ROLES.COORDINATOR], 'phân loại phiếu'); // BR5, NFR4
    if (input.issueCategoryId === undefined || input.issueCategoryId === null || input.issueCategoryId === '') {
      throw invalidInput('ISSUE_CATEGORY_REQUIRED', 'Vui lòng chọn danh mục lỗi.', { field: 'issueCategoryId' });
    }
    const issueCategoryId = v.parsePositiveInt(input.issueCategoryId, {
      code: 'ISSUE_CATEGORY_INVALID',
      message: 'Danh mục lỗi không hợp lệ.',
      field: 'issueCategoryId',
    });
    if (!PRIORITIES.includes(input.priority)) {
      throw invalidInput('INVALID_PRIORITY', 'Vui lòng chọn mức ưu tiên: Cao, Trung bình hoặc Thấp.', { field: 'priority' });
    }
    const priority = input.priority;

    await db.withTransaction(async (tx) => {
      const ticket = await loadForUpdate(tx, code);
      const category = await issueCategoryRepo.findById(tx, issueCategoryId);
      if (!category || !category.isActive) {
        throw invalidInput('ISSUE_CATEGORY_INVALID', 'Danh mục lỗi không tồn tại hoặc đã ngừng dùng.', { field: 'issueCategoryId' });
      }
      const dueDate = computeDueDate(priority, clock()); // BR4
      await statusService.changeStatus(tx, {
        ticket,
        toStatus: 'CLASSIFIED',
        actor,
        note: `Phân loại: ${category.name}`,
        fields: { issueCategoryId, priority, dueDate },
      });
    });
    return ticketRepo.findDetailByCode(db, String(code).toUpperCase());
  }

  // BR6: Từ chối chỉ khi phiếu đang Mới và phải có lý do.
  async function reject(actor, code, input = {}) {
    v.requireRole(actor, [ROLES.COORDINATOR], 'từ chối phiếu');
    const reason = v.requireText(input.reason, {
      code: 'REJECT_REASON_REQUIRED',
      message: 'Vui lòng nhập lý do từ chối.',
      field: 'reason',
      max: 500,
    });
    await db.withTransaction(async (tx) => {
      const ticket = await loadForUpdate(tx, code);
      await statusService.changeStatus(tx, { ticket, toStatus: 'REJECTED', actor, note: reason });
    });
    return ticketRepo.findDetailByCode(db, String(code).toUpperCase());
  }

  // L1 – danh mục lỗi đang dùng (mọi vai trò đã đăng nhập).
  async function listCategories(actor) {
    v.requireRole(actor, Object.values(ROLES), 'xem danh mục lỗi');
    return issueCategoryRepo.listActive(db);
  }

  return { classify, reject, listCategories };
}

module.exports = { createClassifyService };

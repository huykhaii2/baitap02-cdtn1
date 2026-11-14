// TicketService – UC01 tạo phiếu (BR1, BR2, BR3), UC04 tra cứu danh sách, xem chi tiết và lịch sử (UC06).
const { notFound, notAllowed, conflict, invalidInput } = require('../errors/AppError');
const { ROLES, STATUSES, PRIORITIES, yearInVietnam } = require('./rules');
const v = require('./validators');

const TICKET_CODE = /^BH-\d{4}-\d{6}$/;

function createTicketService({ db, ticketRepo, deviceRepo, customerRepo, statusLogRepo, statusService, clock = () => new Date() }) {
  // UC01 – Nhân viên tiếp nhận tạo phiếu từ SĐT + IMEI + mô tả lỗi.
  // input.customer.fullName: tạo khách hàng mới khi SĐT chưa có (UC01-3a).
  // input.device.{model, warrantyEndDate}: tạo thiết bị khi IMEI chưa có (UC01-5a).
  async function create(actor, input = {}) {
    v.requireRole(actor, [ROLES.RECEPTIONIST], 'tạo phiếu bảo hành');
    const phone = v.normalizePhone(input.phone);
    const imei = v.normalizeImei(input.imei);
    const issueDescription = v.requireText(input.issueDescription, {
      code: 'DESCRIPTION_REQUIRED',
      message: 'Vui lòng nhập mô tả lỗi.',
      field: 'issueDescription',
      max: 2000,
    });
    const newCustomer = input.customer
      ? { fullName: v.requireText(input.customer.fullName, { code: 'FULL_NAME_REQUIRED', message: 'Vui lòng nhập họ tên khách hàng.', field: 'customer.fullName', max: 100 }) }
      : null;
    const newDevice = input.device
      ? {
          model: v.requireText(input.device.model, { code: 'MODEL_REQUIRED', message: 'Vui lòng nhập model thiết bị.', field: 'device.model', max: 100 }),
          warrantyEndDate: v.parseDateOnly(input.device.warrantyEndDate, {
            code: 'INVALID_WARRANTY_END_DATE',
            message: 'Ngày hết hạn bảo hành không hợp lệ (YYYY-MM-DD).',
            field: 'device.warrantyEndDate',
          }),
        }
      : null;

    const code = await db.withTransaction(async (tx) => {
      let customer = await customerRepo.findByPhone(tx, phone);
      if (!customer) {
        if (!newCustomer) {
          throw notFound('CUSTOMER_NOT_FOUND', 'Chưa có khách hàng với số điện thoại này.', { phone });
        }
        customer = await customerRepo.insert(tx, { fullName: newCustomer.fullName, phone });
      }

      let device = await deviceRepo.findByImei(tx, imei, { forUpdate: true });
      if (!device) {
        if (!newDevice) {
          throw notFound('DEVICE_NOT_FOUND', 'IMEI chưa có trong hệ thống – nhập model và ngày hết hạn bảo hành.', { imei });
        }
        device = await deviceRepo.insert(tx, { customerId: customer.id, imei, ...newDevice });
      }
      // BR1: mỗi phiếu gắn đúng một khách hàng và một thiết bị của chính khách hàng đó.
      if (device.customerId !== customer.id) {
        throw conflict('DEVICE_OWNED_BY_OTHER', 'IMEI này đã đăng ký cho một khách hàng khác.', { imei });
      }
      // BR2 tầng 1: kiểm tra trước khi ghi. Tầng 2 là UNIQUE một phần ux_ticket_open_device.
      const open = await ticketRepo.findOpenByDevice(tx, device.id);
      if (open) {
        throw conflict('OPEN_TICKET_EXISTS', `Thiết bị đang có phiếu ${open.ticketCode} chưa đóng.`, { ticketCode: open.ticketCode });
      }
      const ticketCode = await ticketRepo.nextCode(tx, yearInVietnam(clock()));
      const ticket = await ticketRepo.insert(tx, { ticketCode, deviceId: device.id, issueDescription, createdBy: actor.id });
      await statusService.recordCreation(tx, ticket, actor);
      return ticketCode;
    });
    return ticketRepo.findDetailByCode(db, code);
  }

  // UC04 – danh sách có lọc, tìm, phân trang 20 phiếu/trang (FR4). Kỹ thuật viên chỉ thấy phiếu của mình.
  async function list(actor, query = {}) {
    v.requireRole(actor, Object.values(ROLES), 'xem danh sách phiếu');
    const filters = v.parsePaging(query);
    if (query.status) {
      if (!STATUSES.includes(query.status)) throw invalidInput('INVALID_STATUS', 'Trạng thái lọc không hợp lệ.', { field: 'status' });
      filters.status = query.status;
    }
    if (query.priority) {
      if (!PRIORITIES.includes(query.priority)) throw invalidInput('INVALID_PRIORITY', 'Mức ưu tiên lọc không hợp lệ.', { field: 'priority' });
      filters.priority = query.priority;
    }
    if (query.dueFrom) filters.dueFrom = v.parseDateOnly(query.dueFrom, { code: 'INVALID_DATE', message: 'Ngày "hạn từ" không hợp lệ.', field: 'dueFrom' });
    if (query.dueTo) filters.dueTo = v.parseDateOnly(query.dueTo, { code: 'INVALID_DATE', message: 'Ngày "hạn đến" không hợp lệ.', field: 'dueTo' });
    if (filters.dueFrom && filters.dueTo && filters.dueFrom > filters.dueTo) {
      throw invalidInput('INVALID_DATE_RANGE', '"Hạn từ" phải trước hoặc bằng "hạn đến".', { field: 'dueTo' });
    }
    const q = typeof query.q === 'string' ? query.q.trim() : '';
    if (q.length > 50) throw invalidInput('INVALID_QUERY', 'Từ khoá tìm kiếm tối đa 50 ký tự.', { field: 'q' });
    if (q) filters.q = q;
    if (actor.role === ROLES.TECHNICIAN) filters.assignedTo = actor.id;

    const { items, total } = await ticketRepo.list(db, filters);
    return {
      items,
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
    };
  }

  async function loadVisible(actor, code) {
    v.requireRole(actor, Object.values(ROLES), 'xem phiếu');
    const ticketCode = String(code || '').toUpperCase();
    const ticket = TICKET_CODE.test(ticketCode) ? await ticketRepo.findDetailByCode(db, ticketCode) : null;
    if (!ticket) throw notFound('TICKET_NOT_FOUND', 'Không tìm thấy phiếu bảo hành.', { ticketCode });
    if (actor.role === ROLES.TECHNICIAN && ticket.assignedTo !== actor.id) {
      throw notAllowed('TICKET_NOT_ASSIGNED_TO_YOU', 'Phiếu này không được phân công cho bạn.');
    }
    return ticket;
  }

  const getDetail = (actor, code) => loadVisible(actor, code);

  // UC06 – lịch sử trạng thái của một phiếu.
  async function getHistory(actor, code) {
    const ticket = await loadVisible(actor, code);
    return statusLogRepo.listByTicket(db, ticket.id);
  }

  return { create, list, getDetail, getHistory };
}

module.exports = { createTicketService, TICKET_CODE };

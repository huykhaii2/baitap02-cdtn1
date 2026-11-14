// MasterDataService – CRUD khách hàng (S1) và thiết bị (S2), tra cứu theo SĐT (C1) và IMEI (D1) – TD-13.
// Chỉ Nhân viên tiếp nhận được ghi; Điều phối viên được đọc.
const { notFound, conflict } = require('../errors/AppError');
const { ROLES } = require('./rules');
const v = require('./validators');

const READERS = [ROLES.RECEPTIONIST, ROLES.COORDINATOR];
const WRITERS = [ROLES.RECEPTIONIST];

function createMasterDataService({ db, customerRepo, deviceRepo, ticketRepo }) {
  const customerInput = (input = {}) => ({
    fullName: v.requireText(input.fullName, { code: 'FULL_NAME_REQUIRED', message: 'Vui lòng nhập họ tên khách hàng.', field: 'fullName', max: 100 }),
    phone: v.normalizePhone(input.phone),
  });

  const deviceInput = (input = {}) => ({
    imei: v.normalizeImei(input.imei),
    model: v.requireText(input.model, { code: 'MODEL_REQUIRED', message: 'Vui lòng nhập model thiết bị.', field: 'model', max: 100 }),
    warrantyEndDate: v.parseDateOnly(input.warrantyEndDate, {
      code: 'INVALID_WARRANTY_END_DATE',
      message: 'Ngày hết hạn bảo hành không hợp lệ (YYYY-MM-DD).',
      field: 'warrantyEndDate',
    }),
  });

  const idOf = (raw, what) => v.parsePositiveInt(raw, { code: 'INVALID_ID', message: `Mã ${what} không hợp lệ.`, field: 'id' });

  // ---------- Khách hàng ----------
  // C1 / UC07 – tra cứu khách hàng theo số điện thoại.
  async function findCustomerByPhone(actor, rawPhone) {
    v.requireRole(actor, READERS, 'tra cứu khách hàng');
    const phone = v.normalizePhone(rawPhone);
    const customer = await customerRepo.findByPhone(db, phone);
    if (!customer) throw notFound('CUSTOMER_NOT_FOUND', 'Chưa có khách hàng với số điện thoại này.', { phone });
    return { ...customer, devices: await deviceRepo.listByCustomer(db, customer.id) };
  }

  async function listCustomers(actor, query = {}) {
    v.requireRole(actor, READERS, 'xem danh sách khách hàng');
    const paging = v.parsePaging(query);
    const q = typeof query.q === 'string' ? query.q.trim().slice(0, 50) : '';
    const { items, total } = await customerRepo.list(db, { q, limit: paging.limit, offset: paging.offset });
    return { items, page: paging.page, pageSize: paging.pageSize, total, totalPages: Math.max(1, Math.ceil(total / paging.pageSize)) };
  }

  async function getCustomer(actor, rawId) {
    v.requireRole(actor, READERS, 'xem khách hàng');
    const customer = await customerRepo.findById(db, idOf(rawId, 'khách hàng'));
    if (!customer) throw notFound('CUSTOMER_NOT_FOUND', 'Không tìm thấy khách hàng.');
    return { ...customer, devices: await deviceRepo.listByCustomer(db, customer.id) };
  }

  async function createCustomer(actor, input) {
    v.requireRole(actor, WRITERS, 'thêm khách hàng');
    return customerRepo.insert(db, customerInput(input));
  }

  async function updateCustomer(actor, rawId, input) {
    v.requireRole(actor, WRITERS, 'sửa khách hàng');
    const id = idOf(rawId, 'khách hàng');
    const updated = await customerRepo.update(db, id, customerInput(input));
    if (!updated) throw notFound('CUSTOMER_NOT_FOUND', 'Không tìm thấy khách hàng.');
    return updated;
  }

  async function deleteCustomer(actor, rawId) {
    v.requireRole(actor, WRITERS, 'xoá khách hàng');
    const id = idOf(rawId, 'khách hàng');
    await db.withTransaction(async (tx) => {
      const customer = await customerRepo.findById(tx, id);
      if (!customer) throw notFound('CUSTOMER_NOT_FOUND', 'Không tìm thấy khách hàng.');
      const deviceCount = await deviceRepo.countByCustomer(tx, id);
      if (deviceCount > 0) {
        throw conflict('CUSTOMER_HAS_DEVICES', `Khách hàng còn ${deviceCount} thiết bị nên không xoá được. Xoá thiết bị trước.`, { deviceCount });
      }
      await customerRepo.remove(tx, id);
    });
  }

  // ---------- Thiết bị ----------
  // D1 – tra cứu thiết bị theo IMEI, kèm khách hàng, phiếu chưa đóng (BR2) và cảnh báo hết hạn (BR3).
  async function findDeviceByImei(actor, rawImei) {
    v.requireRole(actor, READERS, 'tra cứu thiết bị');
    const imei = v.normalizeImei(rawImei);
    const device = await deviceRepo.findByImei(db, imei);
    if (!device) throw notFound('DEVICE_NOT_FOUND', 'IMEI chưa có trong hệ thống.', { imei });
    const [customer, openTicket] = await Promise.all([
      customerRepo.findById(db, device.customerId),
      ticketRepo.findOpenByDevice(db, device.id),
    ]);
    return {
      ...device,
      customer,
      openTicket: openTicket ? { ticketCode: openTicket.ticketCode, status: openTicket.status } : null,
    };
  }

  async function getDevice(actor, rawId) {
    v.requireRole(actor, READERS, 'xem thiết bị');
    const device = await deviceRepo.findById(db, idOf(rawId, 'thiết bị'));
    if (!device) throw notFound('DEVICE_NOT_FOUND', 'Không tìm thấy thiết bị.');
    return device;
  }

  async function listDevices(actor, query = {}) {
    v.requireRole(actor, READERS, 'xem danh sách thiết bị');
    const customerId = idOf(query.customerId, 'khách hàng');
    return deviceRepo.listByCustomer(db, customerId);
  }

  async function createDevice(actor, input = {}) {
    v.requireRole(actor, WRITERS, 'thêm thiết bị');
    const customerId = v.parsePositiveInt(input.customerId, { code: 'CUSTOMER_REQUIRED', message: 'Vui lòng chọn khách hàng.', field: 'customerId' });
    const data = deviceInput(input);
    return deviceRepo.insert(db, { customerId, ...data });
  }

  async function updateDevice(actor, rawId, input) {
    v.requireRole(actor, WRITERS, 'sửa thiết bị');
    const id = idOf(rawId, 'thiết bị');
    const data = deviceInput(input);
    const current = await deviceRepo.findById(db, id);
    if (!current) throw notFound('DEVICE_NOT_FOUND', 'Không tìm thấy thiết bị.');
    // Đổi IMEI của thiết bị đã có phiếu sẽ làm sai lịch sử bảo hành.
    if (data.imei !== current.imei && current.ticketCount > 0) {
      throw conflict('DEVICE_HAS_TICKETS', 'Thiết bị đã có phiếu bảo hành nên không đổi được IMEI.', { field: 'imei' });
    }
    return deviceRepo.update(db, id, data);
  }

  async function deleteDevice(actor, rawId) {
    v.requireRole(actor, WRITERS, 'xoá thiết bị');
    const id = idOf(rawId, 'thiết bị');
    await db.withTransaction(async (tx) => {
      const device = await deviceRepo.findById(tx, id);
      if (!device) throw notFound('DEVICE_NOT_FOUND', 'Không tìm thấy thiết bị.');
      const ticketCount = await deviceRepo.countTickets(tx, id);
      if (ticketCount > 0) {
        throw conflict('DEVICE_HAS_TICKETS', 'Thiết bị đã có phiếu bảo hành nên không xoá được (BR6: phiếu không bao giờ bị xoá).', { ticketCount });
      }
      await deviceRepo.remove(tx, id);
    });
  }

  return {
    findCustomerByPhone,
    listCustomers,
    getCustomer,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    findDeviceByImei,
    getDevice,
    listDevices,
    createDevice,
    updateDevice,
    deleteDevice,
  };
}

module.exports = { createMasterDataService };

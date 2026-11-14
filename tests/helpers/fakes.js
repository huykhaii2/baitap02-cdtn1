// Repository và CSDL giả trong bộ nhớ – unit test lớp nghiệp vụ không cần PostgreSQL.
const { conflict } = require('../../src/backend/errors/AppError');
const { OPEN_STATUSES } = require('../../src/backend/services/rules');

const ACTORS = Object.freeze({
  receptionist: { id: 1, role: 'RECEPTIONIST', fullName: 'Lê Thu' },
  coordinator: { id: 2, role: 'COORDINATOR', fullName: 'Trần Minh' },
  tech1: { id: 3, role: 'TECHNICIAN', fullName: 'Phạm Huy' },
  tech2: { id: 4, role: 'TECHNICIAN', fullName: 'Võ Lan' },
});

function makeFakes() {
  const store = {
    staff: [
      { id: 1, username: 'tn1', fullName: 'Lê Thu', role: 'RECEPTIONIST', isActive: true },
      { id: 2, username: 'dp1', fullName: 'Trần Minh', role: 'COORDINATOR', isActive: true },
      { id: 3, username: 'kt1', fullName: 'Phạm Huy', role: 'TECHNICIAN', isActive: true },
      { id: 4, username: 'kt2', fullName: 'Võ Lan', role: 'TECHNICIAN', isActive: true },
      { id: 5, username: 'kt3', fullName: 'Đỗ Nam', role: 'TECHNICIAN', isActive: false },
    ],
    categories: [
      { id: 1, code: 'MAN_HINH', name: 'Màn hình', isActive: true },
      { id: 2, code: 'PIN', name: 'Pin', isActive: true },
      { id: 9, code: 'CU', name: 'Danh mục cũ', isActive: false },
    ],
    customers: [{ id: 1, fullName: 'Nguyễn Văn An', phone: '0901234567' }],
    devices: [
      { id: 1, customerId: 1, imei: '356789012345678', model: 'Samsung Galaxy A55', warrantyEndDate: '2027-03-10', warrantyExpired: false },
      { id: 2, customerId: 1, imei: '356789012345679', model: 'Samsung Galaxy A12', warrantyEndDate: '2025-12-31', warrantyExpired: true },
    ],
    tickets: [],
    logs: [],
    calls: { list: [], transactions: 0 },
  };
  let seq = 100;
  const nextId = () => (seq += 1);
  const TX = { name: 'tx' };

  const db = {
    query: async () => ({ rows: [] }),
    async withTransaction(fn) {
      store.calls.transactions += 1;
      // Giả lập ROLLBACK: lỗi thì khôi phục dữ liệu như trước giao dịch.
      const snapshot = JSON.stringify({ c: store.customers, d: store.devices, t: store.tickets, l: store.logs });
      try {
        return await fn(TX);
      } catch (err) {
        const s = JSON.parse(snapshot);
        Object.assign(store, { customers: s.c, devices: s.d, tickets: s.t, logs: s.l });
        throw err;
      }
    },
  };

  const customerRepo = {
    findByPhone: async (_e, phone) => store.customers.find((c) => c.phone === phone) || null,
    findById: async (_e, id) => store.customers.find((c) => c.id === id) || null,
    list: async (_e, { q }) => {
      const items = store.customers.filter((c) => !q || c.fullName.includes(q) || c.phone.includes(q));
      return { items, total: items.length };
    },
    insert: async (_e, data) => {
      if (store.customers.some((c) => c.phone === data.phone)) throw conflict('PHONE_EXISTS', 'trùng', { field: 'phone' });
      const c = { id: nextId(), ...data };
      store.customers.push(c);
      return c;
    },
    update: async (_e, id, data) => {
      const c = store.customers.find((x) => x.id === id);
      if (!c) return null;
      Object.assign(c, data);
      return c;
    },
    remove: async (_e, id) => {
      const before = store.customers.length;
      store.customers = store.customers.filter((c) => c.id !== id);
      return store.customers.length < before;
    },
  };

  const ticketsOf = (deviceId) => store.tickets.filter((t) => t.deviceId === deviceId).length;
  const deviceRepo = {
    findByImei: async (_e, imei) => {
      const d = store.devices.find((x) => x.imei === imei);
      return d ? { ...d, ticketCount: ticketsOf(d.id) } : null;
    },
    findById: async (_e, id) => {
      const d = store.devices.find((x) => x.id === id);
      return d ? { ...d, ticketCount: ticketsOf(d.id) } : null;
    },
    listByCustomer: async (_e, customerId) => store.devices.filter((d) => d.customerId === customerId),
    countByCustomer: async (_e, customerId) => store.devices.filter((d) => d.customerId === customerId).length,
    countTickets: async (_e, deviceId) => ticketsOf(deviceId),
    insert: async (_e, data) => {
      if (store.devices.some((d) => d.imei === data.imei)) throw conflict('IMEI_EXISTS', 'trùng', { field: 'imei' });
      const d = { id: nextId(), warrantyExpired: false, ...data };
      store.devices.push(d);
      return d;
    },
    update: async (_e, id, data) => {
      const d = store.devices.find((x) => x.id === id);
      Object.assign(d, data);
      return d;
    },
    remove: async (_e, id) => {
      store.devices = store.devices.filter((d) => d.id !== id);
      return true;
    },
  };

  const ticketRepo = {
    nextCode: async (tx, year) => {
      if (tx !== TX) throw new Error('nextCode phải chạy trong giao dịch');
      const n = store.tickets.filter((t) => t.ticketCode.startsWith(`BH-${year}-`)).length + 1;
      return `BH-${year}-${String(n).padStart(6, '0')}`;
    },
    insert: async (tx, data) => {
      if (tx !== TX) throw new Error('insert phải chạy trong giao dịch');
      const t = { id: nextId(), status: 'NEW', issueCategoryId: null, priority: null, dueDate: null, assignedTo: null, ...data };
      store.tickets.push(t);
      return { ...t };
    },
    findOpenByDevice: async (_e, deviceId) =>
      store.tickets.find((t) => t.deviceId === deviceId && OPEN_STATUSES.includes(t.status)) || null,
    findByCode: async (_e, code) => {
      const t = store.tickets.find((x) => x.ticketCode === code);
      return t ? { ...t } : null;
    },
    findDetailByCode: async (_e, code) => {
      const t = store.tickets.find((x) => x.ticketCode === code);
      if (!t) return null;
      const device = store.devices.find((d) => d.id === t.deviceId);
      return { ...t, device, customer: store.customers.find((c) => c.id === device.customerId), warrantyExpired: device.warrantyExpired };
    },
    list: async (_e, filters) => {
      store.calls.list.push(filters);
      return { items: [], total: 0 };
    },
    updateStatus: async (tx, id, fromStatus, toStatus, fields = {}) => {
      if (tx !== TX) throw new Error('updateStatus phải chạy trong giao dịch');
      const t = store.tickets.find((x) => x.id === id);
      if (!t || t.status !== fromStatus) return null;
      Object.entries(fields).forEach(([k, v]) => { if (v !== undefined && v !== null) t[k] = v; });
      t.status = toStatus;
      return { ...t };
    },
  };

  const statusLogRepo = {
    insert: async (tx, row) => {
      if (tx !== TX) throw new Error('ghi lịch sử phải chạy trong giao dịch');
      store.logs.push({ id: nextId(), ...row });
      return store.logs.length;
    },
    listByTicket: async (_e, ticketId) => store.logs.filter((l) => l.ticketId === ticketId),
  };

  const issueCategoryRepo = {
    listActive: async () => store.categories.filter((c) => c.isActive),
    findById: async (_e, id) => store.categories.find((c) => c.id === id) || null,
  };

  const staffRepo = {
    findById: async (_e, id) => store.staff.find((s) => s.id === id) || null,
    findByUsernameWithHash: async (_e, username) => {
      const s = store.staff.find((x) => x.username === username);
      return s ? { ...s, passwordHash: store.passwordHash } : null;
    },
    listActiveTechnicians: async () => store.staff.filter((s) => s.role === 'TECHNICIAN' && s.isActive),
  };

  // Thêm nhanh một phiếu ở trạng thái bất kỳ để test các bước sau.
  function addTicket(overrides = {}) {
    const t = {
      id: nextId(),
      ticketCode: `BH-2026-${String(store.tickets.length + 1).padStart(6, '0')}`,
      deviceId: 1,
      issueDescription: 'Máy không lên nguồn',
      status: 'NEW',
      issueCategoryId: null,
      priority: null,
      dueDate: null,
      assignedTo: null,
      createdBy: 1,
      ...overrides,
    };
    store.tickets.push(t);
    return t;
  }

  return { store, db, TX, customerRepo, deviceRepo, ticketRepo, statusLogRepo, issueCategoryRepo, staffRepo, addTicket };
}

module.exports = { makeFakes, ACTORS };

// Unit test AssignService – UC03 phân công (FR3, BR5) và UC05 kỹ thuật viên nhận phiếu.
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createAssignService } = require('../src/backend/services/assignService');
const { createStatusService } = require('../src/backend/services/statusService');
const { makeFakes, ACTORS } = require('./helpers/fakes');
const { rejectsWith } = require('./helpers/assertions');

let f;
let svc;
let classified;

beforeEach(() => {
  f = makeFakes();
  svc = createAssignService({ ...f, statusService: createStatusService(f) });
  classified = f.addTicket({ status: 'CLASSIFIED', issueCategoryId: 1, priority: 'HIGH', dueDate: new Date() });
});

describe('AssignService.assign', () => {
  it('phân công phiếu Đã phân loại cho kỹ thuật viên đang hoạt động → ASSIGNED', async () => {
    const t = await svc.assign(ACTORS.coordinator, classified.ticketCode, { technicianId: 3 });
    assert.equal(t.status, 'ASSIGNED');
    assert.equal(t.assignedTo, 3);
    assert.equal(f.store.logs[0].note, 'Phân công cho Phạm Huy');
  });

  it('không chọn kỹ thuật viên → TECHNICIAN_REQUIRED', async () => {
    await rejectsWith(svc.assign(ACTORS.coordinator, classified.ticketCode, {}), 'INVALID_INPUT', 'TECHNICIAN_REQUIRED');
  });

  it('BR5: kỹ thuật viên đã khoá / người không phải kỹ thuật viên / id lạ → TECHNICIAN_INVALID', async () => {
    await rejectsWith(svc.assign(ACTORS.coordinator, classified.ticketCode, { technicianId: 5 }), 'INVALID_INPUT', 'TECHNICIAN_INVALID');
    await rejectsWith(svc.assign(ACTORS.coordinator, classified.ticketCode, { technicianId: 1 }), 'INVALID_INPUT', 'TECHNICIAN_INVALID');
    await rejectsWith(svc.assign(ACTORS.coordinator, classified.ticketCode, { technicianId: 999 }), 'INVALID_INPUT', 'TECHNICIAN_INVALID');
    await rejectsWith(svc.assign(ACTORS.coordinator, classified.ticketCode, { technicianId: -3 }), 'INVALID_INPUT', 'TECHNICIAN_INVALID');
  });

  it('phiếu chưa phân loại không phân công được (US3) → INVALID_TRANSITION', async () => {
    const fresh = f.addTicket();
    await rejectsWith(svc.assign(ACTORS.coordinator, fresh.ticketCode, { technicianId: 3 }), 'CONFLICT', 'INVALID_TRANSITION');
  });

  it('NFR4: Nhân viên tiếp nhận không được phân công', async () => {
    await rejectsWith(svc.assign(ACTORS.receptionist, classified.ticketCode, { technicianId: 3 }), 'NOT_ALLOWED');
  });
});

describe('AssignService.acknowledge (UC05)', () => {
  beforeEach(async () => {
    await svc.assign(ACTORS.coordinator, classified.ticketCode, { technicianId: 3 });
  });

  it('kỹ thuật viên được giao xác nhận → IN_PROGRESS, lịch sử có 2 dòng', async () => {
    const t = await svc.acknowledge(ACTORS.tech1, classified.ticketCode);
    assert.equal(t.status, 'IN_PROGRESS');
    assert.equal(f.store.logs.length, 2);
  });

  it('kỹ thuật viên khác → TICKET_NOT_ASSIGNED_TO_YOU; Điều phối viên → ROLE_NOT_ALLOWED', async () => {
    await rejectsWith(svc.acknowledge(ACTORS.tech2, classified.ticketCode), 'NOT_ALLOWED', 'TICKET_NOT_ASSIGNED_TO_YOU');
    await rejectsWith(svc.acknowledge(ACTORS.coordinator, classified.ticketCode), 'NOT_ALLOWED', 'ROLE_NOT_ALLOWED');
  });

  it('nhận lần hai → INVALID_TRANSITION (không quay lui, không lặp)', async () => {
    await svc.acknowledge(ACTORS.tech1, classified.ticketCode);
    await rejectsWith(svc.acknowledge(ACTORS.tech1, classified.ticketCode), 'CONFLICT', 'INVALID_TRANSITION');
  });

  it('L2: chỉ liệt kê kỹ thuật viên đang hoạt động, chỉ Điều phối viên xem được', async () => {
    const list = await svc.listTechnicians(ACTORS.coordinator);
    assert.deepEqual(list.map((s) => s.username), ['kt1', 'kt2']);
    await rejectsWith(svc.listTechnicians(ACTORS.receptionist), 'NOT_ALLOWED');
  });
});

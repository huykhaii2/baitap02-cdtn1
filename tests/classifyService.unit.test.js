// Unit test ClassifyService – UC02 phân loại (FR2, BR4) và từ chối (BR6), quyền (BR5, NFR4).
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createClassifyService } = require('../src/backend/services/classifyService');
const { createStatusService } = require('../src/backend/services/statusService');
const { makeFakes, ACTORS } = require('./helpers/fakes');
const { rejectsWith } = require('./helpers/assertions');

const NOW = new Date('2026-11-14T03:00:00Z');
const HOUR = 3600 * 1000;
let f;
let svc;
let ticket;

beforeEach(() => {
  f = makeFakes();
  svc = createClassifyService({ ...f, statusService: createStatusService(f), clock: () => NOW });
  ticket = f.addTicket();
});

describe('ClassifyService.classify', () => {
  for (const [priority, hours] of [['HIGH', 24], ['MEDIUM', 72], ['LOW', 120]]) {
    it(`BR4: mức ${priority} → hạn xử lý = thời điểm phân loại + ${hours} giờ`, async () => {
      const t = await svc.classify(ACTORS.coordinator, ticket.ticketCode, { issueCategoryId: 1, priority });
      assert.equal(t.status, 'CLASSIFIED');
      assert.equal(new Date(t.dueDate).getTime(), NOW.getTime() + hours * HOUR);
    });
  }

  it('ghi danh mục, mức ưu tiên và đúng 1 dòng lịch sử Mới → Đã phân loại (TD-10, NFR5)', async () => {
    await svc.classify(ACTORS.coordinator, ticket.ticketCode, { issueCategoryId: '2', priority: 'MEDIUM' });
    const saved = f.store.tickets[0];
    assert.equal(saved.issueCategoryId, 2);
    assert.equal(saved.priority, 'MEDIUM');
    assert.equal(f.store.logs.length, 1);
    assert.equal(f.store.logs[0].note, 'Phân loại: Pin');
  });

  it('thiếu danh mục → ISSUE_CATEGORY_REQUIRED; danh mục ngừng dùng → ISSUE_CATEGORY_INVALID', async () => {
    await rejectsWith(svc.classify(ACTORS.coordinator, ticket.ticketCode, { priority: 'HIGH' }), 'INVALID_INPUT', 'ISSUE_CATEGORY_REQUIRED');
    await rejectsWith(svc.classify(ACTORS.coordinator, ticket.ticketCode, { issueCategoryId: 9, priority: 'HIGH' }), 'INVALID_INPUT', 'ISSUE_CATEGORY_INVALID');
    await rejectsWith(svc.classify(ACTORS.coordinator, ticket.ticketCode, { issueCategoryId: 'abc', priority: 'HIGH' }), 'INVALID_INPUT', 'ISSUE_CATEGORY_INVALID');
  });

  it('mức ưu tiên thiếu hoặc lạ → INVALID_PRIORITY', async () => {
    await rejectsWith(svc.classify(ACTORS.coordinator, ticket.ticketCode, { issueCategoryId: 1 }), 'INVALID_INPUT', 'INVALID_PRIORITY');
    await rejectsWith(svc.classify(ACTORS.coordinator, ticket.ticketCode, { issueCategoryId: 1, priority: 'URGENT' }), 'INVALID_INPUT', 'INVALID_PRIORITY');
  });

  it('BR5 / NFR4: Nhân viên tiếp nhận, Kỹ thuật viên không được phân loại', async () => {
    await rejectsWith(svc.classify(ACTORS.receptionist, ticket.ticketCode, { issueCategoryId: 1, priority: 'HIGH' }), 'NOT_ALLOWED');
    await rejectsWith(svc.classify(ACTORS.tech1, ticket.ticketCode, { issueCategoryId: 1, priority: 'HIGH' }), 'NOT_ALLOWED');
    assert.equal(f.store.tickets[0].status, 'NEW');
  });

  it('phiếu đã phân loại không phân loại lại được → INVALID_TRANSITION', async () => {
    await svc.classify(ACTORS.coordinator, ticket.ticketCode, { issueCategoryId: 1, priority: 'HIGH' });
    await rejectsWith(svc.classify(ACTORS.coordinator, ticket.ticketCode, { issueCategoryId: 2, priority: 'LOW' }), 'CONFLICT', 'INVALID_TRANSITION');
  });

  it('phiếu không tồn tại → TICKET_NOT_FOUND', async () => {
    await rejectsWith(svc.classify(ACTORS.coordinator, 'BH-2026-999999', { issueCategoryId: 1, priority: 'HIGH' }), 'NOT_FOUND', 'TICKET_NOT_FOUND');
  });
});

describe('ClassifyService.reject (BR6)', () => {
  it('Từ chối phiếu Mới kèm lý do → REJECTED, lý do ghi vào lịch sử', async () => {
    const t = await svc.reject(ACTORS.coordinator, ticket.ticketCode, { reason: '  Máy vào nước do sử dụng ' });
    assert.equal(t.status, 'REJECTED');
    assert.equal(f.store.logs[0].note, 'Máy vào nước do sử dụng');
  });

  it('lý do trống → REJECT_REASON_REQUIRED', async () => {
    await rejectsWith(svc.reject(ACTORS.coordinator, ticket.ticketCode, { reason: '  ' }), 'INVALID_INPUT', 'REJECT_REASON_REQUIRED');
  });

  it('chỉ từ chối được khi phiếu đang Mới', async () => {
    const classified = f.addTicket({ status: 'CLASSIFIED', issueCategoryId: 1, priority: 'LOW', dueDate: NOW });
    await rejectsWith(svc.reject(ACTORS.coordinator, classified.ticketCode, { reason: 'x' }), 'CONFLICT', 'INVALID_TRANSITION');
  });
});

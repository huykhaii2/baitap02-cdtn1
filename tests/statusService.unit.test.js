// Unit test StatusService – bảng chuyển trạng thái (BR6), lịch sử đi cùng mỗi lần đổi (NFR5), xung đột (UC03-4b).
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createStatusService } = require('../src/backend/services/statusService');
const { STATUSES, TRANSITIONS, canTransition, computeDueDate } = require('../src/backend/services/rules');
const { makeFakes, ACTORS } = require('./helpers/fakes');
const { rejectsWith } = require('./helpers/assertions');

describe('Quy tắc chuyển trạng thái (BR6)', () => {
  it('chỉ có đúng 4 bước hợp lệ: Mới→Đã phân loại, Mới→Từ chối, Đã phân loại→Đã phân công, Đã phân công→Đang xử lý', () => {
    const allowed = [];
    for (const from of STATUSES) for (const to of STATUSES) if (canTransition(from, to)) allowed.push(`${from}>${to}`);
    assert.deepEqual(allowed.sort(), ['ASSIGNED>IN_PROGRESS', 'CLASSIFIED>ASSIGNED', 'NEW>CLASSIFIED', 'NEW>REJECTED']);
  });

  it('Đang xử lý và Từ chối là trạng thái cuối trong luồng L2, không quay lui', () => {
    assert.deepEqual(TRANSITIONS.IN_PROGRESS, []);
    assert.deepEqual(TRANSITIONS.REJECTED, []);
    assert.equal(canTransition('ASSIGNED', 'CLASSIFIED'), false);
  });

  it('computeDueDate từ chối mức ưu tiên lạ', () => {
    assert.throws(() => computeDueDate('URGENT', new Date()));
  });
});

describe('StatusService.changeStatus', () => {
  it('đổi trạng thái và ghi đúng 1 dòng lịch sử có người thực hiện (NFR5)', async () => {
    const f = makeFakes();
    const svc = createStatusService(f);
    const t = f.addTicket();
    await f.db.withTransaction((tx) =>
      svc.changeStatus(tx, { ticket: t, toStatus: 'REJECTED', actor: ACTORS.coordinator, note: 'Khách đổi ý' }));
    assert.equal(f.store.tickets[0].status, 'REJECTED');
    assert.equal(f.store.logs.length, 1);
    assert.deepEqual(
      { from: f.store.logs[0].fromStatus, to: f.store.logs[0].toStatus, by: f.store.logs[0].changedBy },
      { from: 'NEW', to: 'REJECTED', by: ACTORS.coordinator.id }
    );
  });

  it('UC03-4b: phiếu đã bị người khác đổi trạng thái → DATA_CHANGED và KHÔNG ghi lịch sử', async () => {
    const f = makeFakes();
    const svc = createStatusService(f);
    const t = f.addTicket();
    const staleCopy = { ...t };
    f.store.tickets[0].status = 'REJECTED'; // người khác vừa từ chối
    await rejectsWith(
      f.db.withTransaction((tx) => svc.changeStatus(tx, { ticket: staleCopy, toStatus: 'CLASSIFIED', actor: ACTORS.coordinator, fields: { priority: 'LOW' } })),
      'CONFLICT',
      'DATA_CHANGED'
    );
    assert.equal(f.store.logs.length, 0);
  });

  it('bước không hợp lệ → INVALID_TRANSITION, không gọi UPDATE', async () => {
    const f = makeFakes();
    let updates = 0;
    const svc = createStatusService({ ...f, ticketRepo: { updateStatus: async () => { updates += 1; return {}; } } });
    await rejectsWith(
      svc.changeStatus(f.TX, { ticket: { id: 1, status: 'NEW' }, toStatus: 'IN_PROGRESS', actor: ACTORS.coordinator }),
      'CONFLICT',
      'INVALID_TRANSITION'
    );
    assert.equal(updates, 0);
  });
});

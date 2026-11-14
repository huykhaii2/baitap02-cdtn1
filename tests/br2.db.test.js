// BR2 với CSDL thật (TD-04): một IMEI chỉ có một phiếu chưa đóng – được bảo vệ ở HAI tầng:
//   tầng 1: TicketService kiểm tra trước khi ghi; tầng 2: UNIQUE một phần ux_ticket_open_device trong CSDL.
// Chạy: npm run test:db (cần npm run migrate && npm run seed trước).
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { db, staffActor, makeCustomerWithDevice, cleanup } = require('./helpers/dbHelpers');
const { ticketService, classifyService } = require('../src/backend/services');

let receptionist;
let coordinator;

before(async () => {
  receptionist = await staffActor('tn1');
  coordinator = await staffActor('dp1');
});

after(async () => {
  await cleanup();
  await db.close();
});

describe('BR2 – một IMEI chỉ có một phiếu chưa đóng', () => {
  it('ca 1 – tầng nghiệp vụ: tạo phiếu thứ hai cho cùng IMEI → CONFLICT OPEN_TICKET_EXISTS, CSDL vẫn chỉ có 1 phiếu', async () => {
    const { phone, imei, deviceId } = await makeCustomerWithDevice();
    const first = await ticketService.create(receptionist, { phone, imei, issueDescription: 'Lần 1' });
    await assert.rejects(ticketService.create(receptionist, { phone, imei, issueDescription: 'Lần 2' }), (err) => {
      assert.equal(err.kind, 'CONFLICT');
      assert.equal(err.code, 'OPEN_TICKET_EXISTS');
      assert.equal(err.details.ticketCode, first.ticketCode);
      return true;
    });
    const { rows } = await db.query('SELECT COUNT(*)::int AS n FROM ticket WHERE device_id = $1', [deviceId]);
    assert.equal(rows[0].n, 1);
  });

  it('ca 2 – tầng CSDL: INSERT thẳng phiếu chưa đóng thứ hai (bỏ qua service) bị ux_ticket_open_device chặn', async () => {
    const { phone, imei, deviceId } = await makeCustomerWithDevice();
    await ticketService.create(receptionist, { phone, imei, issueDescription: 'Lần 1' });
    await assert.rejects(
      db.query(
        `INSERT INTO ticket (ticket_code, device_id, issue_description, status, created_by)
         VALUES ('BH-1999-000001', $1, 'Chèn thẳng', 'NEW', $2)`,
        [deviceId, receptionist.id]
      ),
      (err) => {
        assert.equal(err.code, '23505'); // unique_violation
        assert.equal(err.constraint, 'ux_ticket_open_device');
        return true;
      }
    );
  });

  it('ca 3 – phiếu cũ đã đóng (Từ chối) thì được tạo phiếu mới cho cùng IMEI', async () => {
    const { phone, imei, deviceId } = await makeCustomerWithDevice();
    const old = await ticketService.create(receptionist, { phone, imei, issueDescription: 'Lần 1' });
    await classifyService.reject(coordinator, old.ticketCode, { reason: 'Khách đổi ý' });
    const fresh = await ticketService.create(receptionist, { phone, imei, issueDescription: 'Lần 2' });
    assert.equal(fresh.status, 'NEW');
    assert.notEqual(fresh.ticketCode, old.ticketCode);
    const { rows } = await db.query(
      `SELECT status FROM ticket WHERE device_id = $1 ORDER BY id`, [deviceId]);
    assert.deepEqual(rows.map((r) => r.status), ['REJECTED', 'NEW']);
  });
});

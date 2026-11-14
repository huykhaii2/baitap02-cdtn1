// Unit test TicketService – UC01 tạo phiếu (FR1, BR1–BR3), UC04 danh sách (FR4), xem chi tiết. Không cần CSDL.
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createTicketService } = require('../src/backend/services/ticketService');
const { createStatusService } = require('../src/backend/services/statusService');
const { makeFakes, ACTORS } = require('./helpers/fakes');
const { rejectsWith } = require('./helpers/assertions');

let f;
let svc;
const NOW = new Date('2026-11-14T03:00:00Z');
const valid = { phone: '0901234567', imei: '356789012345678', issueDescription: 'Máy tự tắt khi còn 30% pin' };

function build(clock = () => NOW) {
  f = makeFakes();
  const statusService = createStatusService(f);
  svc = createTicketService({ ...f, statusService, clock });
}

describe('TicketService.create – luồng đúng (UC01)', () => {
  beforeEach(() => build());

  it('tạo phiếu Mới, sinh mã BH-YYYY-NNNNNN và ghi 1 dòng lịch sử → Mới (FR1, NFR5)', async () => {
    const t = await svc.create(ACTORS.receptionist, valid);
    assert.equal(t.ticketCode, 'BH-2026-000001');
    assert.equal(t.status, 'NEW');
    assert.equal(t.createdBy, ACTORS.receptionist.id);
    assert.equal(f.store.logs.length, 1);
    assert.deepEqual([f.store.logs[0].fromStatus, f.store.logs[0].toStatus], [null, 'NEW']);
  });

  it('chuẩn hoá SĐT có dấu cách / +84 và mô tả có khoảng trắng thừa', async () => {
    const t = await svc.create(ACTORS.receptionist, { ...valid, phone: '+84 901 234 567', issueDescription: '  Lỗi sạc  ' });
    assert.equal(t.customer.phone, '0901234567');
    assert.equal(t.issueDescription, 'Lỗi sạc');
  });

  it('mã phiếu tăng dần trong năm', async () => {
    await svc.create(ACTORS.receptionist, valid);
    const t2 = await svc.create(ACTORS.receptionist, { ...valid, imei: '356789012345679' });
    assert.equal(t2.ticketCode, 'BH-2026-000002');
  });

  it('năm của mã phiếu tính theo giờ Việt Nam (31/12 lúc 18:00 UTC đã là năm mới)', async () => {
    build(() => new Date('2026-12-31T18:00:00Z'));
    const t = await svc.create(ACTORS.receptionist, valid);
    assert.match(t.ticketCode, /^BH-2027-/);
  });

  it('3a: SĐT chưa có + gửi kèm họ tên → tạo khách hàng mới trong cùng giao dịch', async () => {
    const t = await svc.create(ACTORS.receptionist, {
      phone: '0912345678', imei: '359999000000001', issueDescription: 'Màn hình sọc',
      customer: { fullName: 'Trần Thị Mai' }, device: { model: 'Xiaomi 13', warrantyEndDate: '2027-01-01' },
    });
    assert.equal(t.customer.fullName, 'Trần Thị Mai');
    assert.equal(f.store.customers.length, 2);
    assert.equal(f.store.devices.length, 3);
  });

  it('5c / BR3: thiết bị hết hạn bảo hành vẫn tạo được phiếu và mang cờ warrantyExpired', async () => {
    const t = await svc.create(ACTORS.receptionist, { ...valid, imei: '356789012345679' });
    assert.equal(t.status, 'NEW');
    assert.equal(t.warrantyExpired, true);
  });
});

describe('TicketService.create – giá trị biên và dữ liệu sai', () => {
  beforeEach(() => build());

  for (const phone of ['090123456', '09012345678', '1901234567', 'abc', '']) {
    it(`2a: SĐT "${phone}" không hợp lệ → INVALID_PHONE`, async () => {
      await rejectsWith(svc.create(ACTORS.receptionist, { ...valid, phone }), 'INVALID_INPUT', 'INVALID_PHONE');
    });
  }

  it('4a: IMEI 14 chữ số → INVALID_IMEI; 16 chữ số → INVALID_IMEI', async () => {
    await rejectsWith(svc.create(ACTORS.receptionist, { ...valid, imei: '35678901234567' }), 'INVALID_INPUT', 'INVALID_IMEI');
    await rejectsWith(svc.create(ACTORS.receptionist, { ...valid, imei: '3567890123456789' }), 'INVALID_INPUT', 'INVALID_IMEI');
  });

  it('7a: mô tả lỗi chỉ có khoảng trắng → DESCRIPTION_REQUIRED', async () => {
    await rejectsWith(svc.create(ACTORS.receptionist, { ...valid, issueDescription: '   ' }), 'INVALID_INPUT', 'DESCRIPTION_REQUIRED');
  });

  it('mô tả 2000 ký tự được nhận, 2001 ký tự bị từ chối (biên)', async () => {
    await svc.create(ACTORS.receptionist, { ...valid, issueDescription: 'a'.repeat(2000) });
    await rejectsWith(
      svc.create(ACTORS.receptionist, { ...valid, imei: '356789012345679', issueDescription: 'a'.repeat(2001) }),
      'INVALID_INPUT',
      'DESCRIPTION_TOO_LONG'
    );
  });

  it('3a: SĐT chưa có và không gửi họ tên → CUSTOMER_NOT_FOUND, không tạo gì', async () => {
    await rejectsWith(svc.create(ACTORS.receptionist, { ...valid, phone: '0999888777' }), 'NOT_FOUND', 'CUSTOMER_NOT_FOUND');
    assert.equal(f.store.tickets.length, 0);
  });

  it('5a: IMEI chưa có và không gửi model/ngày hết hạn → DEVICE_NOT_FOUND', async () => {
    await rejectsWith(svc.create(ACTORS.receptionist, { ...valid, imei: '359999000000001' }), 'NOT_FOUND', 'DEVICE_NOT_FOUND');
  });

  it('5a: ngày hết hạn bảo hành không tồn tại (30/02) → INVALID_WARRANTY_END_DATE', async () => {
    await rejectsWith(
      svc.create(ACTORS.receptionist, { ...valid, imei: '359999000000001', device: { model: 'X', warrantyEndDate: '2027-02-30' } }),
      'INVALID_INPUT',
      'INVALID_WARRANTY_END_DATE'
    );
  });

  it('BR1: IMEI thuộc khách hàng khác → DEVICE_OWNED_BY_OTHER, rollback khách hàng vừa tạo', async () => {
    await rejectsWith(
      svc.create(ACTORS.receptionist, { ...valid, phone: '0912345678', customer: { fullName: 'Người khác' } }),
      'CONFLICT',
      'DEVICE_OWNED_BY_OTHER'
    );
    assert.equal(f.store.customers.length, 1, 'khách hàng tạo trong giao dịch lỗi phải bị huỷ');
  });

  it('5b / BR2: thiết bị đang có phiếu chưa đóng → OPEN_TICKET_EXISTS kèm mã phiếu', async () => {
    const first = await svc.create(ACTORS.receptionist, valid);
    await assert.rejects(svc.create(ACTORS.receptionist, valid), (err) => {
      assert.equal(err.code, 'OPEN_TICKET_EXISTS');
      assert.equal(err.details.ticketCode, first.ticketCode);
      return true;
    });
    assert.equal(f.store.tickets.length, 1);
  });

  it('NFR4: Điều phối viên và Kỹ thuật viên không được tạo phiếu', async () => {
    await rejectsWith(svc.create(ACTORS.coordinator, valid), 'NOT_ALLOWED', 'ROLE_NOT_ALLOWED');
    await rejectsWith(svc.create(ACTORS.tech1, valid), 'NOT_ALLOWED', 'ROLE_NOT_ALLOWED');
  });
});

describe('TicketService.list / getDetail (UC04)', () => {
  beforeEach(() => build());

  it('mặc định trang 1, 20 phiếu/trang (FR4)', async () => {
    const r = await svc.list(ACTORS.coordinator, {});
    assert.deepEqual([r.page, r.pageSize, r.totalPages], [1, 20, 1]);
    assert.equal(f.store.calls.list[0].offset, 0);
  });

  it('Kỹ thuật viên luôn bị lọc theo phiếu của chính mình', async () => {
    await svc.list(ACTORS.tech1, { status: 'ASSIGNED' });
    assert.equal(f.store.calls.list[0].assignedTo, ACTORS.tech1.id);
  });

  it('bộ lọc sai: trạng thái lạ, khoảng hạn ngược, pageSize 101', async () => {
    await rejectsWith(svc.list(ACTORS.coordinator, { status: 'DONE' }), 'INVALID_INPUT', 'INVALID_STATUS');
    await rejectsWith(svc.list(ACTORS.coordinator, { dueFrom: '2026-11-20', dueTo: '2026-11-01' }), 'INVALID_INPUT', 'INVALID_DATE_RANGE');
    await rejectsWith(svc.list(ACTORS.coordinator, { pageSize: '101' }), 'INVALID_INPUT', 'INVALID_PAGE_SIZE');
    await rejectsWith(svc.list(ACTORS.coordinator, { page: '0' }), 'INVALID_INPUT', 'INVALID_PAGE');
  });

  it('chi tiết: mã không tồn tại → TICKET_NOT_FOUND; kỹ thuật viên xem phiếu không phải của mình → NOT_ALLOWED', async () => {
    const t = f.addTicket({ status: 'ASSIGNED', assignedTo: ACTORS.tech2.id, issueCategoryId: 1, priority: 'LOW', dueDate: NOW });
    await rejectsWith(svc.getDetail(ACTORS.coordinator, 'BH-2026-999999'), 'NOT_FOUND', 'TICKET_NOT_FOUND');
    await rejectsWith(svc.getDetail(ACTORS.tech1, t.ticketCode), 'NOT_ALLOWED', 'TICKET_NOT_ASSIGNED_TO_YOU');
    const ok = await svc.getDetail(ACTORS.tech2, t.ticketCode.toLowerCase());
    assert.equal(ok.ticketCode, t.ticketCode);
  });
});

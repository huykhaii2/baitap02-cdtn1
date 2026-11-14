// Kiểm thử tích hợp qua HTTP với CSDL thật: luồng chính end-to-end, phân quyền (NFR4), CRUD S1/S2, lịch sử (NFR5).
// Chạy: npm run test:db (cần npm run migrate && npm run seed trước).
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/backend/app');
const { db, randomImei, randomPhone, track, cleanup } = require('./helpers/dbHelpers');

let server;
let base;
const tokens = {};

async function call(method, path, { token, body } = {}) {
  const res = await fetch(`${base}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

before(async () => {
  process.env.SECRET_KEY = process.env.SECRET_KEY || 'test-secret-key';
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  for (const u of ['tn1', 'dp1', 'kt1', 'kt2']) {
    const r = await call('POST', '/auth/login', { body: { username: u, password: 'Matkhau@123' } });
    assert.equal(r.status, 200, `Đăng nhập ${u} thất bại – đã chạy npm run seed chưa?`);
    tokens[u] = r.body.token;
  }
});

after(async () => {
  await cleanup();
  await new Promise((resolve) => server.close(resolve));
  await db.close();
});

describe('Xác thực', () => {
  it('GET /api/health → 200 khi CSDL chạy', async () => {
    const r = await call('GET', '/health');
    assert.deepEqual([r.status, r.body.db], [200, 'ok']);
  });

  it('kt3 (đã khoá) → 403 ACCOUNT_LOCKED; sai mật khẩu → 401; không token → 401 TOKEN_REQUIRED', async () => {
    assert.equal((await call('POST', '/auth/login', { body: { username: 'kt3', password: 'Matkhau@123' } })).body.error.code, 'ACCOUNT_LOCKED');
    assert.equal((await call('POST', '/auth/login', { body: { username: 'tn1', password: 'sai' } })).status, 401);
    const r = await call('GET', '/tickets');
    assert.deepEqual([r.status, r.body.error.code], [401, 'TOKEN_REQUIRED']);
  });
});

describe('Luồng chính UC01 → UC02 → UC03 → UC05 → UC06', () => {
  const phone = randomPhone();
  const imei = randomImei();
  let code;

  it('T1: Nhân viên tiếp nhận tạo phiếu, SĐT + IMEI mới → 201 (tạo luôn khách hàng và thiết bị)', async () => {
    const r = await call('POST', '/tickets', {
      token: tokens.tn1,
      body: { phone, imei, issueDescription: 'Màn hình sọc xanh', customer: { fullName: 'Khách E2E' }, device: { model: 'Máy E2E', warrantyEndDate: '2027-12-31' } },
    });
    assert.equal(r.status, 201);
    assert.match(r.body.ticketCode, /^BH-\d{4}-\d{6}$/);
    track('customers', r.body.customer.id);
    track('devices', r.body.device.id);
    code = r.body.ticketCode;
  });

  it('NFR4: Nhân viên tiếp nhận / Kỹ thuật viên gọi phân loại → 403, phiếu vẫn Mới', async () => {
    for (const u of ['tn1', 'kt1']) {
      const r = await call('POST', `/tickets/${code}/classify`, { token: tokens[u], body: { issueCategoryId: 1, priority: 'HIGH' } });
      assert.equal(r.status, 403);
    }
    assert.equal((await call('GET', `/tickets/${code}`, { token: tokens.dp1 })).body.status, 'NEW');
  });

  it('T4: thiếu danh mục → 400 ISSUE_CATEGORY_REQUIRED; mức ưu tiên lạ → 400 INVALID_PRIORITY', async () => {
    assert.equal((await call('POST', `/tickets/${code}/classify`, { token: tokens.dp1, body: { priority: 'HIGH' } })).body.error.code, 'ISSUE_CATEGORY_REQUIRED');
    assert.equal((await call('POST', `/tickets/${code}/classify`, { token: tokens.dp1, body: { issueCategoryId: 1, priority: 'X' } })).body.error.code, 'INVALID_PRIORITY');
  });

  it('T6 trước T4: phân công phiếu chưa phân loại → 409 INVALID_TRANSITION', async () => {
    const r = await call('POST', `/tickets/${code}/assign`, { token: tokens.dp1, body: { technicianId: 3 } });
    assert.deepEqual([r.status, r.body.error.code], [409, 'INVALID_TRANSITION']);
  });

  it('T4: Điều phối viên phân loại HIGH → 200, hạn xử lý ≈ +24 giờ (BR4)', async () => {
    const before = Date.now();
    const r = await call('POST', `/tickets/${code}/classify`, { token: tokens.dp1, body: { issueCategoryId: 1, priority: 'HIGH' } });
    assert.equal(r.status, 200);
    assert.equal(r.body.status, 'CLASSIFIED');
    const hours = (new Date(r.body.dueDate).getTime() - before) / 3600e3;
    assert.ok(hours > 23.9 && hours < 24.1, `hạn xử lý lệch: ${hours} giờ`);
  });

  it('T6: thiếu kỹ thuật viên → 400 TECHNICIAN_REQUIRED; phân công kt1 → 200 ASSIGNED', async () => {
    assert.equal((await call('POST', `/tickets/${code}/assign`, { token: tokens.dp1, body: {} })).body.error.code, 'TECHNICIAN_REQUIRED');
    const techs = (await call('GET', '/technicians', { token: tokens.dp1 })).body;
    const kt1 = techs.find((t) => t.username === 'kt1');
    const r = await call('POST', `/tickets/${code}/assign`, { token: tokens.dp1, body: { technicianId: kt1.id } });
    assert.deepEqual([r.status, r.body.status, r.body.assignee.fullName], [200, 'ASSIGNED', 'Phạm Huy']);
  });

  it('kt2 không xem được phiếu của kt1 (403) và danh sách của kt2 không chứa phiếu này', async () => {
    assert.equal((await call('GET', `/tickets/${code}`, { token: tokens.kt2 })).status, 403);
    const list = await call('GET', `/tickets?q=${code}`, { token: tokens.kt2 });
    assert.equal(list.body.total, 0);
  });

  it('T7: kt1 xác nhận nhận phiếu → IN_PROGRESS; T8: lịch sử đúng 4 dòng theo thứ tự (NFR5)', async () => {
    const r = await call('POST', `/tickets/${code}/acknowledge`, { token: tokens.kt1 });
    assert.equal(r.body.status, 'IN_PROGRESS');
    const h = await call('GET', `/tickets/${code}/history`, { token: tokens.dp1 });
    assert.deepEqual(h.body.map((l) => l.toStatus), ['NEW', 'CLASSIFIED', 'ASSIGNED', 'IN_PROGRESS']);
    assert.deepEqual(h.body.map((l) => l.changedBy.role), ['RECEPTIONIST', 'COORDINATOR', 'COORDINATOR', 'TECHNICIAN']);
  });

  it('T2: tìm theo mã phiếu và lọc theo trạng thái trả đúng phiếu, phân trang 20/trang', async () => {
    const r = await call('GET', `/tickets?q=${code}&status=IN_PROGRESS`, { token: tokens.dp1 });
    assert.equal(r.body.total, 1);
    assert.equal(r.body.items[0].ticketCode, code);
    assert.equal(r.body.pageSize, 20);
  });

  it('không có API sửa / xoá phiếu (BR6)', async () => {
    assert.equal((await call('DELETE', `/tickets/${code}`, { token: tokens.tn1 })).status, 404);
    assert.equal((await call('PUT', `/tickets/${code}`, { token: tokens.tn1, body: {} })).status, 404);
  });
});

describe('CRUD khách hàng (S1) và thiết bị (S2)', () => {
  it('tạo → sửa → thêm thiết bị → xoá khách bị 409 → xoá thiết bị 204 → xoá khách 204', async () => {
    const c = await call('POST', '/customers', { token: tokens.tn1, body: { fullName: 'Khách CRUD', phone: randomPhone() } });
    assert.equal(c.status, 201);
    track('customers', c.body.id);
    const u = await call('PUT', `/customers/${c.body.id}`, { token: tokens.tn1, body: { fullName: 'Khách CRUD (sửa)', phone: c.body.phone } });
    assert.equal(u.body.fullName, 'Khách CRUD (sửa)');
    const d = await call('POST', '/devices', { token: tokens.tn1, body: { customerId: c.body.id, imei: randomImei(), model: 'Máy CRUD', warrantyEndDate: '2027-01-31' } });
    assert.equal(d.status, 201);
    track('devices', d.body.id);
    const blocked = await call('DELETE', `/customers/${c.body.id}`, { token: tokens.tn1 });
    assert.deepEqual([blocked.status, blocked.body.error.code], [409, 'CUSTOMER_HAS_DEVICES']);
    assert.equal((await call('DELETE', `/devices/${d.body.id}`, { token: tokens.tn1 })).status, 204);
    assert.equal((await call('DELETE', `/customers/${c.body.id}`, { token: tokens.tn1 })).status, 204);
    assert.equal((await call('GET', `/customers/${c.body.id}`, { token: tokens.tn1 })).status, 404);
  });

  it('SĐT trùng → 409 PHONE_EXISTS; IMEI trùng → 409 IMEI_EXISTS', async () => {
    assert.equal((await call('POST', '/customers', { token: tokens.tn1, body: { fullName: 'X', phone: '0901234567' } })).body.error.code, 'PHONE_EXISTS');
    assert.equal(
      (await call('POST', '/devices', { token: tokens.tn1, body: { customerId: 1, imei: '356789012345678', model: 'X', warrantyEndDate: '2027-01-01' } })).body.error.code,
      'IMEI_EXISTS'
    );
  });

  it('Điều phối viên đọc được (200) nhưng không ghi được (403)', async () => {
    assert.equal((await call('GET', '/customers', { token: tokens.dp1 })).status, 200);
    assert.equal((await call('POST', '/customers', { token: tokens.dp1, body: { fullName: 'X', phone: randomPhone() } })).status, 403);
  });

  it('xoá thiết bị đã có phiếu → 409 DEVICE_HAS_TICKETS', async () => {
    const dev = (await call('GET', '/devices/by-imei/354100000007919', { token: tokens.tn1 })).body; // thiết bị mẫu có phiếu
    const r = await call('DELETE', `/devices/${dev.id}`, { token: tokens.tn1 });
    assert.deepEqual([r.status, r.body.error.code], [409, 'DEVICE_HAS_TICKETS']);
  });
});

#!/usr/bin/env node
// Chạy từng test case của docs/test-report.md với máy chủ + CSDL thật và in đủ: dữ liệu thử · lệnh gọi · kết quả · đếm trước / sau.
//   node scripts/tc.js TC-05      # một test case
//   node scripts/tc.js all        # cả 12
// Cần: npm run migrate && npm run seed, và npm start đang chạy ở terminal khác (đổi địa chỉ bằng BASE_URL).
// Mỗi lần chạy tự tạo khách hàng / thiết bị mới (SĐT, IMEI ngẫu nhiên) nên chạy lại được nhiều lần.
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const PASSWORD = 'Matkhau@123';

// ---------- tiện ích in ----------
const B = (s) => `\x1b[1m${s}\x1b[0m`;
const G = (s) => `\x1b[32m${s}\x1b[0m`;
const R = (s) => `\x1b[31m${s}\x1b[0m`;
const D = (s) => `\x1b[2m${s}\x1b[0m`;
let checks = [];
const say = (s = '') => console.log(s);
function check(label, ok, actual) {
  checks.push(ok);
  say(`${ok ? G('✔') : R('✘')} ${label}${actual !== undefined ? D(`  (thực tế: ${actual})`) : ''}`);
}
const now = () => new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });

// ---------- tiện ích gọi API ----------
async function api(method, path, { token, body } = {}, show = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (show) say(`${D('$')} ${method} /api${path}${body !== undefined ? ` ${JSON.stringify(body)}` : ''}${token ? D('  [token]') : ''}`);
  const res = await fetch(`${BASE}/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (show) {
    const brief = data && data.error ? `${data.error.code} – ${data.error.message}` : summary(data);
    say(`  → HTTP ${res.status}${brief ? ` · ${brief}` : ''}`);
  }
  return { status: res.status, body: data };
}

function summary(d) {
  if (!d) return '';
  if (d.token) return `token=${d.token.slice(0, 16)}… · ${d.staff.fullName} (${d.staff.role})`;
  if (d.ticketCode) return `${d.ticketCode} · status=${d.status}${d.priority ? ` · priority=${d.priority}` : ''}${d.assignee ? ` · kỹ thuật viên=${d.assignee.fullName}` : ''}`;
  if (Array.isArray(d.items)) return `total=${d.total} · page=${d.page}/${d.totalPages}`;
  if (Array.isArray(d)) return `${d.length} dòng`;
  if (d.fullName && d.phone) return `khách hàng #${d.id} ${d.fullName} · ${d.phone}`;
  if (d.imei) return `thiết bị #${d.id} ${d.imei} · ${d.model}`;
  return '';
}

const tokens = {};
async function login(u) {
  if (!tokens[u]) {
    const r = await api('POST', '/auth/login', { body: { username: u, password: PASSWORD } }, false);
    if (r.status !== 200) throw new Error(`Không đăng nhập được ${u} – đã chạy npm run seed chưa?`);
    tokens[u] = r.body.token;
  }
  return tokens[u];
}
const digits = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');
const newPhone = () => `09${digits(8)}`;
const newImei = () => `97${digits(13)}`;
const countTickets = async () => (await api('GET', '/tickets?pageSize=1', { token: await login('dp1') }, false)).body.total;
const countCustomers = async () => (await api('GET', '/customers?pageSize=1', { token: await login('tn1') }, false)).body.total;

// Tiền điều kiện dùng chung: một khách hàng + một thiết bị còn hạn bảo hành, tạo mới qua API.
async function setupCustomerDevice(label = 'Khách TC') {
  const tn = await login('tn1');
  const c = await api('POST', '/customers', { token: tn, body: { fullName: label, phone: newPhone() } }, false);
  const d = await api('POST', '/devices', { token: tn, body: { customerId: c.body.id, imei: newImei(), model: 'Samsung Galaxy A35', warrantyEndDate: '2027-12-31' } }, false);
  say(D(`Tiền điều kiện (tự tạo): khách ${c.body.fullName} – ${c.body.phone}, thiết bị IMEI ${d.body.imei}`));
  return { customer: c.body, device: d.body };
}
async function setupTicket(stage = 'NEW') {
  const { customer, device } = await setupCustomerDevice();
  const t = await api('POST', '/tickets', { token: await login('tn1'), body: { phone: customer.phone, imei: device.imei, issueDescription: 'Máy không nhận sạc' } }, false);
  let code = t.body.ticketCode;
  if (stage !== 'NEW') await api('POST', `/tickets/${code}/classify`, { token: await login('dp1'), body: { issueCategoryId: 1, priority: 'HIGH' } }, false);
  if (stage === 'ASSIGNED') {
    const kt1 = (await api('GET', '/technicians', { token: await login('dp1') }, false)).body.find((s) => s.username === 'kt1');
    await api('POST', `/tickets/${code}/assign`, { token: await login('dp1'), body: { technicianId: kt1.id } }, false);
  }
  say(D(`Tiền điều kiện (tự tạo): phiếu ${code} ở trạng thái ${stage}`));
  return { code, customer, device };
}

// ---------- 12 test case ----------
const TC = {
  'TC-01': ['Đăng nhập · luồng đúng · A1', async () => {
    for (const [u, role] of [['tn1', 'RECEPTIONIST'], ['dp1', 'COORDINATOR'], ['kt1', 'TECHNICIAN']]) {
      const r = await api('POST', '/auth/login', { body: { username: u, password: PASSWORD } });
      check(`${u}: HTTP 200, có token, vai trò ${role}`, r.status === 200 && !!r.body.token && r.body.staff.role === role, `${r.status} · ${r.body.staff && r.body.staff.role}`);
      check(`${u}: không trả password_hash`, r.body.staff && r.body.staff.passwordHash === undefined);
    }
  }],

  'TC-02': ['Đăng nhập · dữ liệu sai + tài khoản khoá · A1', async () => {
    let r = await api('POST', '/auth/login', { body: { username: 'tn1', password: 'sai-mat-khau' } });
    check('Sai mật khẩu → 401 INVALID_CREDENTIALS, không có token', r.status === 401 && r.body.error.code === 'INVALID_CREDENTIALS' && !r.body.token, r.status);
    r = await api('POST', '/auth/login', { body: { username: 'khong-ton-tai', password: PASSWORD } });
    check('Sai tên đăng nhập → cùng thông báo 401 (không lộ tài khoản tồn tại)', r.status === 401 && r.body.error.code === 'INVALID_CREDENTIALS', r.status);
    r = await api('POST', '/auth/login', { body: { username: 'kt3', password: PASSWORD } });
    check('kt3 đã khoá → 403 ACCOUNT_LOCKED', r.status === 403 && r.body.error.code === 'ACCOUNT_LOCKED', r.status);
    r = await api('POST', '/auth/login', { body: { username: '', password: '' } });
    check('Để trống → 400 CREDENTIALS_REQUIRED', r.status === 400 && r.body.error.code === 'CREDENTIALS_REQUIRED', r.status);
  }],

  'TC-03': ['Tra cứu khách hàng theo SĐT · luồng đúng + ngoại lệ 2a, 3a · UC07', async () => {
    const tn = await login('tn1');
    let r = await api('GET', `/customers/by-phone/${encodeURIComponent('0901 234 567')}`, { token: tn });
    check('SĐT có dấu cách "0901 234 567" → 200, đúng khách Nguyễn Văn An', r.status === 200 && r.body.fullName === 'Nguyễn Văn An', `${r.status} · ${r.body.fullName}`);
    r = await api('GET', `/customers/by-phone/${encodeURIComponent('+84901234567')}`, { token: tn });
    check('Dạng +84 → chuẩn hoá về 0901234567, tìm thấy cùng khách', r.status === 200 && r.body.phone === '0901234567', r.status);
    r = await api('GET', '/customers/by-phone/090123', { token: tn });
    check('2a: SĐT 6 chữ số → 400 INVALID_PHONE', r.status === 400 && r.body.error.code === 'INVALID_PHONE', r.status);
    r = await api('GET', '/customers/by-phone/0999000999', { token: tn });
    check('3a: SĐT hợp lệ nhưng chưa có → 404 CUSTOMER_NOT_FOUND', r.status === 404 && r.body.error.code === 'CUSTOMER_NOT_FOUND', r.status);
  }],

  'TC-04': ['Tạo phiếu bảo hành · luồng đúng · UC01, FR1, BR1', async () => {
    const { customer, device } = await setupCustomerDevice();
    const before = await countTickets();
    say(`Số phiếu trước: ${before}`);
    const r = await api('POST', '/tickets', { token: await login('tn1'), body: { phone: customer.phone, imei: device.imei, issueDescription: 'Máy tự tắt khi còn 30% pin' } });
    const after = await countTickets();
    say(`Số phiếu sau:   ${after}`);
    check('HTTP 201', r.status === 201, r.status);
    check('Mã phiếu dạng BH-YYYY-NNNNNN', /^BH-\d{4}-\d{6}$/.test(r.body.ticketCode), r.body.ticketCode);
    check('Trạng thái Mới (NEW), gắn đúng khách hàng + thiết bị (BR1)', r.body.status === 'NEW' && r.body.customer.phone === customer.phone && r.body.device.imei === device.imei);
    check('Số phiếu +1', after === before + 1, `${before} → ${after}`);
    const h = await api('GET', `/tickets/${r.body.ticketCode}/history`, { token: await login('tn1') });
    check('Lịch sử có đúng 1 dòng → NEW do Lê Thu tạo (NFR5)', h.body.length === 1 && h.body[0].toStatus === 'NEW' && h.body[0].changedBy.fullName === 'Lê Thu');
  }],

  'TC-05': ['Tạo phiếu · giá trị biên IMEI 14 / 15 / 16 chữ số · UC01-4a', async () => {
    const tn = await login('tn1');
    const phone = newPhone();
    const before = await countTickets();
    say(`Số phiếu trước: ${before}   (dữ liệu thử: khách mới ${phone})`);
    const base = { phone, issueDescription: 'Màn hình sọc', customer: { fullName: 'Khách TC05' }, device: { model: 'Xiaomi 13', warrantyEndDate: '2027-06-30' } };
    let r = await api('POST', '/tickets', { token: tn, body: { ...base, imei: digits(14) } });
    check('IMEI 14 chữ số → 400 INVALID_IMEI', r.status === 400 && r.body.error.code === 'INVALID_IMEI', r.status);
    r = await api('POST', '/tickets', { token: tn, body: { ...base, imei: digits(16) } });
    check('IMEI 16 chữ số → 400 INVALID_IMEI', r.status === 400 && r.body.error.code === 'INVALID_IMEI', r.status);
    const mid = await countTickets();
    check('Hai lần bị từ chối không tạo phiếu nào', mid === before, `${before} → ${mid}`);
    r = await api('POST', '/tickets', { token: tn, body: { ...base, imei: newImei() } });
    check('IMEI đúng 15 chữ số → 201, phiếu Mới', r.status === 201 && r.body.status === 'NEW', `${r.status} · ${r.body.ticketCode}`);
    const after = await countTickets();
    say(`Số phiếu sau:   ${after}`);
    check('Số phiếu chỉ +1', after === before + 1, `${before} → ${after}`);
  }],

  'TC-06': ['Tạo phiếu · vi phạm BR2 (một IMEI một phiếu chưa đóng) · BR2, UC01-5b', async () => {
    const { code, customer, device } = await setupTicket('NEW');
    const before = await countTickets();
    say(`Số phiếu trước: ${before}`);
    const r = await api('POST', '/tickets', { token: await login('tn1'), body: { phone: customer.phone, imei: device.imei, issueDescription: 'Tạo lần 2' } });
    check('Tầng nghiệp vụ: 409 OPEN_TICKET_EXISTS, chỉ ra phiếu đang mở', r.status === 409 && r.body.error.code === 'OPEN_TICKET_EXISTS' && r.body.error.details.ticketCode === code, `${r.status} · ${r.body.error && r.body.error.details.ticketCode}`);
    const after = await countTickets();
    check('Số phiếu không đổi', after === before, `${before} → ${after}`);
    // Tầng CSDL: chèn thẳng (bỏ qua service) rồi ROLLBACK – không để lại dữ liệu.
    const db = require('../src/backend/config/db');
    const client = await db.getPool().connect();
    try {
      await client.query('BEGIN');
      say(`${D('$')} SQL: INSERT INTO ticket (…device_id = thiết bị ${device.imei}, status = 'NEW'…)  ${D('[bỏ qua service, sau đó ROLLBACK]')}`);
      let err = null;
      try {
        await client.query(
          `INSERT INTO ticket (ticket_code, device_id, issue_description, status, created_by)
           VALUES ('BH-1999-000001', $1, 'chèn thẳng', 'NEW', (SELECT id FROM staff WHERE username = 'tn1'))`, [device.id]);
      } catch (e) { err = e; }
      say(`  → ${err ? `lỗi ${err.code} · constraint ${err.constraint}` : 'chèn được (SAI)'}`);
      check('Tầng CSDL: UNIQUE một phần ux_ticket_open_device chặn (23505)', !!err && err.code === '23505' && err.constraint === 'ux_ticket_open_device');
    } finally {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
      await db.close();
    }
  }],

  'TC-07': ['Phân loại phiếu · luồng đúng, hạn xử lý theo BR4 · UC02, FR2, BR4', async () => {
    const { code } = await setupTicket('NEW');
    const t0 = Date.now();
    const r = await api('POST', `/tickets/${code}/classify`, { token: await login('dp1'), body: { issueCategoryId: 2, priority: 'HIGH' } });
    const hours = (new Date(r.body.dueDate).getTime() - t0) / 3600e3;
    check('HTTP 200, trạng thái Đã phân loại (CLASSIFIED)', r.status === 200 && r.body.status === 'CLASSIFIED', `${r.status} · ${r.body.status}`);
    check('Danh mục Pin, mức ưu tiên Cao', r.body.issueCategory.name === 'Pin' && r.body.priority === 'HIGH');
    check('Hạn xử lý = lúc phân loại + 24 giờ (BR4)', hours > 23.9 && hours < 24.1, `${hours.toFixed(3)} giờ`);
    const h = await api('GET', `/tickets/${code}/history`, { token: await login('dp1') });
    check('Lịch sử thêm dòng NEW → CLASSIFIED do Trần Minh', h.body.length === 2 && h.body[1].fromStatus === 'NEW' && h.body[1].toStatus === 'CLASSIFIED' && h.body[1].changedBy.fullName === 'Trần Minh');
  }],

  'TC-08': ['Phân loại phiếu · dữ liệu sai · TD-11', async () => {
    const { code } = await setupTicket('NEW');
    const dp = await login('dp1');
    let r = await api('POST', `/tickets/${code}/classify`, { token: dp, body: { priority: 'HIGH' } });
    check('Thiếu danh mục → 400 ISSUE_CATEGORY_REQUIRED', r.status === 400 && r.body.error.code === 'ISSUE_CATEGORY_REQUIRED', r.status);
    r = await api('POST', `/tickets/${code}/classify`, { token: dp, body: { issueCategoryId: 999, priority: 'HIGH' } });
    check('Danh mục không tồn tại → 400 ISSUE_CATEGORY_INVALID', r.status === 400 && r.body.error.code === 'ISSUE_CATEGORY_INVALID', r.status);
    r = await api('POST', `/tickets/${code}/classify`, { token: dp, body: { issueCategoryId: 1, priority: 'URGENT' } });
    check('Mức ưu tiên lạ → 400 INVALID_PRIORITY', r.status === 400 && r.body.error.code === 'INVALID_PRIORITY', r.status);
    const t = await api('GET', `/tickets/${code}`, { token: dp });
    const h = await api('GET', `/tickets/${code}/history`, { token: dp }, false);
    check('Phiếu vẫn Mới, lịch sử vẫn 1 dòng (không ghi gì)', t.body.status === 'NEW' && h.body.length === 1, `${t.body.status} · ${h.body.length} dòng`);
  }],

  'TC-09': ['Phân công + kỹ thuật viên nhận phiếu · luồng đúng · UC03, UC05, UC06', async () => {
    const { code } = await setupTicket('CLASSIFIED');
    const dp = await login('dp1');
    const techs = await api('GET', '/technicians', { token: dp });
    const kt1 = techs.body.find((s) => s.username === 'kt1');
    check('L2 chỉ liệt kê kỹ thuật viên đang hoạt động (không có kt3)', techs.body.every((s) => s.username !== 'kt3'), techs.body.map((s) => s.username).join(', '));
    let r = await api('POST', `/tickets/${code}/assign`, { token: dp, body: { technicianId: kt1.id } });
    check('Phân công Phạm Huy → 200, Đã phân công (ASSIGNED)', r.status === 200 && r.body.status === 'ASSIGNED' && r.body.assignee.fullName === 'Phạm Huy', `${r.status} · ${r.body.status}`);
    r = await api('POST', `/tickets/${code}/acknowledge`, { token: await login('kt1') });
    check('kt1 xác nhận nhận phiếu → 200, Đang xử lý (IN_PROGRESS)', r.status === 200 && r.body.status === 'IN_PROGRESS', `${r.status} · ${r.body.status}`);
    const h = await api('GET', `/tickets/${code}/history`, { token: dp });
    say(h.body.map((l) => `    ${l.fromStatus || '—'} → ${l.toStatus}  (${l.changedBy.fullName})  ${l.note || ''}`).join('\n'));
    check('Lịch sử đủ 4 dòng đúng thứ tự NEW → CLASSIFIED → ASSIGNED → IN_PROGRESS', h.body.map((l) => l.toStatus).join() === 'NEW,CLASSIFIED,ASSIGNED,IN_PROGRESS');
  }],

  'TC-10': ['Phân quyền · bảo mật (OWASP A01 – Broken Access Control) · NFR4, BR5', async () => {
    const { code } = await setupTicket('ASSIGNED');
    const fresh = await setupTicket('NEW');
    let r = await api('POST', `/tickets/${fresh.code}/classify`, { token: await login('tn1'), body: { issueCategoryId: 1, priority: 'HIGH' } });
    check('Nhân viên tiếp nhận gọi phân loại → 403 ROLE_NOT_ALLOWED', r.status === 403 && r.body.error.code === 'ROLE_NOT_ALLOWED', r.status);
    const after = await api('GET', `/tickets/${fresh.code}`, { token: await login('dp1') }, false);
    check('… và phiếu vẫn Mới', after.body.status === 'NEW', after.body.status);
    r = await api('GET', `/tickets/${code}`, { token: await login('kt2') });
    check('kt2 mở phiếu đã giao cho kt1 → 403 TICKET_NOT_ASSIGNED_TO_YOU', r.status === 403 && r.body.error.code === 'TICKET_NOT_ASSIGNED_TO_YOU', r.status);
    r = await api('POST', '/customers', { token: await login('dp1'), body: { fullName: 'X', phone: newPhone() } });
    check('Điều phối viên thêm khách hàng → 403 (chỉ được xem)', r.status === 403, r.status);
    r = await api('GET', '/tickets');
    check('Không có token → 401 TOKEN_REQUIRED', r.status === 401 && r.body.error.code === 'TOKEN_REQUIRED', r.status);
    const forged = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from('{"sub":2,"role":"COORDINATOR"}').toString('base64url')}.chu-ky-gia`;
    r = await api('GET', '/tickets', { token: forged });
    check('Token giả mạo vai trò Điều phối viên → 401 TOKEN_INVALID', r.status === 401 && r.body.error.code === 'TOKEN_INVALID', r.status);
  }],

  'TC-11': ['Danh sách phiếu · lọc, phân trang, chống SQL injection · UC04, FR4', async () => {
    const dp = await login('dp1');
    const all = await api('GET', '/tickets', { token: dp });
    check('Mặc định trang 1, 20 phiếu/trang', all.status === 200 && all.body.page === 1 && all.body.pageSize === 20 && all.body.items.length <= 20, `total=${all.body.total}`);
    let r = await api('GET', '/tickets?status=CLASSIFIED&priority=HIGH', { token: dp });
    check('Lọc Đã phân loại + Cao: mọi dòng đúng điều kiện', r.status === 200 && r.body.items.every((t) => t.status === 'CLASSIFIED' && t.priority === 'HIGH'), `${r.body.total} phiếu`);
    const over = r.body.items.filter((t) => t.overdue).map((t) => t.ticketCode);
    say(`    phiếu quá hạn được đánh dấu: ${over.join(', ') || '(không có)'}`);
    r = await api('GET', `/tickets?q=${encodeURIComponent("' OR '1'='1")}`, { token: dp });
    check("q = ' OR '1'='1 → 200, total = 0 (SQL tham số hoá, không lộ dữ liệu)", r.status === 200 && r.body.total === 0, `total=${r.body.total} trong khi CSDL có ${all.body.total}`);
    r = await api('GET', '/tickets?pageSize=101', { token: dp });
    check('pageSize = 101 (vượt biên 100) → 400 INVALID_PAGE_SIZE', r.status === 400 && r.body.error.code === 'INVALID_PAGE_SIZE', r.status);
    r = await api('GET', '/tickets?dueFrom=2026-12-31&dueTo=2026-01-01', { token: dp });
    check('Hạn từ > hạn đến → 400 INVALID_DATE_RANGE', r.status === 400 && r.body.error.code === 'INVALID_DATE_RANGE', r.status);
  }],

  'TC-12': ['Khách hàng & thiết bị · CRUD, ràng buộc xoá · S1, S2, TD-13', async () => {
    const tn = await login('tn1');
    const before = await countCustomers();
    say(`Số khách hàng trước: ${before}`);
    const c = await api('POST', '/customers', { token: tn, body: { fullName: 'Khách TC12', phone: newPhone() } });
    check('Thêm khách → 201', c.status === 201, c.status);
    const u = await api('PUT', `/customers/${c.body.id}`, { token: tn, body: { fullName: 'Khách TC12 (đã sửa)', phone: c.body.phone } });
    check('Sửa họ tên → 200', u.status === 200 && u.body.fullName === 'Khách TC12 (đã sửa)', u.status);
    const d = await api('POST', '/devices', { token: tn, body: { customerId: c.body.id, imei: newImei(), model: 'Oppo A79', warrantyEndDate: '2027-03-31' } });
    check('Thêm thiết bị → 201', d.status === 201, d.status);
    let r = await api('DELETE', `/customers/${c.body.id}`, { token: tn });
    check('Xoá khách còn thiết bị → 409 CUSTOMER_HAS_DEVICES', r.status === 409 && r.body.error.code === 'CUSTOMER_HAS_DEVICES', r.status);
    r = await api('DELETE', `/devices/${d.body.id}`, { token: tn });
    check('Xoá thiết bị chưa có phiếu → 204', r.status === 204, r.status);
    r = await api('DELETE', `/customers/${c.body.id}`, { token: tn });
    check('Xoá khách (đã hết thiết bị) → 204', r.status === 204, r.status);
    const after = await countCustomers();
    say(`Số khách hàng sau:   ${after}`);
    check('Số khách hàng trở về như trước', after === before, `${before} → ${after}`);
    const seeded = await api('GET', '/devices/by-imei/354100000007919', { token: tn }, false);
    r = await api('DELETE', `/devices/${seeded.body.id}`, { token: tn });
    check('Xoá thiết bị đã có phiếu → 409 DEVICE_HAS_TICKETS (BR6)', r.status === 409 && r.body.error.code === 'DEVICE_HAS_TICKETS', r.status);
  }],
};

async function run(id) {
  const [title, fn] = TC[id];
  checks = [];
  say();
  say(B(`════ ${id} · ${title} ════`));
  say(D(now()));
  try {
    await fn();
  } catch (err) {
    checks.push(false);
    say(R(`Lỗi khi chạy: ${err.message}`));
    if (err.cause && err.cause.code === 'ECONNREFUSED') say(R(`Máy chủ chưa chạy ở ${BASE} – chạy npm start ở terminal khác.`));
  }
  const ok = checks.length > 0 && checks.every(Boolean);
  say(B(`KẾT QUẢ ${id}: ${ok ? G('PASS') : R('FAIL')} (${checks.filter(Boolean).length}/${checks.length} kiểm tra đạt)`));
  return ok;
}

(async () => {
  const arg = (process.argv[2] || '').toUpperCase();
  const ids = arg === 'ALL' ? Object.keys(TC) : Object.keys(TC).filter((k) => k === arg);
  if (!ids.length) {
    console.log('Cách dùng: node scripts/tc.js TC-01 … TC-12   hoặc   node scripts/tc.js all');
    process.exit(2);
  }
  const results = [];
  for (const id of ids) results.push([id, await run(id)]);
  if (ids.length > 1) {
    say();
    say(B(`TỔNG KẾT: ${results.filter((r) => r[1]).length}/${results.length} PASS`));
  }
  process.exit(results.every((r) => r[1]) ? 0 : 1);
})();

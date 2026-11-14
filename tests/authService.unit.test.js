// Unit test AuthService – A1 đăng nhập, xác thực token.
const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createAuthService } = require('../src/backend/services/authService');
const { makeFakes } = require('./helpers/fakes');
const { rejectsWith } = require('./helpers/assertions');

const config = () => ({ secretKey: 'unit-test-secret', tokenExpiresIn: '1h' });
let svc;

before(() => {
  const f = makeFakes();
  f.store.passwordHash = bcrypt.hashSync('Matkhau@123', 4);
  svc = createAuthService({ staffRepo: f.staffRepo, getAuthConfig: config });
});

describe('AuthService', () => {
  it('đăng nhập đúng → token mang id và vai trò, không trả password_hash', async () => {
    const r = await svc.login({ username: ' DP1 ', password: 'Matkhau@123' });
    assert.equal(r.staff.role, 'COORDINATOR');
    assert.equal(r.staff.passwordHash, undefined);
    const payload = jwt.verify(r.token, 'unit-test-secret');
    assert.deepEqual([payload.sub, payload.role], [2, 'COORDINATOR']);
  });

  it('sai mật khẩu hoặc sai tên → cùng một lỗi INVALID_CREDENTIALS', async () => {
    await rejectsWith(svc.login({ username: 'dp1', password: 'sai' }), 'NOT_AUTHENTICATED', 'INVALID_CREDENTIALS');
    await rejectsWith(svc.login({ username: 'khongco', password: 'Matkhau@123' }), 'NOT_AUTHENTICATED', 'INVALID_CREDENTIALS');
  });

  it('tài khoản đã khoá → ACCOUNT_LOCKED; thiếu dữ liệu → CREDENTIALS_REQUIRED', async () => {
    await rejectsWith(svc.login({ username: 'kt3', password: 'Matkhau@123' }), 'NOT_ALLOWED', 'ACCOUNT_LOCKED');
    await rejectsWith(svc.login({ username: 'dp1' }), 'INVALID_INPUT', 'CREDENTIALS_REQUIRED');
  });

  it('verifyToken: token hợp lệ → actor; token sai chữ ký / hết hạn → TOKEN_INVALID', async () => {
    const { token } = await svc.login({ username: 'kt1', password: 'Matkhau@123' });
    assert.deepEqual(svc.verifyToken(token), { id: 3, role: 'TECHNICIAN', fullName: 'Phạm Huy' });
    const forged = jwt.sign({ sub: 2, role: 'COORDINATOR' }, 'khoa-khac');
    const expired = jwt.sign({ sub: 2, role: 'COORDINATOR', exp: Math.floor(Date.now() / 1000) - 10 }, 'unit-test-secret');
    assert.throws(() => svc.verifyToken(forged), (e) => e.code === 'TOKEN_INVALID');
    assert.throws(() => svc.verifyToken(expired), (e) => e.code === 'TOKEN_INVALID');
  });
});

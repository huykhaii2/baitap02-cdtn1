// AuthService – A1 đăng nhập: kiểm tra mật khẩu (bcrypt) và cấp token (JWT).
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { invalidInput, notAuthenticated, notAllowed } = require('../errors/AppError');

function createAuthService({ staffRepo, getAuthConfig }) {
  async function login(input = {}) {
    const username = typeof input.username === 'string' ? input.username.trim().toLowerCase() : '';
    const password = typeof input.password === 'string' ? input.password : '';
    if (!username || !password) {
      throw invalidInput('CREDENTIALS_REQUIRED', 'Vui lòng nhập tên đăng nhập và mật khẩu.');
    }
    const staff = await staffRepo.findByUsernameWithHash(null, username);
    // Cùng một thông báo cho "sai tên" và "sai mật khẩu" để không lộ tài khoản nào tồn tại.
    if (!staff || !(await bcrypt.compare(password, staff.passwordHash))) {
      throw notAuthenticated('INVALID_CREDENTIALS', 'Tên đăng nhập hoặc mật khẩu không đúng.');
    }
    if (!staff.isActive) {
      throw notAllowed('ACCOUNT_LOCKED', 'Tài khoản đã bị khoá. Liên hệ quản lý trung tâm.');
    }
    const { secretKey, tokenExpiresIn } = getAuthConfig();
    const token = jwt.sign({ sub: staff.id, role: staff.role, name: staff.fullName }, secretKey, { expiresIn: tokenExpiresIn });
    return { token, staff: { id: staff.id, username: staff.username, fullName: staff.fullName, role: staff.role } };
  }

  // Dùng bởi AuthMiddleware: token hợp lệ → người gọi (actor).
  function verifyToken(token) {
    try {
      const payload = jwt.verify(token, getAuthConfig().secretKey);
      return { id: Number(payload.sub), role: payload.role, fullName: payload.name };
    } catch (_) {
      throw notAuthenticated('TOKEN_INVALID', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.');
    }
  }

  return { login, verifyToken };
}

module.exports = { createAuthService };

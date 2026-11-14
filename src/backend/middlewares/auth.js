// AuthMiddleware – đọc token "Authorization: Bearer …", xác thực và gắn người gọi vào req.actor.
const { notAuthenticated } = require('../errors/AppError');

function createAuthMiddleware({ authService }) {
  return function authenticate(req, res, next) {
    const header = req.get('authorization') || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return next(notAuthenticated('TOKEN_REQUIRED', 'Bạn cần đăng nhập để dùng chức năng này.'));
    }
    try {
      req.actor = authService.verifyToken(token);
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { createAuthMiddleware };

// Header bảo mật cơ bản cho cả API và giao diện (không gọi tài nguyên ngoài – TD-14).
function securityHeaders(req, res, next) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy':
      "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'",
  });
  next();
}

module.exports = { securityHeaders };

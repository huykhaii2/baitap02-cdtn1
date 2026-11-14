// Lắp ráp ứng dụng Express: API (/api/...) và giao diện (src/frontend) phục vụ cùng một cổng (TD-08).
const path = require('path');
const express = require('express');
const services = require('./services');
const { createAuthMiddleware } = require('./middlewares/auth');
const { errorHandler, apiNotFound } = require('./middlewares/errorHandler');
const { securityHeaders } = require('./middlewares/securityHeaders');
const { createAuthController } = require('./controllers/authController');
const { createHealthController } = require('./controllers/healthController');
const { createCustomerController } = require('./controllers/customerController');
const { createTicketController } = require('./controllers/ticketController');

const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');

function createApp(deps = services) {
  const app = express();
  app.disable('x-powered-by');
  app.use(securityHeaders);
  // Giao diện phục vụ trước: thư mục src/frontend/api/*.js nằm dưới URL /api/… nên phải được tìm file trước;
  // không có file trùng tên thì request đi tiếp tới các route API bên dưới.
  app.use(express.static(FRONTEND_DIR, { index: 'index.html' }));
  app.use('/api', express.json({ limit: '100kb' }));

  // Không cần đăng nhập
  app.use('/api', createHealthController(deps));
  app.use('/api', createAuthController(deps));

  // Cần đăng nhập
  app.use('/api', createAuthMiddleware(deps));
  app.use('/api', createCustomerController(deps));
  app.use('/api', createTicketController(deps));
  app.use('/api', apiNotFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };

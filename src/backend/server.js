// Khởi động máy chủ: npm start → http://localhost:APP_PORT (mặc định 3000).
const { createApp } = require('./app');
const { getAppPort, getDbConfig, getAuthConfig } = require('./config/env');
const db = require('./config/db');

try {
  getDbConfig();
  getAuthConfig();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const port = getAppPort();
const server = createApp().listen(port, () => {
  console.log(`Smart CRM – Mekong Mobile (L2) đang chạy tại http://localhost:${port}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') console.error(`Cổng ${port} đang bận – đổi APP_PORT trong .env.`);
  else console.error(err);
  process.exit(1);
});

function shutdown() {
  server.close(() => db.close().finally(() => process.exit(0)));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

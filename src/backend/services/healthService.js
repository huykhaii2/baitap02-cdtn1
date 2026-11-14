// Kiểm tra sức khoẻ hệ thống: CSDL còn kết nối được không.
function createHealthService({ healthRepo }) {
  async function check() {
    await healthRepo.ping();
    return { status: 'ok', db: 'ok', service: 'Smart CRM – Mekong Mobile · L2' };
  }
  return { check };
}

module.exports = { createHealthService };

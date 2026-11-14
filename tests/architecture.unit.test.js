// Kiểm tra ranh giới lớp bằng mã nguồn (tiêu chí C2, S2 và quy ước giao diện của slide buổi 10).
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const jsFiles = (rel) =>
  fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? jsFiles(path.join(rel, d.name)) : d.name.endsWith('.js') ? [path.join(rel, d.name)] : []);
// Bỏ chú thích để chỉ soi mã thật.
const code = (rel) => read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('Ranh giới lớp', () => {
  it('C2 / S2: lớp nghiệp vụ không dùng req, res, express hay mã trạng thái HTTP', () => {
    const offenders = [];
    for (const file of jsFiles('src/backend/services')) {
      const src = code(file);
      // req/res, Express, res.status(4xx), statusCode, err.status = 4xx, { status: 409 }… (ticket.status là trạng thái phiếu – hợp lệ)
      if (/\breq\b|\bres\b|express|statusCode|\b(err|error|e)\.status\s*=|\.status\(\s*\d|\bstatus\s*:\s*\d{3}\b|\bhttp\b/i.test(src)) offenders.push(file);
    }
    assert.deepEqual(offenders, []);
  });

  it('C2: controller không truy vấn CSDL trực tiếp (không import repository, config/db, không gọi .query)', () => {
    const offenders = jsFiles('src/backend/controllers').filter((file) =>
      /repositories\/|config\/db|\.query\(|require\('pg'\)/.test(code(file)));
    assert.deepEqual(offenders, []);
  });

  it('chỉ repository mới viết SQL (SELECT/INSERT/UPDATE/DELETE)', () => {
    const offenders = [...jsFiles('src/backend/services'), ...jsFiles('src/backend/controllers'), ...jsFiles('src/backend/middlewares')]
      .filter((file) => /\b(SELECT|INSERT INTO|UPDATE \w+ SET|DELETE FROM)\b/.test(code(file)));
    assert.deepEqual(offenders, []);
  });

  it('TD-12: chỉ errorHandler.js chứa bảng kind → mã HTTP', () => {
    const hits = jsFiles('src/backend').filter((file) => /KIND_TO_HTTP\s*=/.test(code(file)));
    assert.deepEqual(hits, [path.join('src/backend/middlewares/errorHandler.js')]);
  });

  it('giao diện: chỉ src/frontend/api/client.js gọi fetch(); màn hình không import client.js trực tiếp', () => {
    const fetchers = jsFiles('src/frontend').filter((file) => /\bfetch\(/.test(code(file)));
    assert.deepEqual(fetchers, [path.join('src/frontend/api/client.js')]);
    const pagesUsingClient = jsFiles('src/frontend/pages').filter((file) => /api\/client\.js/.test(code(file)));
    assert.deepEqual(pagesUsingClient, []);
  });

  it('không có PUT/DELETE cho phiếu bảo hành (BR6)', () => {
    assert.doesNotMatch(code('src/backend/controllers/ticketController.js'), /\.(put|delete|patch)\(/);
  });
});

describe('Bảo mật cấu hình', () => {
  it('.env và mọi *.env bị .gitignore chặn; .env.example không chứa mật khẩu thật', () => {
    const ignore = read('.gitignore');
    assert.match(ignore, /^\.env$/m);
    assert.match(ignore, /^\*\.env$/m);
    assert.doesNotMatch(read('.env.example'), /supabase\.co|sk_live|eyJhbGci/i);
  });
});

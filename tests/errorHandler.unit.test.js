// Unit test errorHandler – nơi DUY NHẤT đổi kind → mã HTTP (TD-12) và trả 503 khi mất CSDL (TD-14).
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { errorHandler, KIND_TO_HTTP } = require('../src/backend/middlewares/errorHandler');
const E = require('../src/backend/errors/AppError');

function run(err) {
  const res = {
    headersSent: false,
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  const quiet = { error: console.error, warn: console.warn };
  console.error = () => {};
  console.warn = () => {};
  try {
    errorHandler(err, { method: 'GET', originalUrl: '/api/test' }, res, () => {});
  } finally {
    Object.assign(console, quiet);
  }
  return res;
}

describe('errorHandler', () => {
  const cases = [
    [E.invalidInput('INVALID_PHONE', 'x', { field: 'phone' }), 400],
    [E.notAuthenticated('TOKEN_REQUIRED', 'x'), 401],
    [E.notAllowed('ROLE_NOT_ALLOWED', 'x'), 403],
    [E.notFound('TICKET_NOT_FOUND', 'x'), 404],
    [E.conflict('OPEN_TICKET_EXISTS', 'x', { ticketCode: 'BH-2026-000001' }), 409],
  ];
  for (const [err, status] of cases) {
    it(`kind ${err.kind} → HTTP ${status}, giữ nguyên code và details`, () => {
      const res = run(err);
      assert.equal(res.statusCode, status);
      assert.equal(res.body.error.code, err.code);
      assert.deepEqual(res.body.error.details, err.details);
    });
  }

  it('bảng ánh xạ có đủ 5 loại lỗi nghiệp vụ', () => {
    assert.deepEqual(Object.keys(KIND_TO_HTTP).sort(), Object.values(E.KINDS).sort());
  });

  it('PostgreSQL tắt (ECONNREFUSED), kể cả dạng AggregateError → 503 DB_UNAVAILABLE', () => {
    const refused = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), { code: 'ECONNREFUSED' });
    assert.equal(run(refused).statusCode, 503);
    const agg = new AggregateError([refused], 'All connection attempts failed');
    const res = run(agg);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.error.code, 'DB_UNAVAILABLE');
  });

  it('sai mật khẩu CSDL (28P01) hoặc hết thời gian kết nối → 503', () => {
    assert.equal(run(Object.assign(new Error('password authentication failed'), { code: '28P01' })).statusCode, 503);
    assert.equal(run(new Error('timeout exceeded when trying to connect')).statusCode, 503);
  });

  it('JSON hỏng → 400 INVALID_JSON', () => {
    const res = run(Object.assign(new SyntaxError('Unexpected token'), { type: 'entity.parse.failed' }));
    assert.deepEqual([res.statusCode, res.body.error.code], [400, 'INVALID_JSON']);
  });

  it('lỗi lạ → 500 INTERNAL_ERROR và không lộ thông điệp gốc', () => {
    const res = run(new Error('column "secret" does not exist'));
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.error.code, 'INTERNAL_ERROR');
    assert.doesNotMatch(res.body.error.message, /secret/);
  });
});

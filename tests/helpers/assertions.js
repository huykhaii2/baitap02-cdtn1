// So khớp lỗi nghiệp vụ theo kind + code (không theo mã HTTP – TD-12).
const assert = require('node:assert/strict');

async function rejectsWith(promiseOrFn, kind, code) {
  await assert.rejects(typeof promiseOrFn === 'function' ? promiseOrFn() : promiseOrFn, (err) => {
    assert.equal(err.name, 'AppError', `mong đợi AppError, nhận ${err.name}: ${err.message}`);
    assert.equal(err.kind, kind);
    if (code) assert.equal(err.code, code);
    return true;
  });
}

module.exports = { rejectsWith };

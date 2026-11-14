#!/usr/bin/env node
// npm run migrate – chạy lần lượt các file db/migrations/*.sql chưa chạy (TD-06).
// Chạy lại nhiều lần không lỗi: file đã chạy được ghi trong bảng schema_migrations.
const fs = require('fs');
const path = require('path');
const db = require('../src/backend/config/db');

const DIR = path.join(__dirname, '..', 'db', 'migrations');

async function migrate({ log = console.log } = {}) {
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version    VARCHAR(100) PRIMARY KEY,
    applied_at TIMESTAMPTZ  NOT NULL DEFAULT now()
  )`);
  const done = new Set((await db.query('SELECT version FROM schema_migrations')).rows.map((r) => r.version));
  const files = fs.readdirSync(DIR).filter((f) => /^\d{3}_.+\.sql$/.test(f)).sort();
  let applied = 0;
  for (const file of files) {
    if (done.has(file)) {
      log(`  • ${file} – đã chạy trước đó, bỏ qua`);
      continue;
    }
    const sql = fs.readFileSync(path.join(DIR, file), 'utf8');
    await db.withTransaction(async (tx) => {
      await tx.query(sql);
      await tx.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
    });
    applied += 1;
    log(`  ✓ ${file} – đã chạy`);
  }
  log(`Migration xong: ${applied} file mới, ${files.length} file tổng cộng.`);
}

if (require.main === module) {
  migrate()
    .catch((err) => {
      console.error('Migration lỗi:', err.message);
      process.exitCode = 1;
    })
    .finally(() => db.close());
}

module.exports = { migrate };

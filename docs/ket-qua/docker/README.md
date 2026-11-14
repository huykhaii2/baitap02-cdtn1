# Ảnh chạy bằng Docker – máy em (Windows, Docker Desktop), 14/11/2026

| Ảnh | Lệnh | Kết quả |
|---|---|---|
| `01-docker-ps-healthy.png` | `docker compose up -d --build` rồi `docker compose ps` | `app` và `db` đều **healthy**; chỉ `app` mở cổng `3000` ra máy, `db` chỉ có `5432/tcp` trong mạng nội bộ |
| `BUG-06-truoc-npm-test-fail.png` | `docker compose exec app npm test` (trước khi sửa) | `pass 81, fail 1` – thiếu `/app/.gitignore` trong image (BUG-06, `docs/bug-log.md`) |
| `02-docker-npm-test-pass.png` | `docker compose exec app npm test` (sau khi sửa BUG-06) | `pass 82, fail 0` |
| `03-docker-test-db-pass.png` | `docker compose exec app npm run test:db` | `pass 19, fail 0` – test với PostgreSQL trong container |

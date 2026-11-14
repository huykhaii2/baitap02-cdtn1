# Checklist bảo mật – Bài tập 3 (7 mục)

**Sinh viên:** Giang Huy Khải – 2374802010205 · **Repo:** https://github.com/huykhaii2/baitap02-cdtn1 · **Ngày tự kiểm:** 14/11/2026

Mỗi mục ghi trạng thái **ĐÃ LÀM / CHƯA LÀM / KHÔNG ÁP DỤNG** và minh chứng là lệnh đã chạy thật kèm kết quả. Lệnh viết cho PowerShell trên Windows, chạy trong thư mục repo khi hệ thống đang chạy bằng `docker compose up -d --build`. Ảnh chụp đặt trong `docs/ket-qua/bao-mat/sec-1.png` … `sec-7.png`.

| # | Mục | OWASP Top 10:2025 | Trạng thái |
|---|---|---|---|
| 1 | Không có secret nào trong repo | A02 Security Misconfiguration | ĐÃ LÀM (khoá cũ: xem 1c) |
| 2 | Dữ liệu vào được kiểm ở tầng ứng dụng | A05 Injection | ĐÃ LÀM |
| 3 | Kiểm soát truy cập theo vai trò và theo người được giao | A01 Broken Access Control | ĐÃ LÀM |
| 4 | Mật khẩu được băm | A04 Cryptographic Failures · A07 Authentication Failures | ĐÃ LÀM |
| 5 | Thông báo lỗi không lộ cấu trúc bên trong | A10 Mishandling of Exceptional Conditions · A02 | ĐÃ LÀM |
| 6 | Nhật ký không ghi secret, dữ liệu cá nhân | A09 Logging & Alerting Failures | ĐÃ LÀM |
| 7 | Phụ thuộc ghim phiên bản, đã kiểm lỗ hổng | A03 Software Supply Chain Failures | ĐÃ LÀM |

---

## 1. Không có secret nào trong repo — ĐÃ LÀM

**a) `.env` bị chặn và chưa từng vào lịch sử repo nộp bài**
```powershell
git check-ignore -v .env
git log --all --oneline -- .env backend/db/sql.env
```
Kết quả: lệnh 1 in `.gitignore:4:*.env   .env` (dòng 4 của `.gitignore` chặn tệp); lệnh 2 **không in dòng nào** – repo `baitap02-cdtn1` bắt đầu lịch sử mới (TD-26) nên `.env` và `sql.env` chưa từng được commit.

**b) Không có mật khẩu / khoá ghi cứng trong mã nguồn**
```powershell
git grep -nIiE "(password|secret|api_key)[a-z_]*[ ]*[:=][ ]*'[^']{6,}'" -- src
```
Kết quả: **rỗng**. Mọi giá trị nhạy cảm đọc từ biến môi trường (`src/backend/config/env.js`); thiếu biến thì ứng dụng dừng và chỉ in **tên** biến. `.env.example` chỉ có giá trị mẫu; `.dockerignore` chặn `.env` khỏi image. Mật khẩu `Matkhau@123` của tài khoản demo là dữ liệu mẫu ghi công khai trong README / Deployment Guide, trong CSDL chỉ lưu bản băm (mục 4).

**c) Xử lý secret đã lộ (đề BT3 mục 4.4)**
Repo cũ `huykhaii2/cdtn1-baitap02` từng commit `.env` và `backend/db/sql.env` chứa khoá Supabase (nhận xét BT2). Đã làm: gỡ hai tệp, chặn bằng `.gitignore` (TD-17), chuyển sang repo mới có lịch sử sạch (TD-26).
Đổi mật khẩu database và khoá API trên Supabase: **CHƯA LÀM – phải làm trước khi nộp** *(làm xong thì sửa dòng này thành "ĐÃ LÀM ngày …")*.

Ảnh: `docs/ket-qua/bao-mat/sec-1.png` (chạy trên máy em, Windows PowerShell)

## 2. Dữ liệu vào được kiểm ở tầng ứng dụng — ĐÃ LÀM

**a) Kiểm dữ liệu ở lớp nghiệp vụ, trả 400 kèm mã lỗi theo trường.** SĐT (10 số, bắt đầu bằng 0), IMEI (15 số), ngày (`YYYY-MM-DD` có thật), độ dài mô tả (≤ 2000), danh mục, mức ưu tiên, phân trang (`src/backend/services/validators.js`). Test dữ liệu sai đều PASS: TC-02, TC-03 (2a), TC-05 (IMEI 14/16 số), TC-08, TC-11 (`pageSize=101`, khoảng ngày ngược) – ảnh `docs/ket-qua/test-case/`.

**b) Chống SQL injection: mọi câu SQL tham số hoá (`$1, $2…`), không ghép dữ liệu người dùng vào chuỗi SQL.**
```powershell
git grep -nE "query\([^)]*\+ " -- src
```
Kết quả: **rỗng** (không có `query(… + …)`). Các chỗ `${…}` trong repository chỉ chèn hằng số dựng sẵn (`DETAIL_SELECT`, `OPEN`, `TODAY_VN`, mệnh đề `WHERE` chỉ chứa `$n`); giá trị người nhập luôn đi qua mảng tham số của `pg`.
Kiểm thật – TC-11: `GET /api/tickets?q=' OR '1'='1` → `200`, `total = 0` trong khi CSDL có 24 phiếu.

Ảnh: `docs/ket-qua/test-case/TC-11.png`, `docs/ket-qua/bao-mat/sec-2.png`

## 3. Kiểm soát truy cập theo vai trò và theo người được giao — ĐÃ LÀM

Luồng L2 không có tài khoản khách hàng; "chủ sở hữu" của phiếu ở đây là **kỹ thuật viên được giao**. Quyền được kiểm **ở lớp nghiệp vụ trên máy chủ** (NFR4), không dựa vào việc ẩn nút.

Minh chứng – TC-10 (PASS, 6/6):
- Nhân viên tiếp nhận gọi phân loại → `403 ROLE_NOT_ALLOWED`, phiếu vẫn Mới.
- Kỹ thuật viên `kt2` mở phiếu đã giao cho `kt1` → `403 TICKET_NOT_ASSIGNED_TO_YOU`.
- Điều phối viên thêm khách hàng → `403` (chỉ được xem).
- Không có token → `401 TOKEN_REQUIRED`; token giả mạo vai trò → `401 TOKEN_INVALID`.

Ngoài ra `npm test` có ca `NOT_ALLOWED` cho mọi service; `npm run test:db` kiểm `kt2` không thấy phiếu của `kt1` trong danh sách.

Ảnh: `docs/ket-qua/test-case/TC-10.png`

## 4. Mật khẩu được băm — ĐÃ LÀM

```powershell
docker compose exec db psql -U smartcrm -d smartcrm -c "SELECT username, left(password_hash, 7) AS prefix, length(password_hash) AS len FROM staff ORDER BY id LIMIT 3;"
```
Kết quả: `tn1 | $2b$10$ | 60`, `dp1 | $2b$10$ | 60`, `kt1 | $2b$10$ | 60` – bcrypt (`bcryptjs`, cost 10), không đọc ngược được. Đăng nhập so khớp bằng `bcrypt.compare`; API không bao giờ trả `password_hash` (TC-01). Sai tên và sai mật khẩu trả cùng một thông báo để không lộ tài khoản nào tồn tại (TC-02). Token JWT ký bằng `SECRET_KEY` lấy từ biến môi trường, hết hạn sau `TOKEN_EXPIRES_IN` (8 giờ).

Ảnh: `docs/ket-qua/bao-mat/sec-4.png`

## 5. Thông báo lỗi không lộ cấu trúc bên trong — ĐÃ LÀM

```powershell
curl.exe -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d "{bad"
docker compose stop db
curl.exe -s http://localhost:3000/api/health
docker compose start db
```
Kết quả:
- JSON hỏng → `{"error":{"code":"INVALID_JSON","message":"Dữ liệu gửi lên không phải JSON hợp lệ."}}`.
- Tắt CSDL → `{"error":{"code":"DB_UNAVAILABLE","message":"Không kết nối được cơ sở dữ liệu. Vui lòng thử lại sau ít phút."}}` (HTTP 503).

Không có stack trace, tên bảng, câu SQL hay chuỗi kết nối trong phản hồi. Lỗi không lường trước trả `500 INTERNAL_ERROR` với thông báo chung (`tests/errorHandler.unit.test.js` kiểm thông điệp gốc không bị lộ); chi tiết chỉ ghi vào log máy chủ. Thêm các header `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`, bỏ `X-Powered-By`.

Ảnh: `docs/ket-qua/bao-mat/sec-5.png`, ảnh giao diện `docs/ket-qua/anh/23-m2-trang-thai-loi-503.png`

## 6. Nhật ký không ghi secret, dữ liệu cá nhân — ĐÃ LÀM

```powershell
docker compose logs app | Select-String -Pattern "password|secret|token|Bearer|0[0-9]{9}"
```
Kết quả: **không in dòng nào**. Ứng dụng không ghi log request/body; chỉ ghi lỗi ≥ 500 (phương thức + đường dẫn) và một dòng cảnh báo khi mất CSDL (chỉ mã lỗi). Khi kiểm mục này đã phát hiện `scripts/seed.js` in mật khẩu tài khoản demo ra log → đã bỏ (chỉ in "mật khẩu xem README mục 3").

Ảnh: `docs/ket-qua/bao-mat/sec-6.png`

## 7. Phụ thuộc ghim phiên bản, đã kiểm lỗ hổng — ĐÃ LÀM

```powershell
docker compose exec app npm audit --omit=dev
```
Kết quả: `found 0 vulnerabilities`. `package-lock.json` đã commit; image cài bằng `npm ci` (đúng phiên bản trong tệp khoá). 5 thư viện chạy: `express` 4.22, `pg` 8.23, `jsonwebtoken` 9.0, `bcryptjs` 3.0, `dotenv` 18.0; không có devDependencies (test dùng `node:test` có sẵn trong Node.js 22). Font Be Vietnam Pro đóng gói trong repo (giấy phép OFL), giao diện không tải tài nguyên từ mạng ngoài.

Ảnh: `docs/ket-qua/bao-mat/sec-7.png`

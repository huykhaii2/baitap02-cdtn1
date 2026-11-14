# Test Plan – Luồng L2: Tiếp nhận và phân loại yêu cầu bảo hành (track SE)

Giang Huy Khải – 2374802010205 – Lớp 71k29cntt03 · Smart CRM – Mekong Mobile · Node.js 22 + Express 4 + PostgreSQL 16 · `node:test`
Repo: https://github.com/huykhaii2/baitap02-cdtn1

## 1. Phạm vi kiểm thử và phần chủ ý KHÔNG kiểm

**Kiểm (12 test case theo chức năng):** đăng nhập (A1) · tra cứu khách hàng (UC07) · tạo phiếu bảo hành (UC01, BR1, BR2) · phân loại phiếu (UC02, BR4) · phân công và nhận phiếu (UC03, UC05, UC06) · phân quyền theo vai trò (NFR4, BR5) · danh sách phiếu (UC04, FR4) · CRUD khách hàng và thiết bị (S1, S2, TD-13).

**Cố ý KHÔNG kiểm (và lý do):**
- Hiệu năng NFR1 (≤ 2 giây p95 với 10.000 phiếu): chưa có công cụ tải và dữ liệu 10.000 phiếu; mới có index `(status, due_date)` và phân trang trong CSDL – ghi là phần còn thiếu.
- Khả dụng NFR2 (người dùng mới tạo phiếu ≤ 3 phút): cần thử với người thật, không tự động hoá được.
- Gửi SMS (FR6 – WON'T), sửa chữa / trả máy: ngoài phạm vi L2.

## 2. Loại test và số lượng mỗi tầng

| Tầng | Lệnh | Số lượng |
|---|---|---|
| Unit – lớp nghiệp vụ, không cần CSDL | `npm test` | 82 test (`tests/*.unit.test.js`) |
| Tích hợp – CSDL thật | `npm run test:db` | 19 test (`tests/br2.db.test.js`, `tests/api.db.test.js`) |
| **Test case hệ thống** – máy chủ thật + CSDL thật, gọi API như người dùng | `node scripts/tc.js TC-xx` | **12 test case** (`docs/test-report.md`) |

12 test case phủ đủ các loại:

| Loại | Test case |
|---|---|
| Luồng đúng | TC-01, TC-03, TC-04, TC-07, TC-09, TC-12 |
| Giá trị biên | TC-05 (IMEI 14 / **15** / 16 chữ số), TC-11 (`pageSize` 101 > biên 100) |
| Dữ liệu sai | TC-02 (sai mật khẩu, để trống), TC-08 (thiếu / sai danh mục, mức ưu tiên lạ) |
| Vi phạm quy tắc nghiệp vụ | TC-06 (BR2 ở cả tầng nghiệp vụ và tầng CSDL), TC-12 (xoá có ràng buộc, BR6) |
| Bảo mật | TC-10 (OWASP A01 – sai vai trò, xem phiếu người khác, không token, token giả), TC-11 (A03 – SQL injection), TC-02 (A07 – không lộ tài khoản tồn tại, tài khoản khoá) |
| Luồng ngoại lệ UC01 | TC-03 (2a, 3a), TC-05 (4a), TC-06 (5b) |

**Kỹ thuật chọn dữ liệu:** phân vùng tương đương (SĐT / IMEI hợp lệ – sai độ dài; vai trò được phép – không được phép) và giá trị biên (IMEI hai bên ranh giới 15 chữ số; `pageSize` 100 / 101). Kết quả mong đợi kiểm cả **mã HTTP, mã lỗi** và **tác dụng phụ** (đếm số phiếu / khách hàng trước – sau, số dòng lịch sử, trạng thái phiếu sau khi bị từ chối).

## 3. Truy vết – mỗi quy tắc / yêu cầu có ít nhất một test

| Quy tắc / yêu cầu (`docs/srs.md`) | Test case | Test tự động khác |
|---|---|---|
| FR1 · UC01 Tạo phiếu | TC-04, TC-05, TC-06 | `ticketService.unit.test.js` |
| BR1 Phiếu gắn đúng một khách hàng và một thiết bị | TC-04 | `ticketService.unit.test.js` (DEVICE_OWNED_BY_OTHER) |
| BR2 Một IMEI một phiếu chưa đóng | TC-06 | `br2.db.test.js` (3 ca – TD-04) |
| BR3 Hết hạn bảo hành vẫn tạo phiếu, có nhãn | — (ảnh giao diện `docs/ket-qua/anh/12-…`) | `ticketService.unit.test.js` |
| FR2 · UC02 · BR4 Phân loại, hạn xử lý 24 / 72 / 120 giờ | TC-07, TC-08 | `classifyService.unit.test.js` (cả 3 mức) |
| BR5 Chỉ Điều phối viên phân loại / phân công; chỉ kỹ thuật viên đang hoạt động | TC-09, TC-10 | `assignService.unit.test.js` |
| BR6 Thứ tự trạng thái; phiếu không bị xoá | TC-09, TC-12 | `statusService.unit.test.js` |
| FR3 · UC03 Phân công | TC-09 | `api.db.test.js` |
| FR4 · UC04 Danh sách, lọc, phân trang | TC-11 | `ticketService.unit.test.js`, `api.db.test.js` |
| FR5 · UC05, UC06 Đổi trạng thái, lịch sử | TC-09 | `api.db.test.js` |
| UC07 Tra cứu khách hàng | TC-03 | `masterDataService.unit.test.js` |
| NFR4 Kiểm tra vai trò ở máy chủ | TC-10 | mọi file `*.unit.test.js` có ca NOT_ALLOWED |
| NFR5 Mỗi lần đổi trạng thái có đúng 1 dòng lịch sử | TC-04, TC-07, TC-08, TC-09 | `statusService.unit.test.js` |
| A1 Đăng nhập | TC-01, TC-02 | `authService.unit.test.js` |
| S1, S2 · TD-13 CRUD khách hàng, thiết bị | TC-12 | `masterDataService.unit.test.js`, `api.db.test.js` |

## 4. Tiêu chí thành công ĐO ĐƯỢC (đặt trước khi chạy)

- 12/12 test case có kết quả thực tế ghi bằng số liệu cụ thể và ảnh `docs/ket-qua/test-case/TC-xx.png`.
- Mỗi FR mức MUST/SHOULD và mỗi quy tắc BR1–BR6 có ≥ 1 test (bảng mục 3).
- `npm test` và `npm run test:db` đạt toàn bộ (0 fail), cả trên máy và trong container (`docs/ket-qua/may-trang/`).
- Không còn lỗi mức Nghiêm trọng đang mở trong `docs/bug-log.md`.

## 5. Môi trường và dữ liệu thử

- Máy chạy 12 test case (ảnh minh chứng): Windows, PowerShell, Node.js v22.16.0, PostgreSQL 16. Bộ test tự động và ảnh giao diện còn được chạy trên Linux, Node.js 22. Trình duyệt kiểm giao diện: Chrome.
- Dữ liệu: CSDL trống → `npm run migrate` → `npm run seed` (5 tài khoản, 6 danh mục lỗi, 25 khách hàng, 26 thiết bị, 16 phiếu).
- Máy chủ: `npm start` (http://localhost:3000).
- Mỗi test case **tự tạo** khách hàng / thiết bị / phiếu mới với SĐT, IMEI ngẫu nhiên (in ra ở dòng *Tiền điều kiện*) nên chạy lại được nhiều lần, không phụ thuộc thứ tự. TC-06 chèn thẳng vào CSDL trong giao dịch rồi `ROLLBACK`, không để lại dữ liệu.
- Dọn dữ liệu thử: tạo lại CSDL rồi chạy lại `npm run migrate` và `npm run seed`.
- Chạy một test case: `node scripts/tc.js TC-05` · chạy cả 12: `node scripts/tc.js all`.

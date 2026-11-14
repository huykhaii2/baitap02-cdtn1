# Kết quả chạy – bản `v0.2` (14/11/2026)

Chạy trên CSDL PostgreSQL 16 trống, Node.js 22, theo đúng thứ tự README mục 3.

| File | Lệnh | Nội dung |
|---|---|---|
| `01-migrate-seed.txt` | `npm run migrate` ×2, `npm run seed` ×2 | lần hai không tạo bản ghi trùng (C5) |
| `02-npm-test.txt` | `npm test` | unit test lớp nghiệp vụ, không cần CSDL (C4) |
| `03-test-db.txt` | `npm run test:db` | BR2 (TD-04) + API end-to-end với CSDL thật |
| `04-demo-api.txt` | `bash scripts/demo-api.sh` | gọi luồng chính bằng curl, kèm các lỗi 400 / 401 / 403 / 409 |
| `05-test-case.txt` | `node scripts/tc.js TC-01` … `TC-12` | 12 test case hệ thống – 12 / 12 PASS (`docs/test-report.md`) |

## Ảnh test case (`test-case/`)

`TC-01.png` … `TC-12.png`: ảnh chụp đầu ra terminal khi chạy `node scripts/tc.js TC-xx` (máy chủ `npm start` + CSDL vừa migrate + seed), cùng lần chạy với `05-test-case.txt`.

## Ảnh giao diện (`anh/`)

Chụp tự động bằng trình duyệt Chrome (khung 1366 × 860 và 390 × 844 cho điện thoại) khi thao tác thật trên giao diện, dữ liệu thật.

| Ảnh | Nội dung |
|---|---|
| `01`, `02` | Đăng nhập; tài khoản `kt3` đã khoá bị từ chối |
| `10`–`16` | M1: 2a SĐT sai · 3a chưa có khách hàng · 5c hết hạn bảo hành · 5a IMEI mới · trước khi lưu · M3 phiếu vừa tạo · 5b đang có phiếu chưa đóng (nút Lưu bị khoá) |
| `20`–`23` | M2: danh sách · lọc *Đã phân loại* (dòng quá hạn tô đỏ) · trạng thái **rỗng** · trạng thái **lỗi 503** khi tắt PostgreSQL |
| `30`, `31` | M3 (dp1): phân loại (báo lỗi khi chưa chọn) · phân công |
| `40`–`42` | kt1: chỉ thấy phiếu của mình · lịch sử đủ 4 dòng sau khi nhận phiếu · không có quyền vào M4 |
| `50`–`52` | M4 (tn1): xoá khách còn thiết bị → 409 · thêm khách + thiết bị · xoá thiết bị rồi xoá khách |
| `60`, `61` | Giao diện trên điện thoại: M2, M3 |

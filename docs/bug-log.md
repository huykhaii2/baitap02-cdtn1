# Nhật ký lỗi (Bug Log)

**Sinh viên:** Giang Huy Khải – 2374802010205 · **Repo:** https://github.com/huykhaii2/baitap02-cdtn1

Các lỗi gặp khi dựng lại mã nguồn sau phản hồi BT2 (14/11/2026). Mỗi lỗi: cách tái lập → nguyên nhân → cách sửa → cách kiểm lại.

| Mã | Mức | Trạng thái |
|---|---|---|
| BUG-01 | Nghiêm trọng – giao diện không chạy | Đã sửa |
| BUG-02 | Cao – sai dữ liệu lịch sử | Đã sửa |
| BUG-03 | Trung bình – lọc / chọn sai bản ghi ở M4 | Đã sửa |
| BUG-04 | Thấp – hiển thị trên điện thoại | Đã sửa |
| BUG-05 | Cao – Docker không seed được | Đã sửa, đã kiểm bằng Docker |
| BUG-06 | Trung bình – test hỏng khi chạy trong container | Đã sửa |

### BUG-01 Giao diện trắng trang: `/api/client.js` trả 401
- **Tái lập:** `npm start`, mở http://localhost:3000 → trang trắng; DevTools báo `GET /api/client.js 401`.
- **Nguyên nhân:** Thư mục giao diện `src/frontend/api/` (theo TD-08) được phục vụ ở URL `/api/...`, trùng tiền tố với các route API. `express.static` đặt sau AuthMiddleware nên request tải file JS bị đòi token.
- **Sửa:** `src/backend/app.js` đặt `express.static(src/frontend)` **trước** các route API; không có file trùng tên thì request đi tiếp tới API như cũ.
- **Kiểm lại:** `curl -o /dev/null -w '%{http_code}' localhost:3000/api/client.js` → `200`; `/api/tickets` không token → `401`; trang đăng nhập hiện bình thường.

### BUG-02 Lịch sử trạng thái ghi sai "trạng thái cũ"
- **Tái lập:** unit test `statusService.unit.test.js › đổi trạng thái và ghi đúng 1 dòng lịch sử` báo `from: 'REJECTED'` thay vì `'NEW'`.
- **Nguyên nhân:** StatusService đọc `ticket.status` để ghi `from_status` **sau** khi gọi `updateStatus`; nếu đối tượng phiếu bị cập nhật tại chỗ thì giá trị cũ đã mất.
- **Sửa:** chốt `const fromStatus = ticket.status` ngay đầu `changeStatus` và dùng biến này cho cả kiểm tra chuyển trạng thái, câu UPDATE và dòng lịch sử.
- **Kiểm lại:** `npm test` đạt; `GET /api/tickets/{code}/history` của phiếu chạy hết luồng ra đúng `— → NEW → CLASSIFIED → ASSIGNED → IN_PROGRESS`.

### BUG-03 M4 bỏ mất tham số `id=1` khi điều hướng
- **Tái lập:** M4, chọn khách hàng có mã 1 rồi sửa thiết bị → trang quay về "Chọn một khách hàng".
- **Nguyên nhân:** Hàm dựng query string lọc bỏ mọi giá trị bằng `'1'` (định bỏ `page=1`) nên bỏ luôn `id=1`.
- **Sửa:** chỉ bỏ `page` khi bằng `1`, giữ nguyên các khoá khác.
- **Kiểm lại:** mở `#/data?id=1`, thêm / xoá thiết bị → vẫn ở khách hàng mã 1 (ảnh `docs/ket-qua/anh/50-…`, `51-…`).

### BUG-04 Bảng danh sách trên điện thoại lệch cột
- **Tái lập:** M2 ở khung 390 px → giờ tiếp nhận rơi xuống dòng dưới, nằm ở cột nhãn.
- **Nguyên nhân:** Ở chế độ thẻ, mỗi ô là lưới 2 cột; ô có nhiều phần tử con (mã phiếu + giờ) làm phần tử thứ hai nhảy sang cột 1.
- **Sửa:** `src/frontend/styles.css`: `.table-responsive td > * { grid-column: 2; }`.
- **Kiểm lại:** ảnh `docs/ket-qua/anh/60-dien-thoai-m2.png`.

### BUG-05 Docker: seed lỗi vì thiếu thư mục dataset
- **Tái lập (đọc mã):** `scripts/seed.js` đọc `dataset/*.csv` nhưng `Dockerfile` chỉ `COPY src scripts db`.
- **Sửa:** thêm `COPY dataset ./dataset`; đổi tệp `dockerignore` (thiếu dấu chấm nên Docker không đọc) thành `.dockerignore`.
- **Kiểm lại:** `docker compose up -d --build` trên máy em (Windows, Docker Desktop) → log có `Seed xong`, `docker compose ps` báo `db` và `app` đều `healthy`.

### BUG-06 Test "Bảo mật cấu hình" FAIL khi chạy trong container
- **Tái lập:** `docker compose up -d --build` → `docker compose exec app npm test` → `pass 81, fail 1`: `tests/architecture.unit.test.js:56 – ENOENT: no such file or directory, open '/app/.gitignore'`. Cùng lệnh chạy trên máy thì 82/82 pass.
- **Nguyên nhân:** test đọc `.gitignore` và `.env.example` để kiểm `.env` bị chặn, nhưng `Dockerfile` chỉ `COPY src scripts db dataset tests` – hai tệp này không có trong image. Đúng loại lỗi slide buổi 15 nêu: "Test PASS trên máy sinh viên, FAIL trong container".
- **Sửa:** `Dockerfile` thêm `COPY .gitignore .env.example ./` (hai tệp không chứa bí mật; `.env` thật vẫn bị `.dockerignore` chặn).
- **Kiểm lại:** build lại image, `docker compose exec app npm test` → `pass 82, fail 0`.


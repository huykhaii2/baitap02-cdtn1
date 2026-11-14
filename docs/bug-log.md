# Bug Log – Luồng L2: Tiếp nhận và phân loại yêu cầu bảo hành

**Sinh viên:** Giang Huy Khải – 2374802010205 · **Repo:** https://github.com/huykhaii2/baitap02-cdtn1

Mỗi lỗi ghi đủ 7 dòng: mô tả · mức độ · môi trường · các bước tái lập · mong đợi / thực tế · nguyên nhân và cách sửa · commit sửa và cách kiểm lại.
Mức độ: **Critical** (hệ thống không dùng được hoặc sai dữ liệu nghiêm trọng) · **Major** (sai chức năng / sai dữ liệu, có cách tránh) · **Minor** (hiển thị, tài liệu, ảnh hưởng nhỏ).

| Mã | Tóm tắt | Mức độ | Trạng thái |
|---|---|---|---|
| BUG-01 | Giao diện trắng trang: `/api/client.js` trả 401 | **Critical** | Đã sửa |
| BUG-02 | Lịch sử trạng thái ghi sai "trạng thái cũ" | **Major** | Đã sửa |
| BUG-05 | Docker: seed lỗi vì thiếu thư mục `dataset` | **Major** | Đã sửa, đã kiểm bằng Docker |
| BUG-06 | Test "Bảo mật cấu hình" FAIL khi chạy trong container | Major | Đã sửa |
| BUG-03 | M4 bỏ mất tham số `id=1` khi điều hướng | Minor | Đã sửa |
| BUG-04 | Bảng danh sách trên điện thoại lệch cột | Minor | Đã sửa |
| BUG-07 | Log seed in mật khẩu tài khoản demo | Minor | Đã sửa |

---

### BUG-01 Giao diện trắng trang: `/api/client.js` trả 401
1. **Mô tả:** mở http://localhost:3000 chỉ thấy trang trắng, không đăng nhập được – toàn bộ giao diện không dùng được.
2. **Mức độ:** Critical.
3. **Môi trường:** Node.js 22, Chrome, chạy `npm start`, ngày 14/11/2026.
4. **Các bước tái lập:** `npm start` → mở http://localhost:3000 → DevTools tab Network.
5. **Mong đợi / Thực tế:** mong đợi trang đăng nhập; thực tế `GET /api/client.js → 401 TOKEN_REQUIRED`, mọi module JS phía sau không chạy.
6. **Nguyên nhân và cách sửa:** thư mục giao diện `src/frontend/api/` (TD-08) được phục vụ ở URL `/api/…`, trùng tiền tố với route API; `express.static` đặt sau AuthMiddleware nên tải file JS cũng bị đòi token. Sửa `src/backend/app.js`: đặt `express.static(src/frontend)` **trước** các route API – không có file trùng tên thì request đi tiếp tới API.
7. **Commit sửa · kiểm lại:** commit đầu tiên của repo `baitap02-cdtn1` (mã nguồn BT2) – [6672046](https://github.com/huykhaii2/baitap02-cdtn1/commit/6672046) · `curl /api/client.js` → `200`, `curl /api/tickets` không token → `401`; trang đăng nhập hiện bình thường (ảnh `docs/ket-qua/anh/01-dang-nhap.png`).

### BUG-02 Lịch sử trạng thái ghi sai "trạng thái cũ"
1. **Mô tả:** dòng lịch sử ghi `from_status` bằng trạng thái MỚI thay vì trạng thái trước khi đổi – sai dữ liệu truy vết (NFR5).
2. **Mức độ:** Major.
3. **Môi trường:** Node.js 22, `npm test`, ngày 14/11/2026.
4. **Các bước tái lập:** chạy `npm test` → test `statusService.unit.test.js › đổi trạng thái và ghi đúng 1 dòng lịch sử`.
5. **Mong đợi / Thực tế:** mong đợi `from: 'NEW', to: 'REJECTED'`; thực tế `from: 'REJECTED'`.
6. **Nguyên nhân và cách sửa:** StatusService đọc `ticket.status` để ghi lịch sử **sau** khi gọi `updateStatus`; nếu đối tượng phiếu bị cập nhật tại chỗ thì giá trị cũ đã mất. Sửa `src/backend/services/statusService.js`: chốt `const fromStatus = ticket.status` ngay đầu hàm và dùng cho kiểm tra chuyển trạng thái, câu UPDATE và dòng lịch sử.
7. **Commit sửa · kiểm lại:** [6672046](https://github.com/huykhaii2/baitap02-cdtn1/commit/6672046) · `npm test` 82/82; lịch sử phiếu chạy hết luồng ra đúng `— → NEW → CLASSIFIED → ASSIGNED → IN_PROGRESS` (TC-09, ảnh `docs/ket-qua/test-case/TC-09.png`).

### BUG-05 Docker: seed lỗi vì thiếu thư mục `dataset`
1. **Mô tả:** khi chạy bằng Docker, bước `npm run seed` trong container dừng vì không đọc được `dataset/*.csv` → hệ thống lên nhưng không có dữ liệu mẫu, không đăng nhập được.
2. **Mức độ:** Major.
3. **Môi trường:** Dockerfile bản BT2 (`node:22-alpine`), đọc mã ngày 14/11/2026.
4. **Các bước tái lập:** đọc `scripts/seed.js` (đọc `dataset/customers_raw.csv`…) và `Dockerfile` (chỉ `COPY src scripts db`).
5. **Mong đợi / Thực tế:** mong đợi seed nạp 25 khách, 16 phiếu; thực tế `ENOENT: … /app/dataset/customers_raw.csv`.
6. **Nguyên nhân và cách sửa:** Dockerfile thiếu `COPY dataset ./dataset`; tệp `dockerignore` thiếu dấu chấm nên Docker không đọc. Sửa: thêm `COPY dataset ./dataset`, đổi tên thành `.dockerignore`.
7. **Commit sửa · kiểm lại:** [6672046](https://github.com/huykhaii2/baitap02-cdtn1/commit/6672046) · `docker compose up -d --build` trên máy em → log có `Seed xong`, `docker compose ps` báo `app`, `db` healthy (ảnh `docs/ket-qua/docker/01-docker-ps-healthy.png`).

### BUG-06 Test "Bảo mật cấu hình" FAIL khi chạy trong container
1. **Mô tả:** cùng bộ test, chạy trên máy thì 82/82 pass nhưng chạy trong container thì 1 test FAIL – đúng loại lỗi "PASS trên máy sinh viên, FAIL trong container" của slide buổi 15.
2. **Mức độ:** Major.
3. **Môi trường:** Windows, Docker Desktop, image `baitap02-cdtn1-app`, ngày 14/11/2026.
4. **Các bước tái lập:** `docker compose up -d --build` → `docker compose exec app npm test`.
5. **Mong đợi / Thực tế:** mong đợi `pass 82, fail 0`; thực tế `pass 81, fail 1` – `tests/architecture.unit.test.js:56 ENOENT: no such file or directory, open '/app/.gitignore'`.
6. **Nguyên nhân và cách sửa:** test đọc `.gitignore` và `.env.example` để kiểm `.env` bị chặn, nhưng `Dockerfile` không chép hai tệp này vào image. Sửa `Dockerfile`: thêm `COPY .gitignore .env.example ./` (không chứa bí mật; `.env` thật vẫn bị `.dockerignore` chặn).
7. **Commit sửa · kiểm lại:** [0cb82b9](https://github.com/huykhaii2/baitap02-cdtn1/commit/0cb82b9) · build lại → `docker compose exec app npm test` → `pass 82, fail 0`. Ảnh trước / sau: `docs/ket-qua/docker/BUG-06-truoc-npm-test-fail.png`, `docs/ket-qua/docker/02-docker-npm-test-pass.png`.

### BUG-03 M4 bỏ mất tham số `id=1` khi điều hướng
1. **Mô tả:** ở màn hình M4, sau khi sửa / xoá thiết bị của khách hàng mã 1, trang quay về "Chọn một khách hàng" thay vì ở lại khách đó.
2. **Mức độ:** Minor.
3. **Môi trường:** Chrome, màn hình M4 (`#/data`), ngày 14/11/2026.
4. **Các bước tái lập:** đăng nhập `tn1` → `#/data?id=1` → thêm hoặc xoá một thiết bị.
5. **Mong đợi / Thực tế:** mong đợi vẫn ở `#/data?id=1`; thực tế về `#/data`.
6. **Nguyên nhân và cách sửa:** hàm dựng query string lọc bỏ mọi giá trị bằng `'1'` (định bỏ `page=1`) nên bỏ luôn `id=1`. Sửa `src/frontend/pages/masterData.js`: chỉ bỏ `page` khi bằng `1`.
7. **Commit sửa · kiểm lại:** [6672046](https://github.com/huykhaii2/baitap02-cdtn1/commit/6672046) · mở `#/data?id=1`, thêm / xoá thiết bị → vẫn ở khách hàng mã 1 (ảnh `docs/ket-qua/anh/50-…`, `51-…`).

### BUG-04 Bảng danh sách trên điện thoại lệch cột
1. **Mô tả:** ở khổ màn hình điện thoại, giờ tiếp nhận của phiếu rơi xuống cột nhãn bên trái, khó đọc.
2. **Mức độ:** Minor.
3. **Môi trường:** Chrome, khung 390 × 844, màn hình M2, ngày 14/11/2026.
4. **Các bước tái lập:** đăng nhập `dp1` → M2 → thu nhỏ cửa sổ về 390 px.
5. **Mong đợi / Thực tế:** mong đợi mã phiếu và giờ cùng nằm ở cột giá trị; thực tế giờ nằm ở cột nhãn.
6. **Nguyên nhân và cách sửa:** ở chế độ thẻ, mỗi ô là lưới 2 cột; ô có nhiều phần tử con làm phần tử thứ hai nhảy sang cột 1. Sửa `src/frontend/styles.css`: `.table-responsive td > * { grid-column: 2; }`.
7. **Commit sửa · kiểm lại:** [6672046](https://github.com/huykhaii2/baitap02-cdtn1/commit/6672046) · ảnh `docs/ket-qua/anh/60-dien-thoai-m2.png`.

### BUG-07 Log seed in mật khẩu tài khoản demo
1. **Mô tả:** khi khởi động (container chạy `npm run seed`), log in ra mật khẩu tài khoản demo – trái mục 6 checklist bảo mật "nhật ký không ghi secret".
2. **Mức độ:** Minor (chỉ là mật khẩu demo công khai, nhưng là thói quen sai).
3. **Môi trường:** Docker, `docker compose logs app`, ngày 14/11/2026.
4. **Các bước tái lập:** `docker compose up -d --build` → `docker compose logs app --tail 20`.
5. **Mong đợi / Thực tế:** mong đợi log không chứa mật khẩu; thực tế dòng `Seed xong … – mật khẩu Matkhau@123`.
6. **Nguyên nhân và cách sửa:** `scripts/seed.js` in hằng `DEMO_PASSWORD` ra log. Sửa: chỉ in "mật khẩu xem README mục 3".
7. **Commit sửa · kiểm lại:** [7f8c8fa](https://github.com/huykhaii2/baitap02-cdtn1/commit/7f8c8fa) · `docker compose logs app | Select-String -Pattern "password|secret|token|Bearer|0[0-9]{9}"` → không in dòng nào; log seed không còn mật khẩu.

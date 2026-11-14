# Test Report – Luồng L2: Tiếp nhận và phân loại yêu cầu bảo hành

Giang Huy Khải – 2374802010205 – Lớp 71k29cntt03 · Ngày chạy: 14/11/2026 · Repo: https://github.com/huykhaii2/baitap02-cdtn1

12 test case trình bày **theo chức năng**: đăng nhập, tra cứu khách hàng, tạo phiếu, phân loại, phân công và nhận phiếu, phân quyền, danh sách phiếu, khách hàng và thiết bị. Kế hoạch, loại test và bảng truy vết: [`docs/test-plan.md`](test-plan.md).

**Tổng kết:** đã chạy thật 12 / 12 · **PASS 12** · FAIL 0 · tổng 58 điểm kiểm tra, đạt 58.
Bộ test tự động cùng bản mã: `npm test` 82 / 82 pass · `npm run test:db` 19 / 19 pass.

- Chạy lại: `npm start` ở một terminal, rồi `node scripts/tc.js TC-xx` (hoặc `all`) ở terminal khác.
- Ảnh chụp đầu ra terminal của từng lần chạy: [`docs/ket-qua/test-case/TC-xx.png`](ket-qua/test-case/).
- Nhật ký chữ đầy đủ của lần chạy: [`docs/ket-qua/05-test-case.txt`](ket-qua/05-test-case.txt).

> Bảng đủ 8 cột: mã · tiền điều kiện · các bước · dữ liệu thử · kết quả mong đợi · mức ưu tiên · kết quả thực tế · PASS/FAIL. Cột mã ghi kèm chức năng, loại test và yêu cầu được truy vết. Kết quả thực tế chép từ lần chạy thật (`05-test-case.txt`), không chép lại cột mong đợi. Mã phiếu, SĐT, IMEI trong cột thực tế là giá trị của lần chạy đó.

| Mã · chức năng · loại · truy vết | Tiền điều kiện | Các bước | Dữ liệu thử | Kết quả mong đợi | Ưu tiên | Kết quả thực tế | P/F |
|---|---|---|---|---|---|---|---|
| **TC-01** · Đăng nhập · luồng đúng · *A1* | Đã `npm run seed`; máy chủ đang chạy | 1. `POST /api/auth/login` lần lượt với 3 tài khoản (`node scripts/tc.js TC-01`) | `tn1`, `dp1`, `kt1` – mật khẩu `Matkhau@123` | Mỗi tài khoản: `200`, có token, đúng vai trò; không trả `password_hash` | Cao | `200` ×3 – Lê Thu RECEPTIONIST, Trần Minh COORDINATOR, Phạm Huy TECHNICIAN; không có `password_hash` | PASS |
| **TC-02** · Đăng nhập · dữ liệu sai + bảo mật (A07) · *A1* | Như TC-01; `kt3` đã khoá | 1. Đăng nhập sai mật khẩu. 2. Sai tên. 3. `kt3`. 4. Để trống | `tn1` / `sai-mat-khau`; `khong-ton-tai`; `kt3`; chuỗi rỗng | 1, 2: `401 INVALID_CREDENTIALS` cùng thông báo, không token. 3: `403 ACCOUNT_LOCKED`. 4: `400 CREDENTIALS_REQUIRED` | Cao | 1: `401 INVALID_CREDENTIALS`. 2: `401` cùng thông báo. 3: `403 ACCOUNT_LOCKED`. 4: `400 CREDENTIALS_REQUIRED` | PASS |
| **TC-03** · Tra cứu khách hàng · luồng đúng + ngoại lệ 2a, 3a · *UC07* | Khách mẫu Nguyễn Văn An – `0901234567` | 1. `GET /api/customers/by-phone/{sđt}` với 4 giá trị | `0901 234 567`; `+84901234567`; `090123`; `0999000999` | 1, 2: `200`, đúng Nguyễn Văn An (chuẩn hoá SĐT). 3: `400 INVALID_PHONE`. 4: `404 CUSTOMER_NOT_FOUND` | Cao | 1: `200` Nguyễn Văn An. 2: `200`, phone `0901234567`. 3: `400 INVALID_PHONE`. 4: `404 CUSTOMER_NOT_FOUND` | PASS |
| **TC-04** · Tạo phiếu bảo hành · luồng đúng · *UC01, FR1, BR1, NFR5* | Khách + thiết bị còn hạn bảo hành, chưa có phiếu (tự tạo) | 1. Đếm phiếu. 2. `POST /api/tickets` (tn1). 3. Đếm lại. 4. Xem lịch sử | Mô tả "Máy tự tắt khi còn 30% pin" | `201`; mã `BH-YYYY-NNNNNN`; trạng thái Mới; đúng khách + thiết bị; số phiếu **+1**; lịch sử 1 dòng → NEW | Cao | `201` · `BH-2026-000017` · NEW · đúng khách/thiết bị · phiếu 16 → 17 · lịch sử 1 dòng → NEW (Lê Thu) | PASS |
| **TC-05** · Tạo phiếu · giá trị biên IMEI · *UC01-4a* | Khách và thiết bị chưa có (gửi kèm `customer`, `device`) | 1. Đếm phiếu. 2. `POST /api/tickets` với IMEI 14, 16, rồi 15 chữ số. 3. Đếm lại | IMEI **14** / **16** / **15** chữ số | 14, 16: `400 INVALID_IMEI`, không tạo phiếu; 15: `201`; số phiếu chỉ **+1** | Cao | 14: `400 INVALID_IMEI`; 16: `400 INVALID_IMEI` (phiếu 17 → 17); 15: `201` `BH-2026-000018`; phiếu 17 → 18 | PASS |
| **TC-06** · Tạo phiếu · vi phạm quy tắc · *BR2, UC01-5b* | Thiết bị đang có phiếu Mới (tự tạo) | 1. Đếm phiếu. 2. `POST /api/tickets` lần 2 cùng IMEI. 3. Đếm lại. 4. Chèn thẳng bằng SQL (bỏ qua service) rồi `ROLLBACK` | Cùng SĐT + IMEI của phiếu đang mở | 2: `409 OPEN_TICKET_EXISTS` chỉ ra phiếu đang mở; số phiếu không đổi. 4: CSDL chặn bằng `ux_ticket_open_device` (`23505`) | Cao | 2: `409 OPEN_TICKET_EXISTS` – "đang có phiếu `BH-2026-000019` chưa đóng"; phiếu 19 → 19. 4: lỗi `23505`, constraint `ux_ticket_open_device` | PASS |
| **TC-07** · Phân loại phiếu · luồng đúng · *UC02, FR2, BR4* | Phiếu Mới (tự tạo); đăng nhập dp1 | 1. `POST /api/tickets/{mã}/classify`. 2. Xem lịch sử | Danh mục Pin (`2`), mức ưu tiên `HIGH` | `200`, Đã phân loại; hạn xử lý = lúc phân loại **+24 giờ**; lịch sử thêm NEW → CLASSIFIED | Cao | `200` · `BH-2026-000020` CLASSIFIED · Pin, HIGH · hạn = +24,000 giờ · lịch sử 2 dòng, dòng 2 NEW → CLASSIFIED (Trần Minh) | PASS |
| **TC-08** · Phân loại phiếu · dữ liệu sai · *TD-11* | Phiếu Mới (tự tạo); dp1 | 1. Gửi phân loại 3 lần sai. 2. Xem phiếu và lịch sử | Thiếu `issueCategoryId`; `issueCategoryId = 999`; `priority = URGENT` | `400 ISSUE_CATEGORY_REQUIRED` · `400 ISSUE_CATEGORY_INVALID` · `400 INVALID_PRIORITY`; phiếu vẫn Mới, lịch sử vẫn 1 dòng | Cao | `400 ISSUE_CATEGORY_REQUIRED` · `400 ISSUE_CATEGORY_INVALID` · `400 INVALID_PRIORITY`; `BH-2026-000021` vẫn NEW, lịch sử 1 dòng | PASS |
| **TC-09** · Phân công + nhận phiếu · luồng đúng · *UC03, UC05, UC06, FR3, FR5, BR5, BR6* | Phiếu Đã phân loại (tự tạo) | 1. `GET /api/technicians` (dp1). 2. Phân công kt1. 3. kt1 `acknowledge`. 4. Xem lịch sử | Kỹ thuật viên Phạm Huy (`kt1`) | 1: không có `kt3` (đã khoá). 2: `200` ASSIGNED. 3: `200` IN_PROGRESS. 4: đủ 4 dòng NEW → CLASSIFIED → ASSIGNED → IN_PROGRESS | Cao | 1: `kt1, kt2`. 2: `200` `BH-2026-000022` ASSIGNED, Phạm Huy. 3: `200` IN_PROGRESS. 4: 4 dòng đúng thứ tự (Lê Thu, Trần Minh, Trần Minh, Phạm Huy) | PASS |
| **TC-10** · Phân quyền · bảo mật (OWASP A01) · *NFR4, BR5, TD-13* | Một phiếu Mới, một phiếu đã giao kt1 (tự tạo) | 1. tn1 gọi phân loại. 2. kt2 mở phiếu của kt1. 3. dp1 thêm khách. 4. Gọi API không token. 5. Gọi bằng token giả | Token giả vai trò COORDINATOR, chữ ký sai | 1: `403`, phiếu vẫn Mới. 2: `403 TICKET_NOT_ASSIGNED_TO_YOU`. 3: `403`. 4: `401 TOKEN_REQUIRED`. 5: `401 TOKEN_INVALID` | Cao | 1: `403 ROLE_NOT_ALLOWED`, phiếu vẫn NEW. 2: `403 TICKET_NOT_ASSIGNED_TO_YOU`. 3: `403 ROLE_NOT_ALLOWED`. 4: `401 TOKEN_REQUIRED`. 5: `401 TOKEN_INVALID` | PASS |
| **TC-11** · Danh sách phiếu · luồng đúng + biên + bảo mật (A03) · *UC04, FR4* | Dữ liệu seed + phiếu của TC-04 → TC-10; dp1 | 1. `GET /api/tickets`. 2. Lọc trạng thái + ưu tiên. 3. Tìm bằng chuỗi SQL injection. 4. `pageSize = 101`. 5. Hạn từ > hạn đến | `status=CLASSIFIED&priority=HIGH`; `q=' OR '1'='1`; `dueFrom=2026-12-31&dueTo=2026-01-01` | 1: trang 1, 20 phiếu/trang. 2: mọi dòng đúng điều kiện. 3: `200`, `total = 0`. 4: `400 INVALID_PAGE_SIZE`. 5: `400 INVALID_DATE_RANGE` | Trung bình | 1: `200`, total 24, trang 1/2. 2: 3 phiếu, đều CLASSIFIED + HIGH; đánh dấu quá hạn `BH-2026-000005`, `BH-2026-000007`. 3: `total = 0` (CSDL có 24). 4: `400 INVALID_PAGE_SIZE`. 5: `400 INVALID_DATE_RANGE` | PASS |
| **TC-12** · Khách hàng & thiết bị · luồng đúng + ràng buộc xoá · *S1, S2, TD-13, BR6* | Đăng nhập tn1 | 1. Đếm khách. 2. Thêm, sửa khách. 3. Thêm thiết bị. 4. Xoá khách. 5. Xoá thiết bị. 6. Xoá khách. 7. Đếm lại. 8. Xoá thiết bị mẫu đã có phiếu | "Khách TC12", model Oppo A79; thiết bị mẫu IMEI `354100000007919` | 2, 3: `201`/`200`/`201`. 4: `409 CUSTOMER_HAS_DEVICES`. 5, 6: `204`. 7: số khách trở về như trước. 8: `409 DEVICE_HAS_TICKETS` | Trung bình | `201` · `200` · `201` · `409 CUSTOMER_HAS_DEVICES` · `204` · `204` · khách 33 → 33 · `409 DEVICE_HAS_TICKETS` | PASS |

## Ảnh minh chứng giao diện bổ sung

Các test case trên chạy qua API; cùng các chức năng đó trên giao diện (ảnh chụp khi thao tác thật) nằm ở `docs/ket-qua/anh/`:

| Test case | Ảnh giao diện tương ứng |
|---|---|
| TC-02 | `02-dang-nhap-tai-khoan-khoa.png` |
| TC-03 | `10-m1-2a-sdt-sai.png`, `11-m1-3a-chua-co-khach-hang.png` |
| TC-04 | `14-m1-truoc-khi-luu.png`, `15-m3-phieu-vua-tao.png` |
| TC-06 | `16-m1-5b-dang-co-phieu-chua-dong.png` |
| TC-07, TC-08 | `30-m3-phan-loai.png` |
| TC-09 | `31-m3-phan-cong.png`, `41-m3-lich-su-4-dong.png` |
| TC-10 | `40-kt1-phieu-cua-toi.png`, `42-kt1-khong-co-quyen-m4.png` |
| TC-11 | `20-m2-danh-sach.png`, `21-m2-loc-da-phan-loai-co-qua-han.png`, `22-m2-trang-thai-rong.png` |
| TC-12 | `50-m4-xoa-khach-con-thiet-bi-409.png`, `51-m4-them-khach-va-thiet-bi.png`, `52-m4-xoa-thiet-bi-va-khach.png` |

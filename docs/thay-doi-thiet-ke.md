# Nhật ký thay đổi thiết kế

**Luồng L2 – Tiếp nhận và phân loại yêu cầu bảo hành · Track SE**
**Sinh viên:** Giang Huy Khải – 2374802010205 – Lớp 71k29cntt03 · **Repo:** https://github.com/huykhaii2/baitap02-cdtn1

File này được đọc lại khi chấm BT2 và BT3 (tiêu chí 3: Nhất quán & Tích lũy). Mỗi điểm góp ý có đủ bốn dòng: **phản hồi → quyết định → lý do → ảnh hưởng**. Khi nhận phản hồi BT2, nối tiếp vào cuối file.

---

## Sau phản hồi Bài tập 1 (buổi 8, ngày 19/10/2026)

Điểm BT1: **7.5/10** – Đầy đủ 6.5 · Kỹ thuật 8.5 · Nhất quán 8 · Trình bày 5. Bốn điểm cần khắc phục, cả bốn đều **SỬA**.

### TD-01 Ghi link GitHub ở trang bìa và cuối bài
- **Phản hồi của GV:** Bài không có link GitHub ở trang bìa và cuối bài nên thầy không kiểm được các file `.drawio` gốc.
- **Quyết định:** SỬA
- **Lý do:** Tiêu chí 3 (Nhất quán & Tích lũy) chấm trên repo; không có link thì mọi file gốc (`.drawio`, `schema.sql`, `srs.md`) không được tính. Bản Markdown `docs/srs.md` đã có link nhưng bản PDF nộp bị sót khi xuất.
- **Ảnh hưởng:** Thêm link repo ở đầu `README.md`. Kiểm tra link ở trang bìa và cuối bài trong `docs/srs.md`. Từ BT2: mở file PDF đã xuất để kiểm link trước khi nộp.

### TD-02 Hoàn thiện phụ lục khai báo AI
- **Phản hồi của GV:** Cột "Em đã chỉnh sửa / kiểm chứng gì" còn chữ mẫu; chưa có dòng cam kết với họ tên, MSSV, ngày; bảng nhắc đặc tả UC03 nhưng bài chỉ đặc tả UC01.
- **Quyết định:** SỬA
- **Lý do:** Phụ lục AI là phần bắt buộc của đề; chữ mẫu còn sót cho thấy chưa kiểm chứng thật, và dòng nhắc UC03 mâu thuẫn với nội dung bài (chỉ có đặc tả UC01).
- **Ảnh hưởng:** `docs/srs.md` phụ lục và `docs/ai-disclosure.md`: thay chữ mẫu bằng nội dung đã kiểm chứng; điền họ tên, MSSV, lớp, ngày dưới dòng cam kết; bảng chỉ còn nhắc đặc tả UC01. Thêm dòng khai báo AI cho Sprint 1 (buổi 8) vào `ai-disclosure.md`.

### TD-03 Điền nguồn BR1, BR3, BR4 và sửa trang bìa
- **Phản hồi của GV:** Cột Nguồn của BR1, BR3, BR4 vẫn là chữ mẫu `<Bảng 9.1 – đối chiếu>`; trang bìa còn ký tự định dạng thừa ở dòng Track và chưa ghi lớp.
- **Quyết định:** SỬA
- **Lý do:** Cột Nguồn phân biệt quy tắc lấy từ case study (BR1, BR3, BR4 – Bảng 9.1) với quy tắc do em phân tích (BR2, BR5, BR6); để chữ mẫu thì không truy vết được. Ký tự thừa trên bìa đến từ dấu `` ` `` của Markdown khi xuất PDF.
- **Ảnh hưởng:** `docs/srs.md` mục 1.5 (cột Nguồn) và trang bìa: bỏ dấu `` ` ``, thêm dòng *Lớp: 71k29cntt03*, bỏ ngoặc nhọn ở ngày nộp.

### TD-04 Viết test cho BR2
- **Phản hồi của GV (gợi ý BT2):** Viết test cho BR2 – một IMEI chỉ có một phiếu chưa đóng.
- **Quyết định:** SỬA
- **Lý do:** BR2 được bảo vệ ở hai tầng – TicketService kiểm tra trước khi ghi và CSDL có UNIQUE một phần `ux_ticket_open_device` – nên cần test cho cả hai, cộng ca phiếu cũ đã đóng thì được tạo phiếu mới.
- **Ảnh hưởng:** Thêm `tests/br2.db.test.js` (3 ca, chạy với CSDL thật: `npm run test:db`); unit test có sẵn đổi tên thành `tests/ticketService.unit.test.js` (`npm test`). Không đổi ERD hay mã nghiệp vụ.

---

## Quyết định kỹ thuật khi hiện thực Sprint 1 (buổi 8)

### TD-05 Chốt công nghệ hiện thực: Node.js 22 + Express 4 + PostgreSQL 16
- **Bối cảnh:** README mục 3 ở BT1 ghi "Sẽ cập nhật ở Bài tập 2"; BT1 chỉ chốt ứng dụng web nguyên khối 4 lớp, REST/JSON, PostgreSQL 16.
- **Quyết định:** Dùng Node.js 22 LTS, Express 4, thư viện `pg` (connection pool, SQL tham số hoá), `jsonwebtoken` cho token đăng nhập, `bcryptjs` để băm mật khẩu.
- **Lý do:** Không dùng ORM để giữ đúng sơ đồ kiến trúc: lớp Repository viết SQL tham số hoá, lọc và phân trang ngay trong CSDL (NFR1). Express đủ nhẹ để ánh xạ một–một Controller → Service → Repository.
- **Ảnh hưởng:** README mục 2 và mục 4; `package.json`. Không đổi ERD hay API contract.

### TD-06 Migration dùng IF NOT EXISTS, giữ nguyên db/schema.sql
- **Bối cảnh:** `db/schema.sql` của BT1 là bản DDL skeleton để nộp; chạy lại lần hai báo lỗi `relation "customer" already exists`.
- **Quyết định:** Tạo `db/migrations/001_init_schema.sql` cùng nội dung DDL nhưng thêm `IF NOT EXISTS`, kèm bảng `schema_migrations` ghi lại migration đã chạy. `db/schema.sql` giữ nguyên làm tài liệu thiết kế.
- **Lý do:** Chạy `npm run migrate` nhiều lần không lỗi; mọi thay đổi lược đồ sau này là một file migration mới (002, 003…) thay vì sửa file cũ.
- **Ảnh hưởng:** Thêm thư mục `db/migrations/`, `scripts/migrate.js`. Lược đồ (6 bảng, 7 khoá ngoại, các ràng buộc CHECK và index) không thay đổi.

### TD-07 Sinh mã phiếu BH-YYYY-NNNNNN bằng khoá tư vấn trong giao dịch
- **Bối cảnh:** API contract T1 yêu cầu hệ thống sinh mã phiếu nhưng ERD không có sequence riêng cho mã phiếu.
- **Quyết định:** Trong giao dịch tạo phiếu, TicketRepository gọi `pg_advisory_xact_lock` rồi lấy số thứ tự lớn nhất của năm hiện tại + 1.
- **Lý do:** Hai nhân viên tiếp nhận tạo phiếu cùng lúc không bị trùng mã; không phải thêm bảng hay cột mới vào ERD.
- **Ảnh hưởng:** Chỉ `src/backend/repositories/ticketRepository.js`. ERD giữ nguyên.

---

## Quyết định kỹ thuật khi hiện thực Sprint 2 (buổi 10, ngày 23/10/2026)

### TD-08 Giao diện dùng HTML + JavaScript thuần (ES modules), Express phục vụ cùng cổng với API
- **Bối cảnh:** Sơ đồ kiến trúc BT1 có lớp Giao diện (M1, M2, M3) nhưng chưa chốt công nghệ; slide buổi 10 yêu cầu ≥ 3 màn hình gọi API thật, có `src/api/client.js` và `*.api.js`, không gọi `fetch(` trong màn hình.
- **Quyết định:** `src/frontend/` gồm `api/` (`client.js` là nơi duy nhất gọi `fetch`, `ticket.api.js` ánh xạ từng endpoint), `components/DataState.js` (đang tải · rỗng · lỗi), `pages/` (login, M1, M2, M3). Express phục vụ `src/frontend` bằng `express.static` tại http://localhost:3000/.
- **Lý do:** Không cần bước build hay cài thêm framework, nên README mục 3 giữ được mỗi bước một lệnh; cùng cổng với API nên không phát sinh lỗi CORS (lỗi tích hợp hay gặp nhất của track SE theo slide buổi 10). Phạm vi chỉ 3 màn hình nên chưa cần React/Vue.
- **Ảnh hưởng:** Thêm `src/frontend/*`, một dòng `express.static` trong `src/backend/app.js`. Không đổi ERD, API contract hay lớp nghiệp vụ.

### TD-09 Thu hẹp phạm vi Sprint 2
- **Bối cảnh:** Slide buổi 10 cho phép cắt phần ngoài luồng chính nếu thiếu thời gian, nhưng phải ghi lại.
- **Quyết định:** Phân trang M2 rút gọn thành nút ‹ / › kèm "trang x / y" thay cho dãy số trang như wireframe; chưa đo NFR1 với 10.000 phiếu (chuyển sang trước buổi 12); chưa làm Docker (buổi 11). Giữ nguyên: đủ 3 màn hình, toàn bộ luồng ngoại lệ UC01 và UC03 trên giao diện, ba trạng thái dữ liệu, bộ lọc hạn xử lý từ – đến.
- **Lý do:** Bảng tiêu chí BT2 chấm luồng chính, test và README chứ không chấm số lượng tính năng; dãy số trang không ảnh hưởng FR4 (lọc, tìm, phân trang vẫn đủ).
- **Ảnh hưởng:** Chỉ `src/frontend/pages/ticketList.js`. README mục 6 ghi hai việc còn lại.

### TD-10 Đổi trạng thái kèm các cột nghiệp vụ trong cùng một câu lệnh UPDATE
- **Bối cảnh:** DDL BT1 có ràng buộc `chk_ticket_classified` (đã phân loại thì bắt buộc danh mục, mức ưu tiên, hạn xử lý) và `chk_ticket_assigned` (đã phân công thì bắt buộc kỹ thuật viên). Nếu đổi trạng thái trước rồi mới ghi các cột này thì CSDL chặn ngay câu lệnh đầu.
- **Quyết định:** `TicketRepository.updateStatus` nhận thêm `fields` (`issueCategoryId`, `priority`, `dueDate`, `assignedTo`) và ghi cùng trạng thái trong một câu UPDATE có điều kiện `status = fromStatus`. StatusService vẫn là nơi duy nhất gọi hàm này và ghi lịch sử trong cùng giao dịch.
- **Lý do:** Giữ nguyên ràng buộc CHECK của BT1 (không nới lỏng CSDL để chiều mã); điều kiện `status = fromStatus` đồng thời xử lý trường hợp hai Điều phối viên thao tác cùng lúc (UC03-4b → `409 DATA_CHANGED`).
- **Ảnh hưởng:** `src/backend/repositories/ticketRepository.js`, `src/backend/services/statusService.js`. ERD giữ nguyên.

### TD-11 Bổ sung mã lỗi 400 cho T4 và T6; đổi thứ tự mục README
- **Bối cảnh:** API contract BT1 ghi chung "400 thiếu issueCategoryId hoặc priority" cho T4 và chưa có mã lỗi khi T6 thiếu kỹ thuật viên. Slide buổi 10 gọi phần các bước dựng hệ thống là README mục 3, trong khi README buổi 8 để phần này ở mục 5.
- **Quyết định:** Thêm mã `ISSUE_CATEGORY_REQUIRED`, `ISSUE_CATEGORY_INVALID`, `INVALID_PRIORITY` (T4) và `TECHNICIAN_REQUIRED` (T6) vào `docs/api-contract.md`. Đổi README thành: 1 Giới thiệu · 2 Yêu cầu môi trường · 3 Cài đặt và chạy · 4 Phạm vi · 5 Công nghệ · 6 Trạng thái · 7 Tài liệu.
- **Lý do:** Giao diện cần mã lỗi riêng để hiện đúng thông báo; người chấm đọc README theo số mục trong slide.
- **Ảnh hưởng:** `docs/api-contract.md` mục T4, T6; `README.md`. Không đổi endpoint hay dữ liệu trả về khi thành công.

### TD-12 Lớp nghiệp vụ không còn mang mã HTTP (tiêu chí C2)
- **Bối cảnh:** AppError trước đây mang `status` (400/403/409…) và các service gọi `badRequest`, `forbidden`… – nghĩa là lớp nghiệp vụ biết tới HTTP.
- **Quyết định:** AppError mang `kind` (`INVALID_INPUT`, `NOT_AUTHENTICATED`, `NOT_ALLOWED`, `NOT_FOUND`, `CONFLICT`); hàm tạo lỗi đổi tên theo từ vựng nghiệp vụ (`invalidInput`, `notAuthenticated`, `notAllowed`, `notFound`, `conflict`). Bảng `kind` → mã HTTP nằm duy nhất trong `src/backend/middlewares/errorHandler.js`. Test kiểm `kind` thay vì `status`; thêm `tests/errorHandler.unit.test.js`.
- **Lý do:** Thay giao diện giao tiếp (CLI, hàng đợi…) không phải sửa service; chấm C2 bằng cách tìm `req`, `res`, mã HTTP trong `src/backend/services/` ra rỗng.
- **Ảnh hưởng:** `src/backend/errors/AppError.js`, `src/backend/middlewares/*`, `src/backend/services/*`, `tests/*`. Mã lỗi (`code`) và JSON trả về giữ nguyên.

### TD-13 Bổ sung CRUD khách hàng và thiết bị (tiêu chí S1) – điều chỉnh TD-09
- **Bối cảnh:** BR6 cấm sửa/xoá phiếu nên TD-09 không làm PUT/DELETE phiếu; như vậy chưa có thực thể nào có CRUD đầy đủ, trong khi S1 yêu cầu ≥ 2 thực thể.
- **Quyết định:** Thêm MasterDataService với CRUD cho `customer` và `device` (S1, S2 trong API contract), màn hình M4 Khách hàng & thiết bị. Ràng buộc xoá: khách còn thiết bị → `409 CUSTOMER_HAS_DEVICES`; thiết bị đã có phiếu → `409 DEVICE_HAS_TICKETS`. Chỉ Nhân viên tiếp nhận được ghi; Điều phối viên được đọc.
- **Lý do:** Đủ S1 mà không phá BR6; ràng buộc xoá bảo vệ khoá ngoại và lịch sử phiếu.
- **Ảnh hưởng:** `src/backend/services/masterDataService.js`, repository customer/device, `src/backend/controllers/customerController.js`, `src/frontend/pages/masterData.js`. Không đổi DDL.

### TD-14 Làm lại giao diện và trả 503 khi mất CSDL
- **Quyết định:** Viết lại `src/frontend/styles.css` (nhận diện Mekong Mobile, font Be Vietnam Pro đóng gói trong `src/frontend/fonts/` theo giấy phép OFL, không gọi mạng ngoài), màu riêng cho từng trạng thái phiếu, thanh điều hướng, bố cục dùng được trên điện thoại. `errorHandler` trả `503 DB_UNAVAILABLE` khi mất kết nối CSDL thay vì 500 chung.
- **Lý do:** Giao diện buổi 10 cố ý tối giản; buổi 12 chấm màn hình có ba trạng thái rõ ràng. Mã id/lớp CSS dùng bởi kiểm thử giữ nguyên.
- **Ảnh hưởng:** `src/frontend/*`, `src/backend/middlewares/errorHandler.js`.

### TD-15 Tách src/ thành src/backend và src/frontend
- **Quyết định:** Mã máy chủ (app, config, middlewares, controllers, services, repositories, errors) nằm trong `src/backend/`; giao diện nằm trong `src/frontend/`. `npm start` chạy `src/backend/server.js`; Express phục vụ `src/frontend` bằng `express.static`.
- **Lý do:** Ranh giới giao diện ↔ máy chủ nhìn thấy ngay từ cây thư mục; bốn lớp bên trong backend giữ nguyên.
- **Ảnh hưởng:** Chỉ đổi đường dẫn (`package.json`, `src/backend/app.js`, `require` trong `tests/` và `scripts/`, tài liệu). Không đổi mã nghiệp vụ, API hay CSDL.

---

## Sau phản hồi Bài tập 2 (khắc phục ngày 14/11/2026)

Hai lần nhận xét BT2 cùng một vấn đề gốc: **repo trên GitHub không khớp với báo cáo và README** – lần 1 repo chỉ có Dockerfile, docker-compose, `package.json`, README và tệp `.env` thật; lần 2 repo có khoảng 100 dòng mã trong `backend/` nhưng không có `tests/`, route truy vấn CSDL trực tiếp, service gán mã HTTP, chỉ một thực thể, giao diện một trang. Mục kiểm chứng chưa đạt: **C1, C2, C4, C5, S1, S2, S4**. Các điểm TD-16 → TD-26 dưới đây đều **SỬA**.

### TD-16 Đẩy toàn bộ mã nguồn, tài liệu và tạo tag v0.2 (C1, C4, C5)
- **Phản hồi của GV (lần 1):** Repo `huykhaii2/cdtn1-baitap02` không chứa mã nguồn, không có `tests/`, migration, `docs/`; thầy chấm theo nhánh `main` vì không có tag `v0.2`. Em cần đẩy toàn bộ mã nguồn, tài liệu và tạo tag `v0.2`.
- **Quyết định:** SỬA
- **Lý do:** Mọi mục cốt lõi được chấm trên repo theo tag; thứ gì không có trong repo thì không có minh chứng, dù báo cáo có mô tả.
- **Ảnh hưởng:** Đẩy đủ `src/backend/`, `src/frontend/`, `db/`, `scripts/`, `tests/`, `docs/` (kèm `.drawio` gốc, ảnh xuất, ảnh kết quả). Xoá thư mục `backend/` và `frontend/` cũ (thay bằng `src/` theo TD-15). Tag `v0.2` cũ chỉ có ở máy em và trỏ vào commit thiếu mã nên bỏ; tag `v0.2` mới được tạo trên commit nộp bài của repo `baitap02-cdtn1` và đẩy lên GitHub (TD-26). Kiểm bằng cách clone tag `v0.2` vào thư mục trống và làm đúng README mục 3.

### TD-17 Gỡ .env và backend/db/sql.env khỏi repo, đổi khoá Supabase
- **Phản hồi của GV:** Tệp `.env` thật không được commit (lần 1). Tệp `.env` và `sql.env` chứa khoá Supabase đã bị commit – cần xoá khỏi repo và đổi khoá (lần 2).
- **Quyết định:** SỬA
- **Lý do:** Khoá đã nằm trên GitHub – kể cả trong lịch sử commit – nên phải coi là đã lộ: **đổi khoá trên Supabase là bắt buộc**; xoá tệp chỉ ngăn lộ thêm.
- **Ảnh hưởng:** Xoá `.env` và `backend/db/sql.env`; `.gitignore` chặn `.env`, `.env.*` và `*.env` (chỉ cho phép `.env.example`). `.env.example` chỉ chứa giá trị mẫu, hỗ trợ cả `DATABASE_URL` + `DB_SSL=true` cho CSDL trên mây. `tests/architecture.unit.test.js` kiểm `.gitignore` và `.env.example`. Ngoài repo: vào Supabase đổi mật khẩu database và tạo lại khoá API; khoá mới chỉ lưu trong `.env` ở máy em.

### TD-18 Bổ sung thư mục tests/ (C4)
- **Phản hồi của GV (lần 2):** Báo cáo nêu 33/33 test PASS nhưng repo không có thư mục `tests/`, lệnh `npm test` trỏ tới `tests/*.unit.test.js` không tồn tại.
- **Quyết định:** SỬA
- **Lý do:** C4 là mục cốt lõi; số test trong báo cáo phải lấy từ lần chạy thật trên đúng commit được chấm.
- **Ảnh hưởng:** `tests/` gồm 8 file unit (`npm test`, không cần CSDL: luồng đúng, giá trị biên, dữ liệu sai, phân quyền, `errorHandler`, ranh giới lớp) và 2 file chạy với CSDL thật (`npm run test:db`: BR2 theo TD-04 và kiểm thử API end-to-end). Kết quả chạy lưu ở `docs/ket-qua/02-npm-test.txt`, `docs/ket-qua/03-test-db.txt`; README mục 6 và báo cáo dùng đúng các con số này.

### TD-19 Controller không truy vấn CSDL trực tiếp (C2)
- **Phản hồi của GV (lần 2):** Route truy vấn CSDL trực tiếp qua `pool` (C2).
- **Quyết định:** SỬA
- **Lý do:** Sơ đồ kiến trúc BT1 yêu cầu lớp trên chỉ gọi lớp liền dưới; `backend/routes/tickets.js` cũ gọi `pool.query` ở `/meta/options` và `/meta/summary`.
- **Ảnh hưởng:** Mọi SQL nằm trong `src/backend/repositories/`; controller chỉ đọc request, gọi service, trả JSON (kể cả `GET /api/health` đi qua HealthService → HealthRepository). `tests/architecture.unit.test.js` kiểm controller không import repository / `config/db` và không gọi `.query(`, và chỉ repository mới có câu SQL.

### TD-20 Service không gán mã HTTP (S2) – hiện thực đúng TD-12
- **Phản hồi của GV (lần 2):** Service gán `err.status` mã HTTP (S2).
- **Quyết định:** SỬA
- **Lý do:** TD-12 đã quyết định nhưng mã trong repo (`backend/services/ticketService.js` gán `err.status = 400/404`) chưa làm theo.
- **Ảnh hưởng:** Service chỉ ném `AppError` có `kind`; bảng `kind` → mã HTTP nằm duy nhất trong `src/backend/middlewares/errorHandler.js`. `tests/architecture.unit.test.js` tìm `req`, `res`, `express`, `statusCode`, `err.status =` trong `src/backend/services/` phải ra rỗng (đã thử cài một dòng `err.status = 400` vào service: test báo lỗi đúng).

### TD-21 Thực thể thứ hai và thao tác xoá (S1) – hiện thực đúng TD-13
- **Phản hồi của GV (lần 2):** Mới có phiếu (xem, tạo, đổi trạng thái); không có thực thể thứ hai, không có xoá.
- **Quyết định:** SỬA
- **Lý do:** TD-13 đã chọn CRUD khách hàng và thiết bị để đủ S1 mà không phá BR6 (phiếu không bị xoá).
- **Ảnh hưởng:** S1 (khách hàng) và S2 (thiết bị) đủ xem, thêm, sửa, xoá; màn hình M4. Xoá có ràng buộc ở cả service (`409 CUSTOMER_HAS_DEVICES`, `409 DEVICE_HAS_TICKETS`) và khoá ngoại CSDL. Migration cũ dùng `ON DELETE CASCADE` (xoá khách là mất luôn thiết bị) đã được thay bằng DDL BT1 (khoá ngoại chặn xoá) – xem TD-23.

### TD-22 Giao diện ≥ 3 màn hình và ba trạng thái dữ liệu (S4)
- **Phản hồi của GV (lần 2):** Giao diện một trang khoảng 25 dòng, chưa đủ 3 màn hình và ba trạng thái.
- **Quyết định:** SỬA
- **Lý do:** S4 chấm từng màn hình gọi API thật và có đủ đang tải · rỗng · lỗi; TD-08, TD-14 đã thiết kế nhưng chưa có trong repo.
- **Ảnh hưởng:** `src/frontend/`: đăng nhập, M1 Tạo phiếu (đủ 7 luồng ngoại lệ UC01), M2 Danh sách (lọc, tìm, phân trang, đánh dấu quá hạn), M3 Chi tiết (phân loại / từ chối, phân công, nhận phiếu, lịch sử), M4 Khách hàng & thiết bị. Mọi vùng dữ liệu dùng `components/DataState.js`. Ảnh chạy thật trên CSDL thật (kể cả trạng thái lỗi `503` khi tắt PostgreSQL) ở `docs/ket-qua/anh/`.

### TD-23 Migration và seed đúng DDL BT1 (C5)
- **Phản hồi của GV:** Repo không có migration (lần 1); lần 2 có migration và seed SQL nhưng các mục cốt lõi khác chưa đạt.
- **Quyết định:** SỬA
- **Lý do:** Migration cũ `backend/db/migrations/001_init.sql` lệch ERD BT1 (ticket lưu `customer_id`, thêm bảng `warranty_review`, trạng thái `CLASSIFYING`/`WAITING_PARTS`/`COMPLETED`, mức ưu tiên `NORMAL`/`URGENT`, thiếu `staff` và `ux_ticket_open_device`) – trái tiêu chí 3 (Nhất quán).
- **Ảnh hưởng:** Thay bằng `db/migrations/001_init_schema.sql` (TD-06, cùng nội dung `db/schema.sql` BT1) và `scripts/seed.js` lấy khách hàng, model, mô tả lỗi từ `dataset/` (đã làm sạch SĐT, họ tên). `npm run migrate` và `npm run seed` chạy hai lần liên tiếp không lỗi, lần hai "mới 0" – log ở `docs/ket-qua/01-migrate-seed.txt`.

### TD-24 README và báo cáo khớp với repo; báo cáo nộp PDF
- **Phản hồi của GV (lần 2):** Báo cáo và README không khớp với repo (4 lớp trong `src/backend/`, 4 màn hình, đăng nhập, 33/33 test PASS, Docker). Báo cáo vẫn nộp `.docx` thay vì PDF.
- **Quyết định:** SỬA
- **Lý do:** Người chấm đối chiếu từng câu trong README với repo; một con số sai làm mất tin cậy của cả bài.
- **Ảnh hưởng:** README viết lại theo thứ tự TD-11 và chỉ ghi điều đã chạy thật trên commit nộp (số test, số endpoint, đường dẫn ảnh); việc chưa làm ghi rõ ở mục 6 (NFR1, Docker chưa kiểm). Báo cáo BT2 xuất PDF, đặt tên theo mẫu, mở lại kiểm link repo ở bìa và cuối bài (TD-01).

### TD-25 Thống nhất thông tin cá nhân và link repo trong mọi tài liệu
- **Phản hồi của GV:** Liên quan TD-01, TD-02 – thầy kiểm file gốc qua link repo ghi trong bài.
- **Quyết định:** SỬA
- **Lý do:** Một số chỗ trong `docs/srs.md`, `docs/ai-disclosure.md`, `README.md`, `package.json` còn ghi sai họ tên / MSSV / lớp ở dòng cam kết và trỏ tới repo khác, nên thầy không lần được về đúng repo của em.
- **Ảnh hưởng:** Mọi tài liệu ghi thống nhất *Giang Huy Khải – 2374802010205 – Lớp 71k29cntt03*; mọi link repo trỏ về https://github.com/huykhaii2/baitap02-cdtn1; tên gói trong `package.json` đổi thành `baitap02-cdtn1`.

### TD-26 Chuyển sang repo mới baitap02-cdtn1 với lịch sử commit mới
- **Phản hồi của GV (lần 2):** Tệp `.env` và `sql.env` chứa khoá Supabase đã bị commit – cần xoá khỏi repo và đổi khoá.
- **Quyết định:** SỬA
- **Lý do:** Xoá tệp ở commit mới không xoá được khoá khỏi **lịch sử commit** của repo cũ `huykhaii2/cdtn1-baitap02` – ai mở commit cũ vẫn đọc được. Đẩy mã nguồn sang repo mới với lịch sử bắt đầu từ đầu thì khoá cũ không còn nằm trong repo nộp bài. Khoá cũ vẫn phải đổi trên Supabase (TD-17).
- **Ảnh hưởng:** Repo nộp bài từ BT2 trở đi: https://github.com/huykhaii2/baitap02-cdtn1 (tag `v0.2`). Mọi link trong README, `docs/` và báo cáo đổi sang repo mới. Repo cũ chuyển sang private sau khi báo thầy link mới.


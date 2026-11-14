# Smart CRM – Mekong Mobile · Luồng L2: Tiếp nhận và phân loại yêu cầu bảo hành

**Repo:** https://github.com/huykhaii2/baitap02-cdtn1 · **Bài tập 2:** tag [`v0.2`](https://github.com/huykhaii2/baitap02-cdtn1/tree/v0.2) · **Bài tập 3:** tag [`v1.0`](https://github.com/huykhaii2/baitap02-cdtn1/tree/v1.0) – chạy bằng Docker theo [`docs/deployment-guide.md`](docs/deployment-guide.md)

Đồ án học phần **Chuyên đề tốt nghiệp 1** – Trường Đại học Văn Lang, Khoa Công nghệ Thông tin – Học kỳ 1, năm học 2026 – 2027.

| | |
|---|---|
| Sinh viên | **Giang Huy Khải** – MSSV 2374802010205 – Lớp 71k29cntt03 |
| Giảng viên | ThS. Tran Van Thanh |
| Case study · Luồng · Track | Smart CRM – Mekong Mobile · **L2** – Tiếp nhận và phân loại yêu cầu bảo hành · **SE** |

**Mục lục:** [1. Giới thiệu](#1-giới-thiệu) · [2. Yêu cầu môi trường](#2-yêu-cầu-môi-trường) · [3. Cài đặt và chạy](#3-cài-đặt-và-chạy) · [4. Phạm vi](#4-phạm-vi) · [5. Công nghệ và kiến trúc](#5-công-nghệ-và-kiến-trúc) · [6. Trạng thái](#6-trạng-thái-bài-tập-2--v02) · [7. Tài liệu](#7-tài-liệu)

---

## 1. Giới thiệu

Mekong Mobile tiếp nhận yêu cầu bảo hành thiết bị tại cửa hàng nhưng còn ghi chép thủ công, nên khó biết phiếu nào đang chờ, phiếu nào trễ hạn và ai đang xử lý. Hệ thống số hoá đoạn từ lúc khách mang thiết bị đến quầy cho tới khi **phiếu bảo hành** được phân loại, đặt **mức ưu tiên** và giao cho **kỹ thuật viên**.

- **Nhân viên tiếp nhận** tra cứu khách hàng theo số điện thoại, thiết bị theo IMEI rồi tạo phiếu; hệ thống sinh mã `BH-YYYY-NNNNNN`, cảnh báo thiết bị hết hạn bảo hành (BR3) và chặn thiết bị đang có phiếu chưa đóng (BR2).
- **Điều phối viên** phân loại phiếu (danh mục lỗi, mức ưu tiên – hạn xử lý tự tính theo BR4) hoặc từ chối kèm lý do, rồi phân công kỹ thuật viên đang hoạt động.
- **Kỹ thuật viên** chỉ thấy phiếu được giao cho mình và xác nhận nhận phiếu.
- Mọi lần đổi trạng thái được ghi lịch sử trong cùng giao dịch (NFR5); phiếu không bao giờ bị sửa nội dung tiếp nhận hay bị xoá (BR6).
- Quản lý khách hàng và thiết bị: xem, thêm, sửa, xoá có ràng buộc (TD-13).

| Màn hình | Đường dẫn | Vai trò | Use case |
|---|---|---|---|
| Đăng nhập | `#/login` | mọi vai trò | A1 |
| M1 – Tạo phiếu bảo hành | `#/tickets/new` | Nhân viên tiếp nhận | UC01, UC07 |
| M2 – Danh sách phiếu bảo hành | `#/tickets` | mọi vai trò (kỹ thuật viên: phiếu của mình) | UC04 |
| M3 – Chi tiết phiếu bảo hành | `#/tickets/{mã phiếu}` | mọi vai trò, nút hiện theo vai trò + trạng thái | UC02, UC03, UC05, UC06 |
| M4 – Khách hàng & thiết bị | `#/data` | Nhân viên tiếp nhận (Điều phối viên chỉ xem) | UC08 (S1, S2) |

Mọi vùng dữ liệu có ba trạng thái: **đang tải**, **rỗng** và **lỗi** kèm nút *Thử lại*. Ảnh chạy thật: [`docs/ket-qua/anh/`](docs/ket-qua/anh/).

## 2. Yêu cầu môi trường

| Thành phần | Phiên bản | Kiểm tra bằng |
|---|---|---|
| Node.js (kèm npm) | **22 LTS** (tối thiểu 20 – khai báo ở `package.json` › `engines`) | `node -v` |
| PostgreSQL | **16** – cần tài khoản có quyền tạo database | `psql --version` |
| Git | bản bất kỳ | `git --version` |
| Trình duyệt | Chrome / Edge / Firefox bản mới (giao diện dùng ES modules, không cần build) | — |
| Cổng | **3000** (web + API) và **5432** (PostgreSQL) còn trống | — |

**Tệp khoá phiên bản thư viện:** `package-lock.json` (đã commit) – `npm install` cài đúng phiên bản trong tệp này.

**Biến môi trường** – sao chép `.env.example` thành `.env` (bước 6). `.env` nằm trong `.gitignore`, **không commit**.

| Biến | Ý nghĩa | Giá trị mẫu |
|---|---|---|
| `DB_HOST`, `DB_PORT`, `DB_NAME` | địa chỉ CSDL | `localhost`, `5432`, `smartcrm` |
| `DB_USER`, `DB_PASSWORD` | tài khoản PostgreSQL (khớp bước 4) | `smartcrm`, `smartcrm` |
| `DATABASE_URL`, `DB_SSL` | *(tuỳ chọn)* dùng thay 5 biến trên khi CSDL ở trên mây (Supabase…) | `postgres://…`, `true` |
| `APP_PORT` | cổng ứng dụng | `3000` |
| `SECRET_KEY` | khoá ký token đăng nhập – chuỗi ngẫu nhiên dài | *(tự đặt)* |
| `TOKEN_EXPIRES_IN` | thời hạn token | `8h` |

## 3. Cài đặt và chạy

Mỗi bước một lệnh, chạy lần lượt trong terminal, bắt đầu từ thư mục chứa repo. Lệnh `psql` ở bước 4–5 dùng tài khoản quản trị PostgreSQL của máy (thường là `postgres`; trên Windows có thể cần gọi bằng đường dẫn đầy đủ, ví dụ `& "C:\Program Files\PostgreSQL\16\bin\psql.exe"`).

| # | Việc | Lệnh |
|---|---|---|
| 1 | Lấy mã nguồn bản nộp | `git clone --branch v0.2 https://github.com/huykhaii2/baitap02-cdtn1.git` |
| 2 | Vào thư mục dự án | `cd baitap02-cdtn1` |
| 3 | Cài thư viện | `npm install` |
| 4 | Tạo tài khoản CSDL | `psql -U postgres -c "CREATE USER smartcrm WITH PASSWORD 'smartcrm';"` |
| 5 | Tạo CSDL | `psql -U postgres -c "CREATE DATABASE smartcrm OWNER smartcrm;"` |
| 6 | Tạo file cấu hình | `cp .env.example .env` (Windows: `copy .env.example .env`) |
| 7 | Tạo 6 bảng theo DDL BT1 | `npm run migrate` |
| 8 | Nạp dữ liệu mẫu | `npm run seed` |
| 9 | Chạy hệ thống (API + giao diện) | `npm start` → mở **http://localhost:3000** |
| 10 | Unit test lớp nghiệp vụ (không cần CSDL) | `npm test` |
| 11 | Test với CSDL thật (cần bước 7–8) | `npm run test:db` |
| 12 | Gọi thử toàn bộ API (terminal khác, khi bước 9 đang chạy) | `bash scripts/demo-api.sh` |
| 13 | Chạy 12 test case hệ thống (terminal khác, khi bước 9 đang chạy) | `node scripts/tc.js all` (một test case: `node scripts/tc.js TC-05`) |

Bước 7 và 8 chạy lại nhiều lần không lỗi, không nhân đôi dữ liệu (lần hai in "mới 0"). Bước 11 tự tạo dữ liệu thử với SĐT / IMEI ngẫu nhiên và dọn lại sau khi chạy.

### Tài khoản mẫu
Mật khẩu chung `Matkhau@123` (chỉ dùng ở máy phát triển).

| Tên đăng nhập | Người | Vai trò | Làm được gì trên giao diện |
|---|---|---|---|
| `tn1` | Lê Thu | Nhân viên tiếp nhận | M1 tạo phiếu, M2 danh sách, M3 xem, M4 quản lý khách hàng và thiết bị |
| `dp1` | Trần Minh | Điều phối viên | M3 phân loại / từ chối, phân công; M4 chỉ xem |
| `kt1`, `kt2` | Phạm Huy, Võ Lan | Kỹ thuật viên | M2 chỉ phiếu của mình, M3 xác nhận nhận phiếu |
| `kt3` | Đỗ Nam | Kỹ thuật viên đã khoá | đăng nhập bị từ chối |

### Chạy thử luồng chính (5 phút)
1. Đăng nhập `tn1` → màn hình M1 → số điện thoại `0901234567` → *Tra cứu* → IMEI `356789012345678` → *Kiểm tra* → nhập mô tả lỗi → *Lưu phiếu* → mở M3 của phiếu mới.
2. Đăng xuất, đăng nhập `dp1` → mở phiếu → chọn danh mục lỗi và mức ưu tiên → *Lưu phân loại* → chọn kỹ thuật viên **Phạm Huy** → *Phân công*.
3. Đăng xuất, đăng nhập `kt1` → mở phiếu → *Xác nhận nhận phiếu*. Lịch sử trạng thái có đủ 4 dòng.

Thử luồng ngoại lệ ở M1: IMEI `356789012345679` (hết hạn bảo hành – 5c), IMEI 15 số chưa có (5a), số điện thoại chưa có (3a), làm lại bước 1 với cùng IMEI (đang có phiếu chưa đóng – 5b).

### Lỗi hay gặp

| Thông báo | Cách xử lý |
|---|---|
| `Thiếu biến môi trường …` | Chưa làm bước 6 |
| `ECONNREFUSED 127.0.0.1:5432` | PostgreSQL chưa chạy – khởi động dịch vụ PostgreSQL rồi chạy lại bước 7 |
| `password authentication failed for user "smartcrm"` | Mật khẩu ở bước 4 khác `DB_PASSWORD` trong `.env` |
| `Chưa có bảng. Chạy npm run migrate trước.` | Chạy bước 7 trước bước 8 |
| `Cổng 3000 đang bận` | Đổi `APP_PORT` trong `.env` |
| Giao diện báo `DB_UNAVAILABLE` | Ứng dụng đang chạy nhưng mất kết nối CSDL – bật lại PostgreSQL rồi bấm *Thử lại* |

## 4. Phạm vi

| Mã | Chức năng | MoSCoW | Trạng thái |
|---|---|---|---|
| FR1 | Tạo phiếu bảo hành từ số điện thoại khách hàng và IMEI thiết bị | MUST | Có |
| FR2 | Phân loại theo danh mục lỗi, đặt mức ưu tiên (hoặc Từ chối kèm lý do) | MUST | Có |
| FR3 | Phân công kỹ thuật viên | MUST | Có |
| FR4 | Tra cứu danh sách phiếu: lọc trạng thái, mức ưu tiên, khoảng hạn xử lý; tìm mã phiếu / SĐT; phân trang 20 phiếu | SHOULD | Có |
| FR5 | Cập nhật trạng thái và lưu lịch sử trạng thái | SHOULD | Có |
| — | CRUD khách hàng (S1) và thiết bị (S2) có ràng buộc khi xoá (TD-13) | SHOULD | Có |
| FR6 | Gửi SMS cho khách hàng | WON'T | Ngoài phạm vi |

**Ngoài phạm vi (WON'T):** gửi SMS; sửa chữa, linh kiện, trả máy; tính phí; khách tự tạo phiếu trực tuyến; báo cáo thống kê; quản lý tài khoản nhân viên (nạp sẵn bằng seed).

**Quy tắc nghiệp vụ** (đầy đủ trong `docs/srs.md` mục 1.5):
BR1 mỗi phiếu gắn đúng một khách hàng và một thiết bị ·
BR2 một IMEI chỉ có tối đa một phiếu chưa đóng ·
BR3 thiết bị tiếp nhận sau ngày hết hạn bảo hành vẫn tạo phiếu nhưng bị đánh dấu *Hết hạn bảo hành* ·
BR4 hạn xử lý = thời điểm phân loại + 24 giờ (Cao) / 72 giờ (Trung bình) / 120 giờ (Thấp) ·
BR5 chỉ Điều phối viên phân loại, phân công, từ chối; chỉ phân công cho kỹ thuật viên đang hoạt động ·
BR6 trạng thái đi theo thứ tự Mới → Đã phân loại → Đã phân công → Đang xử lý, không quay lui; *Từ chối* chỉ khi phiếu đang *Mới* và phải có lý do; phiếu không bao giờ bị xoá.

## 5. Công nghệ và kiến trúc

Ứng dụng web nguyên khối 4 lớp, REST/JSON: **Node.js 22 + Express 4**, **PostgreSQL 16** qua thư viện `pg` (connection pool, SQL tham số hoá, không ORM), token đăng nhập `jsonwebtoken`, băm mật khẩu `bcryptjs`, đọc `.env` bằng `dotenv`. Giao diện: HTML + JavaScript thuần (ES modules), font Be Vietnam Pro đóng gói sẵn (OFL), Express phục vụ cùng cổng với API. Lý do chọn: `docs/thay-doi-thiet-ke.md` – TD-05, TD-08.

Thư mục `src/` ánh xạ một–một với sơ đồ kiến trúc ([`docs/architecture.drawio`](docs/architecture.drawio), ảnh [`docs/export/architecture.png`](docs/export/architecture.png)):

| Lớp trong sơ đồ | Thành phần | File |
|---|---|---|
| 1. Giao diện | Đăng nhập, M1, M2, M3, M4 | `src/frontend/pages/` · `src/frontend/api/` (gọi API) · `src/frontend/components/` (DataState, tiện ích) |
| 2. API | AuthMiddleware · AuthController · TicketController · CustomerController · errorHandler | `src/backend/middlewares/`, `src/backend/controllers/` |
| 3. Nghiệp vụ | TicketService · ClassifyService · AssignService · StatusService · MasterDataService · AuthService | `src/backend/services/` (quy tắc chung ở `rules.js`, kiểm tra dữ liệu ở `validators.js`) |
| 4. Truy cập dữ liệu | Customer · Device · Ticket · IssueCategory · Staff · StatusLog Repository | `src/backend/repositories/` |
| CSDL | 6 bảng, 7 khoá ngoại | `db/migrations/001_init_schema.sql` (từ `db/schema.sql` BT1) |

**Ba quy ước được kiểm bằng test** (`tests/architecture.unit.test.js`):
- Lớp nghiệp vụ **không biết HTTP**: không dùng `req`, `res`, `express` hay gán mã trạng thái; service chỉ ném lỗi nghiệp vụ có `kind`; duy nhất `src/backend/middlewares/errorHandler.js` đổi `kind` thành mã HTTP (TD-12). Mất CSDL → `503 DB_UNAVAILABLE` (TD-14).
- Controller **không truy vấn CSDL**: không import repository hay `config/db`; mọi câu SQL nằm trong `src/backend/repositories/`.
- Giao diện chỉ gọi `fetch()` trong `src/frontend/api/client.js`; màn hình chỉ gọi hàm trong `*.api.js`. Kiểm tay: `grep -rn "fetch(" src/frontend/pages` phải ra rỗng.

**API:** 14 endpoint nghiệp vụ (A1, C1, C2, D1, T1–T8, L1, L2) cộng CRUD khách hàng (S1) và thiết bị (S2), cộng `GET /api/health`. Đầu vào, đầu ra, mã lỗi và quyền từng vai trò: [`docs/api-contract.md`](docs/api-contract.md). Không có `PUT`/`DELETE` cho phiếu bảo hành vì BR6.

```
baitap02-cdtn1/
├── src/
│   ├── backend/
│   │   ├── app.js, server.js   # lắp ráp Express, khởi động máy chủ
│   │   ├── config/             # đọc .env, connection pool + giao dịch
│   │   ├── middlewares/        # AuthMiddleware, errorHandler (kind → mã HTTP), header bảo mật
│   │   ├── controllers/        # Auth, Health, Customer, Ticket – mỗi file là một Express Router
│   │   ├── services/           # quy tắc BR1–BR6, kiểm tra vai trò, CRUD khách hàng/thiết bị
│   │   ├── repositories/       # SQL tham số hoá
│   │   └── errors/             # AppError (kind, code) – không mang mã HTTP
│   └── frontend/               # index.html, app.js, styles.css, api/, components/, pages/, fonts/
├── db/schema.sql               # DDL nộp ở BT1 (tài liệu)
├── db/migrations/              # migration chạy thật: 001_init_schema.sql
├── dataset/                    # dữ liệu case study – nguồn cho seed
├── scripts/                    # migrate.js, seed.js, demo-api.sh, tc.js (12 test case)
├── tests/                      # *.unit.test.js (npm test) · *.db.test.js (npm run test:db) · helpers/
├── docs/                       # SRS, sơ đồ .drawio + ảnh xuất, API contract, nhật ký thay đổi, bug log, kết quả chạy
├── Dockerfile, docker-compose.yml, .dockerignore
└── .env.example
```

## 6. Trạng thái (Bài tập 2 – `v0.2`)

| Lệnh | Nội dung | Kết quả trên commit nộp |
|---|---|---|
| `npm test` | 82 unit test, không cần CSDL: luồng đúng · giá trị biên · dữ liệu sai · phân quyền (NFR4) · bảng chuyển trạng thái (BR6) · `errorHandler` · ranh giới lớp | **82 / 82 pass** – [`docs/ket-qua/02-npm-test.txt`](docs/ket-qua/02-npm-test.txt) |
| `npm run test:db` | 19 test với PostgreSQL thật: 3 ca BR2 (TD-04) + 16 ca API end-to-end | **19 / 19 pass** – [`docs/ket-qua/03-test-db.txt`](docs/ket-qua/03-test-db.txt) |
| `npm run migrate`, `npm run seed` (2 lần) | chạy lại không lỗi, không trùng | [`docs/ket-qua/01-migrate-seed.txt`](docs/ket-qua/01-migrate-seed.txt) |
| `bash scripts/demo-api.sh` | gọi toàn bộ luồng chính bằng curl | [`docs/ket-qua/04-demo-api.txt`](docs/ket-qua/04-demo-api.txt) |
| `node scripts/tc.js all` | 12 test case hệ thống theo chức năng, máy chủ + CSDL thật | **12 / 12 PASS** – [`docs/test-report.md`](docs/test-report.md), ảnh [`docs/ket-qua/test-case/`](docs/ket-qua/test-case/) |

- [x] Luồng chính UC01 → UC02 → UC03 → UC05 → UC06 chạy end-to-end trên giao diện với dữ liệu thật
- [x] Đủ 7 luồng ngoại lệ UC01 trên M1; xung đột UC03-4b trả `409 DATA_CHANGED`
- [x] BR1–BR6 và kiểm tra vai trò ở lớp nghiệp vụ; mọi lần đổi trạng thái ghi lịch sử trong cùng giao dịch
- [x] Lớp nghiệp vụ không chứa `req`/`res`/mã HTTP (TD-12); controller không truy vấn CSDL
- [x] CRUD khách hàng và thiết bị, xoá có ràng buộc (TD-13)
- [x] Mất kết nối CSDL trả `503 DB_UNAVAILABLE`, giao diện hiện lỗi kèm *Thử lại* (TD-14)
- [x] Tách `src/backend` và `src/frontend` (TD-15); giao diện dùng được trên điện thoại
- [x] `.env` thật không còn trong repo (TD-17); repo mới `baitap02-cdtn1` có lịch sử commit sạch, không chứa khoá cũ (TD-26)
- [ ] **Chưa đo NFR1** (≤ 2 giây p95 với 10.000 phiếu) – đã có index `(status, due_date)` và phân trang trong CSDL; đo trước BT3
- [x] **Đóng gói Docker (BT3):** `cp .env.example .env` + `docker compose up -d --build` → `app`, `db` healthy; `npm test` 82/82 và `npm run test:db` 19/19 trong container – ảnh `docs/ket-qua/docker/`, hướng dẫn `docs/deployment-guide.md`

Các thay đổi so với thiết kế BT1 và lý do: [`docs/thay-doi-thiet-ke.md`](docs/thay-doi-thiet-ke.md) (TD-01 → TD-26). Lỗi đã gặp và cách sửa: [`docs/bug-log.md`](docs/bug-log.md).

## 7. Tài liệu

| Tài liệu | File | Cách mở |
|---|---|---|
| SRS rút gọn, Use Case, kiến trúc, mô hình dữ liệu | [`docs/srs.md`](docs/srs.md) | Xem trực tiếp trên GitHub |
| Use Case Diagram | [`docs/usecase.drawio`](docs/usecase.drawio) · ảnh [`docs/export/usecase.png`](docs/export/usecase.png) | [draw.io](https://app.diagrams.net) (File → Open) hoặc extension *Draw.io Integration* trong VS Code |
| Sơ đồ kiến trúc | [`docs/architecture.drawio`](docs/architecture.drawio) · ảnh [`docs/export/architecture.png`](docs/export/architecture.png) | như trên |
| ERD | [`docs/erd.drawio`](docs/erd.drawio) · ảnh [`docs/export/erd.png`](docs/export/erd.png) | như trên |
| Wireframe BT1 | [`docs/wireframe.drawio`](docs/wireframe.drawio) · ảnh [`docs/wireframe.png`](docs/wireframe.png) · đối chiếu ERD [`docs/wireframe.md`](docs/wireframe.md) | như trên |
| Giao diện hiện tại | [`docs/wireframe-v0.2.png`](docs/wireframe-v0.2.png) | Ảnh chụp M1–M3 của bản `v0.2` |
| SQL DDL | [`db/schema.sql`](db/schema.sql) | Bản nộp BT1; chạy thật bằng `npm run migrate` |
| API contract (tiếng Việt) | [`docs/api-contract.md`](docs/api-contract.md) | Xem trực tiếp trên GitHub |
| **API docs (English, TP6)** | [`docs/api-docs.md`](docs/api-docs.md) | Mỗi endpoint 7 mục, ví dụ request/response chạy thật |
| **Deployment Guide (English, TP5)** | [`docs/deployment-guide.md`](docs/deployment-guide.md) | 5 mục + Troubleshooting + Monitoring |
| **Checklist bảo mật 7 mục (TP5)** | [`docs/checklist-bao-mat.md`](docs/checklist-bao-mat.md) | Mỗi mục có lệnh kiểm tra và ảnh `docs/ket-qua/bao-mat/` |
| Nhật ký thay đổi thiết kế | [`docs/thay-doi-thiet-ke.md`](docs/thay-doi-thiet-ke.md) | Xem trực tiếp trên GitHub |
| Nhật ký lỗi | [`docs/bug-log.md`](docs/bug-log.md) | Xem trực tiếp trên GitHub |
| Khai báo sử dụng AI | [`docs/ai-disclosure.md`](docs/ai-disclosure.md) | Xem trực tiếp trên GitHub |
| Test Plan · Test Report (12 test case) | [`docs/test-plan.md`](docs/test-plan.md) · [`docs/test-report.md`](docs/test-report.md) | Xem trực tiếp trên GitHub |
| Kết quả chạy | [`docs/ket-qua/`](docs/ket-qua/) | Log lệnh, ảnh giao diện, ảnh test case |

**Nhật ký phiên bản**

| Phiên bản | Ngày | Nội dung |
|---|---|---|
| 1.0 | 09/10/2026 | Nộp Bài tập 1 – Phân tích và Thiết kế |
| 1.1 | 19/10/2026 | Sửa theo phản hồi BT1 (TD-01 → TD-04); Sprint 1 – công nghệ, migration, sinh mã phiếu (TD-05 → TD-07) |
| 1.2 | 23/10/2026 | Sprint 2 – thiết kế giao diện, phạm vi, tách lớp nghiệp vụ khỏi HTTP, CRUD S1/S2 (TD-08 → TD-15) |
| 1.3 | 14/11/2026 | Khắc phục sau phản hồi BT2 (TD-16 → TD-26): đẩy đủ mã nguồn, test, migration, tài liệu; gỡ `.env`; chuyển sang repo mới `baitap02-cdtn1`, tag `v0.2` |
| 1.4 | 14/11/2026 | Bài tập 3 (`v1.0`): 12 test case + Test Plan / Report, đóng gói Docker (2 lệnh), Deployment Guide và API docs tiếng Anh, checklist bảo mật 7 mục, Bug Log 7 lỗi |

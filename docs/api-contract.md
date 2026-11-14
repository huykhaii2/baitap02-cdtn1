# API contract – Luồng L2: Tiếp nhận và phân loại yêu cầu bảo hành

**Sinh viên:** Giang Huy Khải – 2374802010205 – Lớp 71k29cntt03 · **Repo:** https://github.com/huykhaii2/baitap02-cdtn1

Ứng dụng web nguyên khối 4 lớp, REST/JSON, cổng mặc định `3000`. Mọi đường dẫn bắt đầu bằng `/api`.
Bản này khớp với mã nguồn bản `v0.2` (`src/backend/controllers/*.js`) và được kiểm bằng `tests/api.db.test.js` (`npm run test:db`).

## 1. Quy ước chung

| Mục | Quy ước |
|---|---|
| Định dạng | `Content-Type: application/json; charset=utf-8`, thời điểm theo ISO 8601 (UTC), ngày theo `YYYY-MM-DD` |
| Xác thực | Mọi API trừ `GET /api/health` và A1 cần header `Authorization: Bearer <token>` (JWT, hết hạn theo `TOKEN_EXPIRES_IN`, mặc định 8 giờ) |
| Phân quyền | Kiểm tra ở **lớp nghiệp vụ** (NFR4), không dựa vào việc ẩn nút trên giao diện |
| Lỗi | Thân lỗi luôn có dạng `{ "error": { "code": "…", "message": "…", "details": { … } } }` – `details.field` cho biết ô nhập bị lỗi |
| Mã HTTP | Lớp nghiệp vụ chỉ ném lỗi có `kind`; `src/backend/middlewares/errorHandler.js` là nơi duy nhất đổi `kind` → mã HTTP (TD-12) |

| `kind` (lớp nghiệp vụ) | Mã HTTP | Khi nào |
|---|---|---|
| `INVALID_INPUT` | 400 | Dữ liệu sai định dạng, thiếu trường bắt buộc |
| `NOT_AUTHENTICATED` | 401 | Thiếu token, token sai / hết hạn, sai tên đăng nhập hoặc mật khẩu |
| `NOT_ALLOWED` | 403 | Vai trò không được phép; tài khoản bị khoá; kỹ thuật viên mở phiếu không phải của mình |
| `NOT_FOUND` | 404 | Không có bản ghi; đường dẫn API không tồn tại (`ROUTE_NOT_FOUND`) |
| `CONFLICT` | 409 | Vi phạm quy tắc nghiệp vụ (BR2, BR6), trùng dữ liệu, dữ liệu vừa bị người khác đổi |
| *(lỗi hạ tầng)* | 503 | Mất kết nối CSDL – `DB_UNAVAILABLE` (TD-14) |
| *(lỗi hạ tầng)* | 500 | Lỗi không lường trước – `INTERNAL_ERROR`, không lộ chi tiết ra ngoài |

**Mã lỗi dùng chung:** `TOKEN_REQUIRED`, `TOKEN_INVALID` (401) · `ROLE_NOT_ALLOWED` (403) · `INVALID_JSON` (400) · `INVALID_PAGE`, `INVALID_PAGE_SIZE`, `INVALID_ID` (400) · `DB_UNAVAILABLE` (503).

**Vai trò:** `RECEPTIONIST` – Nhân viên tiếp nhận · `COORDINATOR` – Điều phối viên · `TECHNICIAN` – Kỹ thuật viên.

## 2. Bảng tổng hợp

| Mã | Phương thức · Đường dẫn | Vai trò được gọi | Thành công | Use case / FR |
|---|---|---|---|---|
| — | `GET /api/health` | không cần đăng nhập | 200 | Kiểm tra hệ thống, CSDL |
| A1 | `POST /api/auth/login` | không cần đăng nhập | 200 | Đăng nhập |
| C1 | `GET /api/customers/by-phone/{phone}` | RECEPTIONIST, COORDINATOR | 200 | UC07 Tra cứu khách hàng |
| C2 | `POST /api/customers` | RECEPTIONIST | 201 | UC01-3a Tạo khách hàng mới |
| D1 | `GET /api/devices/by-imei/{imei}` | RECEPTIONIST, COORDINATOR | 200 | UC01 bước 5 (BR2, BR3) |
| T1 | `POST /api/tickets` | RECEPTIONIST | 201 | UC01 / FR1 |
| T2 | `GET /api/tickets` | mọi vai trò (TECHNICIAN chỉ thấy phiếu của mình) | 200 | UC04 / FR4 |
| T3 | `GET /api/tickets/{code}` | mọi vai trò (TECHNICIAN chỉ phiếu của mình) | 200 | M3 |
| T4 | `POST /api/tickets/{code}/classify` | COORDINATOR | 200 | UC02 / FR2 |
| T5 | `POST /api/tickets/{code}/reject` | COORDINATOR | 200 | UC02 – Từ chối (BR6) |
| T6 | `POST /api/tickets/{code}/assign` | COORDINATOR | 200 | UC03 / FR3 |
| T7 | `POST /api/tickets/{code}/acknowledge` | TECHNICIAN được giao | 200 | UC05 / FR5 |
| T8 | `GET /api/tickets/{code}/history` | như T3 | 200 | UC06 / FR5 |
| L1 | `GET /api/issue-categories` | mọi vai trò | 200 | Danh mục lỗi cho T4 |
| L2 | `GET /api/technicians` | COORDINATOR | 200 | Kỹ thuật viên cho T6 |
| S1 | `GET /api/customers` · `GET /api/customers/{id}` · `PUT /api/customers/{id}` · `DELETE /api/customers/{id}` (tạo: C2) | đọc: RECEPTIONIST, COORDINATOR · ghi: RECEPTIONIST | 200 / 204 | UC08 – CRUD khách hàng (TD-13) |
| S2 | `GET /api/devices?customerId=` · `GET /api/devices/{id}` · `POST /api/devices` · `PUT /api/devices/{id}` · `DELETE /api/devices/{id}` | đọc: RECEPTIONIST, COORDINATOR · ghi: RECEPTIONIST | 200 / 201 / 204 | UC08 – CRUD thiết bị (TD-13) |

Không có `PUT` / `DELETE` cho phiếu bảo hành: BR6 – phiếu không bao giờ bị sửa nội dung tiếp nhận hay bị xoá; gọi vào sẽ nhận `404 ROUTE_NOT_FOUND`.

## 3. Chi tiết

### — `GET /api/health`
`200 {"status":"ok","db":"ok","service":"Smart CRM – Mekong Mobile · L2"}` · `503 DB_UNAVAILABLE` khi PostgreSQL không kết nối được.

### A1 – `POST /api/auth/login`
Body `{ "username": "tn1", "password": "Matkhau@123" }` (tên đăng nhập không phân biệt hoa thường).
`200 { "token": "<JWT>", "staff": { "id": 1, "username": "tn1", "fullName": "Lê Thu", "role": "RECEPTIONIST" } }`

| Lỗi | Khi nào |
|---|---|
| 400 `CREDENTIALS_REQUIRED` | thiếu tên đăng nhập hoặc mật khẩu |
| 401 `INVALID_CREDENTIALS` | sai tên hoặc sai mật khẩu (cùng một thông báo, không lộ tài khoản nào tồn tại) |
| 403 `ACCOUNT_LOCKED` | tài khoản `is_active = false` (ví dụ `kt3`) |

### C1 – `GET /api/customers/by-phone/{phone}`
`phone` chấp nhận `0901234567`, `0901 234 567`, `0901.234.567`, `+84901234567`.
`200 { "id", "fullName", "phone", "createdAt", "devices": [ Device… ] }` · `400 INVALID_PHONE` (UC01-2a) · `404 CUSTOMER_NOT_FOUND` (UC01-3a).

### C2 – `POST /api/customers`
Body `{ "fullName": "Trần Thị Mai", "phone": "0912345678" }` → `201 Customer`.
Lỗi: `400 FULL_NAME_REQUIRED`, `400 FULL_NAME_TOO_LONG` (> 100 ký tự), `400 INVALID_PHONE`, `409 PHONE_EXISTS`.

### D1 – `GET /api/devices/by-imei/{imei}`
`200`:
```json
{ "id": 1, "customerId": 1, "imei": "356789012345678", "model": "Samsung Galaxy A55",
  "warrantyEndDate": "2027-03-10", "warrantyExpired": false, "ticketCount": 0,
  "customer": { "id": 1, "fullName": "Nguyễn Văn An", "phone": "0901234567" },
  "openTicket": null }
```
`openTicket` khác `null` ⇒ thiết bị đang có phiếu chưa đóng (UC01-5b, BR2). `warrantyExpired` tính khi truy vấn (BR3), không lưu cột.
Lỗi: `400 INVALID_IMEI` (UC01-4a), `404 DEVICE_NOT_FOUND` (UC01-5a).

### T1 – `POST /api/tickets`
```json
{ "phone": "0901234567", "imei": "356789012345678", "issueDescription": "Máy tự tắt khi còn 30% pin",
  "customer": { "fullName": "…" },
  "device":   { "model": "…", "warrantyEndDate": "2027-08-31" } }
```
`customer` chỉ gửi khi SĐT chưa có (UC01-3a); `device` chỉ gửi khi IMEI chưa có (UC01-5a). Cả khách hàng, thiết bị, phiếu và dòng lịch sử đầu tiên được ghi trong **một giao dịch**.
`201 Ticket` (xem mục 4) với `status = "NEW"`, `ticketCode = "BH-YYYY-NNNNNN"` (năm theo giờ Việt Nam, tăng dần, sinh bằng khoá tư vấn – TD-07).

| Lỗi | Khi nào |
|---|---|
| 400 `INVALID_PHONE` · `INVALID_IMEI` | UC01-2a · UC01-4a |
| 400 `DESCRIPTION_REQUIRED` · `DESCRIPTION_TOO_LONG` | UC01-7a · > 2000 ký tự |
| 400 `FULL_NAME_REQUIRED` · `MODEL_REQUIRED` · `INVALID_WARRANTY_END_DATE` | dữ liệu khách hàng / thiết bị mới không hợp lệ |
| 403 `ROLE_NOT_ALLOWED` | người gọi không phải Nhân viên tiếp nhận |
| 404 `CUSTOMER_NOT_FOUND` · `DEVICE_NOT_FOUND` | SĐT / IMEI chưa có mà không gửi kèm `customer` / `device` |
| 409 `DEVICE_OWNED_BY_OTHER` | IMEI đã đăng ký cho khách hàng khác (BR1) |
| 409 `OPEN_TICKET_EXISTS` | thiết bị đang có phiếu chưa đóng – `details.ticketCode` là phiếu đó (BR2, UC01-5b) |

### T2 – `GET /api/tickets`
Query (đều không bắt buộc): `q` (mã phiếu hoặc SĐT, ≤ 50 ký tự) · `status` (`NEW|CLASSIFIED|ASSIGNED|IN_PROGRESS|REJECTED`) · `priority` (`HIGH|MEDIUM|LOW`) · `dueFrom`, `dueTo` (`YYYY-MM-DD`, tính trọn ngày theo giờ Việt Nam) · `page` (≥ 1, mặc định 1) · `pageSize` (1–100, mặc định 20).
Lọc, tìm và phân trang làm trong CSDL (NFR1); sắp xếp phiếu mới nhất trước. Kỹ thuật viên luôn bị lọc theo `assigned_to = mình`.
`200 { "items": [ Ticket… ], "page": 1, "pageSize": 20, "total": 17, "totalPages": 1 }`
Lỗi: `400 INVALID_STATUS`, `INVALID_PRIORITY`, `INVALID_DATE`, `INVALID_DATE_RANGE`, `INVALID_QUERY`, `INVALID_PAGE`, `INVALID_PAGE_SIZE`.

### T3 – `GET /api/tickets/{code}`
`200 Ticket` · `404 TICKET_NOT_FOUND` · `403 TICKET_NOT_ASSIGNED_TO_YOU` (kỹ thuật viên mở phiếu của người khác).

### T4 – `POST /api/tickets/{code}/classify`
Body `{ "issueCategoryId": 2, "priority": "HIGH" }` → `200 Ticket` với `status = "CLASSIFIED"`, `dueDate` = thời điểm phân loại + 24 giờ (HIGH) / 72 giờ (MEDIUM) / 120 giờ (LOW) – BR4.
Trạng thái và các cột `issue_category_id`, `priority`, `due_date` được ghi trong **một câu UPDATE** có điều kiện `status = 'NEW'` (TD-10).

| Lỗi | Khi nào |
|---|---|
| 400 `ISSUE_CATEGORY_REQUIRED` | không gửi `issueCategoryId` (TD-11) |
| 400 `ISSUE_CATEGORY_INVALID` | danh mục không phải số, không tồn tại hoặc đã ngừng dùng (TD-11) |
| 400 `INVALID_PRIORITY` | thiếu hoặc không thuộc `HIGH`, `MEDIUM`, `LOW` (TD-11) |
| 403 `ROLE_NOT_ALLOWED` | không phải Điều phối viên (BR5, NFR4) |
| 404 `TICKET_NOT_FOUND` | |
| 409 `INVALID_TRANSITION` | phiếu không ở trạng thái Mới (BR6) |
| 409 `DATA_CHANGED` | phiếu vừa bị người khác đổi trạng thái (UC03-4b) |

### T5 – `POST /api/tickets/{code}/reject`
Body `{ "reason": "Máy vào nước do sử dụng" }` → `200 Ticket` với `status = "REJECTED"`; lý do lưu ở `ticket_status_log.note`.
Lỗi: `400 REJECT_REASON_REQUIRED`, `400 REJECT_REASON_TOO_LONG` (> 500), `403 ROLE_NOT_ALLOWED`, `404 TICKET_NOT_FOUND`, `409 INVALID_TRANSITION` (phiếu không còn Mới – BR6), `409 DATA_CHANGED`.

### T6 – `POST /api/tickets/{code}/assign`
Body `{ "technicianId": 3 }` → `200 Ticket` với `status = "ASSIGNED"`, `assignee` là kỹ thuật viên được giao.

| Lỗi | Khi nào |
|---|---|
| 400 `TECHNICIAN_REQUIRED` | không gửi `technicianId` (TD-11) |
| 400 `TECHNICIAN_INVALID` | không phải số, không tồn tại, không phải kỹ thuật viên hoặc đã bị khoá (BR5) |
| 403 `ROLE_NOT_ALLOWED` | không phải Điều phối viên |
| 404 `TICKET_NOT_FOUND` | |
| 409 `INVALID_TRANSITION` | phiếu chưa ở trạng thái Đã phân loại |
| 409 `DATA_CHANGED` | phiếu vừa bị người khác cập nhật (UC03-4b) |

### T7 – `POST /api/tickets/{code}/acknowledge`
Không có body. Kỹ thuật viên được giao xác nhận nhận phiếu → `200 Ticket` với `status = "IN_PROGRESS"`.
Lỗi: `403 ROLE_NOT_ALLOWED` (không phải kỹ thuật viên), `403 TICKET_NOT_ASSIGNED_TO_YOU`, `404 TICKET_NOT_FOUND`, `409 INVALID_TRANSITION`, `409 DATA_CHANGED`.

### T8 – `GET /api/tickets/{code}/history`
`200 [ { "id", "ticketId", "fromStatus", "toStatus", "note", "changedAt", "changedBy": { "id", "fullName", "role" } } … ]` theo thứ tự thời gian. Mỗi lần đổi trạng thái có đúng một dòng (NFR5). Quyền như T3.

### L1 – `GET /api/issue-categories`
`200 [ { "id": 1, "code": "MAN_HINH", "name": "Màn hình", "isActive": true } … ]` (chỉ danh mục đang dùng).

### L2 – `GET /api/technicians`
`200 [ { "id": 3, "username": "kt1", "fullName": "Phạm Huy", "role": "TECHNICIAN", "isActive": true, "openTicketCount": 4 } … ]` – chỉ kỹ thuật viên đang hoạt động; `openTicketCount` (số phiếu Đã phân công + Đang xử lý) tính khi truy vấn.

### S1 – Khách hàng
| Endpoint | Ghi chú |
|---|---|
| `GET /api/customers?q=&page=&pageSize=` | `q` tìm theo họ tên hoặc SĐT; mỗi khách hàng có `deviceCount` |
| `GET /api/customers/{id}` | kèm `devices` · `404 CUSTOMER_NOT_FOUND` · `400 INVALID_ID` |
| `POST /api/customers` | = C2 |
| `PUT /api/customers/{id}` | body như C2 · `404`, `409 PHONE_EXISTS` |
| `DELETE /api/customers/{id}` | `204` · `409 CUSTOMER_HAS_DEVICES` khi khách còn thiết bị (TD-13) |

### S2 – Thiết bị
| Endpoint | Ghi chú |
|---|---|
| `GET /api/devices?customerId=` | thiết bị của một khách hàng, mỗi thiết bị có `ticketCount`, `warrantyExpired` |
| `GET /api/devices/{id}` | `404 DEVICE_NOT_FOUND` |
| `POST /api/devices` | body `{ "customerId", "imei", "model", "warrantyEndDate" }` → `201` · `400 CUSTOMER_REQUIRED`, `INVALID_IMEI`, `MODEL_REQUIRED`, `INVALID_WARRANTY_END_DATE` · `404 CUSTOMER_NOT_FOUND` · `409 IMEI_EXISTS` |
| `PUT /api/devices/{id}` | body `{ "imei", "model", "warrantyEndDate" }` · `409 DEVICE_HAS_TICKETS` khi đổi IMEI của thiết bị đã có phiếu · `409 IMEI_EXISTS` |
| `DELETE /api/devices/{id}` | `204` · `409 DEVICE_HAS_TICKETS` khi thiết bị đã có phiếu (BR6 – phiếu không bao giờ bị xoá) |

## 4. Đối tượng `Ticket` trả về

```json
{
  "id": 17, "ticketCode": "BH-2026-000017", "status": "CLASSIFIED",
  "issueDescription": "Máy tự tắt khi còn 30% pin",
  "issueCategoryId": 2, "priority": "HIGH", "dueDate": "2026-11-15T06:45:00.000Z",
  "assignedTo": null, "createdBy": 1, "deviceId": 1,
  "createdAt": "2026-11-14T06:44:00.000Z", "updatedAt": "2026-11-14T06:45:00.000Z",
  "warrantyExpired": false, "overdue": false,
  "customer": { "id": 1, "fullName": "Nguyễn Văn An", "phone": "0901234567" },
  "device": { "id": 1, "imei": "356789012345678", "model": "Samsung Galaxy A55", "warrantyEndDate": "2027-03-10" },
  "issueCategory": { "id": 2, "code": "PIN", "name": "Pin" },
  "assignee": null,
  "creator": { "id": 1, "fullName": "Lê Thu" }
}
```
`warrantyExpired` = ngày tiếp nhận (giờ Việt Nam) sau ngày hết hạn bảo hành (BR3). `overdue` = có hạn xử lý, hạn đã qua và phiếu đang Đã phân loại / Đã phân công / Đang xử lý. Cả hai là giá trị tính khi truy vấn, không lưu cột.

## 5. Gọi thử

`bash scripts/demo-api.sh` (khi `npm start` đang chạy) gọi lần lượt A1 → T1 → BR2 (409) → NFR4 (403) → T4 → L2 → T6 → T7 → T8 → T2 → S1 (409) → 401. Kết quả một lần chạy: `docs/ket-qua/04-demo-api.txt`.

# Đối chiếu wireframe M1–M3 với mô hình dữ liệu

**Sinh viên:** Giang Huy Khải – 2374802010205 · File gốc: `docs/wireframe.drawio` · Ảnh: `docs/wireframe.png` · Giao diện thật bản `v0.2`: `docs/wireframe-v0.2.png`

Mọi trường hiển thị trên M1–M3 đều lấy từ một cột trong ERD (`db/schema.sql`) hoặc là giá trị tính khi truy vấn (ghi *tính*). Mã bước trong ngoặc là luồng ngoại lệ của UC01 (`docs/srs.md` mục 2.2).

## M1 – Tạo phiếu bảo hành (UC01, UC07)

| Trường / vùng trên màn hình | Nguồn dữ liệu | Luồng ngoại lệ hiển thị tại đây |
|---|---|---|
| Số điện thoại khách hàng | `customer.phone` | (2a) Số điện thoại không hợp lệ |
| Họ tên khách hàng | `customer.full_name` | (3a) Chưa có khách hàng → nút *Tạo khách hàng mới* + ô Họ tên |
| IMEI | `device.imei` | (4a) IMEI phải gồm 15 chữ số |
| Model, Ngày hết hạn bảo hành | `device.model`, `device.warranty_end_date` | (5a) IMEI mới → nhập hai trường này · (5b) Đang có phiếu `ticket.ticket_code` chưa đóng → khoá *Lưu phiếu* |
| Nhãn *Hết hạn bảo hành* | *tính*: ngày tiếp nhận > `device.warranty_end_date` | (5c) |
| Mô tả lỗi | `ticket.issue_description` | (7a) Vui lòng nhập mô tả lỗi |
| Thông báo *Đã tạo phiếu BH-…* | `ticket.ticket_code` | — |

## M2 – Danh sách phiếu bảo hành (UC04)

| Cột / bộ lọc | Nguồn dữ liệu |
|---|---|
| Tìm mã phiếu / SĐT | `ticket.ticket_code`, `customer.phone` |
| Lọc trạng thái, mức ưu tiên | `ticket.status`, `ticket.priority` |
| Lọc hạn xử lý từ – đến | `ticket.due_date` (index `idx_ticket_status_due`) |
| Mã phiếu, thời điểm tiếp nhận | `ticket.ticket_code`, `ticket.created_at` |
| Khách hàng, SĐT | `customer.full_name`, `customer.phone` (qua `device.customer_id`) |
| Thiết bị, IMEI | `device.model`, `device.imei` |
| Danh mục lỗi | `issue_category.name` |
| Ưu tiên, Hạn xử lý | `ticket.priority`, `ticket.due_date` |
| Nhãn *Quá hạn* | *tính*: `due_date < now()` và phiếu chưa đóng |
| Trạng thái, Kỹ thuật viên | `ticket.status`, `staff.full_name` (qua `ticket.assigned_to`) |
| Phân trang ‹ Trang x / y › | `COUNT(*)` + `LIMIT 20 OFFSET …` (TD-09) |

## M3 – Chi tiết phiếu bảo hành (UC02, UC03, UC05, UC06)

| Vùng | Nguồn dữ liệu | Hiện khi |
|---|---|---|
| Thông tin phiếu | `ticket.*`, `device.*`, `customer.*`, `staff.full_name` (người tạo, kỹ thuật viên) | luôn |
| Phân loại: danh mục, mức ưu tiên | `issue_category` (L1), `ticket.priority`; hạn xử lý tính theo BR4 | Điều phối viên, phiếu *Mới* |
| Từ chối: lý do | `ticket_status_log.note` (bắt buộc – `chk_log_reject_reason`) | Điều phối viên, phiếu *Mới* |
| Phân công: kỹ thuật viên | `staff` có `role = TECHNICIAN` và `is_active` (L2); số phiếu đang giữ *tính* | Điều phối viên, phiếu *Đã phân loại* (khoá khi chưa phân loại) |
| Xác nhận nhận phiếu | `ticket.status` → `IN_PROGRESS` | Kỹ thuật viên được giao, phiếu *Đã phân công* |
| Lịch sử trạng thái | `ticket_status_log` (`from_status`, `to_status`, `note`, `changed_by`, `changed_at`) | luôn |
| Lỗi 409 *Phiếu vừa được người khác cập nhật* | điều kiện `status = fromStatus` của câu UPDATE (TD-10) | khi xung đột (UC03-4b) |

## M4 – Khách hàng & thiết bị (bổ sung BT2 – TD-13)

| Vùng | Nguồn dữ liệu |
|---|---|
| Danh sách khách hàng, số thiết bị | `customer.*`, *tính*: `COUNT(device)` |
| Thiết bị của khách: IMEI, model, hết hạn bảo hành, số phiếu | `device.*`, *tính*: `COUNT(ticket)`, nhãn *Hết hạn* |

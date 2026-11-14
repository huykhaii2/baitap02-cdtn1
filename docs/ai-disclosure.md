# PHỤ LỤC – BẢNG KHAI BÁO SỬ DỤNG CÔNG CỤ AI

**Sinh viên:** Giang Huy Khải – MSSV 2374802010205 – Lớp 71k29cntt03
**Repo:** https://github.com/huykhaii2/baitap02-cdtn1

**Cách em làm việc với AI.** Em cung cấp đề bài, slide và luồng đã được duyệt (L2, track SE), yêu cầu Claude soạn bản nháp **từng phần một**, đọc lại từng phần trước khi làm phần tiếp theo, rồi tự chạy lại và kiểm chứng. Phần em tự làm ghi ở dòng cuối bảng.

## Bài tập 1 – Phân tích và thiết kế

| Công cụ | Phần áp dụng | Cách dùng (tóm tắt yêu cầu đã gửi) | Em đã chỉnh sửa / kiểm chứng gì |
|---|---|---|---|
| Claude (Anthropic) – trợ lý AI dạng chat | Mục 1 – SRS: thuật ngữ, vai trò, FR1–FR6, US1–US7, NFR1–NFR5, BR1–BR6, bảng truy vết | Gửi đề bài và slide buổi 6, nêu luồng L2 – track SE; yêu cầu soạn bản nháp SRS đủ 6 mục theo mẫu của đề | Đếm lại theo yêu cầu tối thiểu của đề: 6 FR (≥ 4), 7 US (5–7), 5 NFR đều có ngưỡng số (≥ 3), 6 quy tắc (≥ 3). Kiểm bảng truy vết FR → US → UC → bảng dữ liệu → màn hình không còn ô trống. Đối chiếu BR1, BR3, BR4 với Bảng 9.1 của case study và ghi nguồn ở cột Nguồn (mục 1.5); BR2, BR5, BR6 là phân tích của em |
| Claude (Anthropic) – trợ lý AI dạng chat | Mục 2 – Use Case Diagram (`usecase.drawio`) và đặc tả chi tiết **UC01 – Tạo phiếu bảo hành** | Yêu cầu vẽ sơ đồ use case dạng file draw.io gốc và đặc tả use case chính có luồng ngoại lệ | Em chọn đưa thao tác *Từ chối* vào UC02 (chỉ từ trạng thái *Mới*) và sửa BR6, FR2, US2 cho khớp. Kiểm 3 actor nằm ngoài ranh giới hệ thống, 7 use case đặt tên bằng động từ, có «include» UC01 → UC07, có chú thích ký hiệu. Kiểm 7 luồng ngoại lệ của UC01 (2a, 3a, 4a, 5a, 5b, 5c, 7a) đều có chỗ hiển thị trên wireframe M1 |
| Claude (Anthropic) – trợ lý AI dạng chat | Mục 3 – sơ đồ kiến trúc (`architecture.drawio`) và 4 câu lập luận | Yêu cầu thiết kế kiến trúc phân lớp cho luồng L2 và viết câu lập luận theo khuôn "Vì NFR… yêu cầu…, tôi chọn…, đánh đổi là…" | Kiểm từng câu lập luận có đủ mã NFR, ngưỡng số, quyết định và đánh đổi; mũi tên giữa các lớp chỉ đi xuống; tên 6 bảng ở lớp lưu trữ khớp ERD |
| Claude (Anthropic) – trợ lý AI dạng chat | Mục 4 – ERD (`erd.drawio`) và `db/schema.sql` | Yêu cầu thiết kế ERD 4–6 bảng và SQL DDL skeleton cho PostgreSQL 16 | Chạy `schema.sql` trên PostgreSQL 16: tạo đủ 6 bảng, 7 khoá ngoại, không lỗi. Thử chèn dữ liệu sai – phiếu thứ hai cho cùng IMEI (BR2), *Từ chối* không có lý do, phiếu *Đã phân công* không có kỹ thuật viên – đều bị CSDL chặn |
| Claude (Anthropic) – trợ lý AI dạng chat | Mục 5 – Wireframe 3 màn hình (`wireframe.drawio`) | Yêu cầu vẽ M1, M2, M3 khớp thuật ngữ, khớp mô hình dữ liệu và có chỗ hiển thị cho mọi luồng ngoại lệ | Đối chiếu từng trường trên M1–M3 với cột trong ERD (`docs/wireframe.md`); nhãn *Hết hạn bảo hành* và *Quá hạn* là giá trị tính toán, không lưu |

## Bài tập 2 – Hiện thực (Sprint 1, Sprint 2, khắc phục sau phản hồi BT2)

| Công cụ | Phần áp dụng | Cách dùng (tóm tắt yêu cầu đã gửi) | Em đã chỉnh sửa / kiểm chứng gì |
|---|---|---|---|
| Claude (Anthropic) – trợ lý AI dạng chat | **Sprint 1 (buổi 8)** – chọn công nghệ (TD-05), migration (TD-06), sinh mã phiếu (TD-07) | Gửi slide buổi 8 và repo BT1; hỏi cách dựng khung 4 lớp theo đúng sơ đồ kiến trúc và migration chạy lại được | Đối chiếu tên bảng, cột, mã lỗi với ERD và `api-contract.md`; ghi lý do từng quyết định vào `docs/thay-doi-thiet-ke.md` |
| Claude (Anthropic) – trợ lý AI dạng chat | **Sprint 2 (buổi 10)** – thiết kế giao diện M1–M3, phạm vi Sprint 2, tách lớp nghiệp vụ khỏi HTTP, CRUD S1/S2 (TD-08 → TD-15) | Gửi slide buổi 10 và nhật ký buổi 8; hỏi cách tổ chức `src/frontend`, mã lỗi, xử lý 503 | Ghi các quyết định TD-08 → TD-15 vào nhật ký thay đổi thiết kế |
| Claude (Anthropic) – trợ lý AI có công cụ chạy lệnh | **Khắc phục sau phản hồi BT2 (14/11/2026)** – dựng lại toàn bộ mã nguồn `src/backend` (4 lớp), `src/frontend` (đăng nhập, M1–M4), `db/migrations/001_init_schema.sql`, `scripts/migrate.js`, `scripts/seed.js`, `scripts/demo-api.sh`, `tests/` (unit + CSDL thật), sơ đồ `.drawio` và ảnh xuất, `README.md`, `docs/api-contract.md`, `docs/bug-log.md`, TD-16 → TD-26 | Gửi hai nhận xét BT2 của thầy, nhật ký thay đổi thiết kế TD-01 → TD-15 và repo hiện tại; yêu cầu hiện thực đúng các TD đã ghi, sửa các mục chưa đạt C1, C2, C4, C5, S1, S2, S4 và gỡ tệp `.env` | Trong phiên làm việc, mã được chạy với PostgreSQL 16 thật: `npm run migrate` và `npm run seed` hai lần không trùng; `npm test` và `npm run test:db` đều đạt (số liệu ở `docs/ket-qua/02-npm-test.txt`, `03-test-db.txt`); chạy luồng chính trên giao diện bằng trình duyệt tự động và lưu ảnh ở `docs/ket-qua/anh/`; tắt PostgreSQL để kiểm `503 DB_UNAVAILABLE`. Em tự làm lại trên máy mình: clone tag `v0.2` vào thư mục trống, làm đúng README mục 3, chạy lại hai lệnh test, thao tác luồng tn1 → dp1 → kt1; đọc lại từng file trong `src/` trước khi commit |
| — không dùng — | Chọn luồng nghiệp vụ L2 và track SE (giảng viên duyệt ở buổi 2); đối chiếu quy tắc với Bảng 9.1 của case study; điền thông tin cá nhân; đổi khoá Supabase; tạo repo GitHub, commit, tạo tag; xuất báo cáo PDF | Không áp dụng | Không áp dụng |

**Cam kết.** Tôi xác nhận đã đọc, hiểu và chịu trách nhiệm về toàn bộ nội dung nộp. Các phần có sử dụng AI đã được khai báo đầy đủ ở bảng trên và đã được tôi kiểm chứng lại.

**Họ tên:** Giang Huy Khải · **MSSV:** 2374802010205 · **Lớp:** 71k29cntt03 · **Ngày:** 14/11/2026

**Link GitHub repo (file `.drawio` gốc, `schema.sql`, `srs.md`):** https://github.com/huykhaii2/baitap02-cdtn1

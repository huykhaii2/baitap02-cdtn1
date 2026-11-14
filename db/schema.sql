-- =====================================================================
-- db/schema.sql – SQL DDL skeleton nộp ở Bài tập 1 (PostgreSQL 16)
-- Luồng L2 – Tiếp nhận và phân loại yêu cầu bảo hành · Track SE
-- Sinh viên: Giang Huy Khải – 2374802010205 – Lớp 71k29cntt03
--
-- File này là TÀI LIỆU THIẾT KẾ, giữ nguyên như bản nộp BT1 (TD-06).
-- Lược đồ chạy thật: db/migrations/001_init_schema.sql (cùng nội dung, có IF NOT EXISTS).
-- 6 bảng · 7 khoá ngoại · khoá chính thay thế id ở mọi bảng.
-- =====================================================================

CREATE TABLE customer (
    id          BIGSERIAL     PRIMARY KEY,
    full_name   VARCHAR(100)  NOT NULL,
    phone       VARCHAR(10)   NOT NULL UNIQUE
                CHECK (phone ~ '^[0-9]{10}$'),
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE device (
    id                 BIGSERIAL     PRIMARY KEY,
    customer_id        BIGINT        NOT NULL REFERENCES customer (id),          -- FK 1
    imei               CHAR(15)      NOT NULL UNIQUE
                       CHECK (imei ~ '^[0-9]{15}$'),
    model              VARCHAR(100)  NOT NULL,
    warranty_end_date  DATE          NOT NULL,
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_device_customer ON device (customer_id);

CREATE TABLE issue_category (
    id         BIGSERIAL     PRIMARY KEY,
    code       VARCHAR(20)   NOT NULL UNIQUE,
    name       VARCHAR(100)  NOT NULL UNIQUE,
    is_active  BOOLEAN       NOT NULL DEFAULT TRUE
);

CREATE TABLE staff (
    id             BIGSERIAL     PRIMARY KEY,
    username       VARCHAR(50)   NOT NULL UNIQUE,
    password_hash  VARCHAR(255)  NOT NULL,
    full_name      VARCHAR(100)  NOT NULL,
    role           VARCHAR(20)   NOT NULL
                   CHECK (role IN ('RECEPTIONIST', 'COORDINATOR', 'TECHNICIAN')),
    is_active      BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE ticket (
    id                 BIGSERIAL     PRIMARY KEY,
    ticket_code        VARCHAR(14)   NOT NULL UNIQUE
                       CHECK (ticket_code ~ '^BH-[0-9]{4}-[0-9]{6}$'),
    device_id          BIGINT        NOT NULL REFERENCES device (id),            -- FK 2
    issue_description  TEXT          NOT NULL CHECK (length(trim(issue_description)) > 0),
    issue_category_id  BIGINT        REFERENCES issue_category (id),             -- FK 3
    priority           VARCHAR(10)
                       CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW')),
    due_date           TIMESTAMPTZ,
    status             VARCHAR(20)   NOT NULL DEFAULT 'NEW'
                       CHECK (status IN ('NEW', 'CLASSIFIED', 'ASSIGNED', 'IN_PROGRESS', 'REJECTED')),
    assigned_to        BIGINT        REFERENCES staff (id),                      -- FK 4
    created_by         BIGINT        NOT NULL REFERENCES staff (id),             -- FK 5
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT chk_ticket_classified CHECK (
        status IN ('NEW', 'REJECTED')
        OR (issue_category_id IS NOT NULL AND priority IS NOT NULL AND due_date IS NOT NULL)
    ),
    CONSTRAINT chk_ticket_assigned CHECK (
        status NOT IN ('ASSIGNED', 'IN_PROGRESS') OR assigned_to IS NOT NULL
    )
);
CREATE INDEX idx_ticket_status_due   ON ticket (status, due_date);       -- NFR1
CREATE INDEX idx_ticket_assigned     ON ticket (assigned_to, status);
CREATE INDEX idx_ticket_device       ON ticket (device_id);
-- BR2: một IMEI (thiết bị) chỉ có tối đa một phiếu chưa đóng.
CREATE UNIQUE INDEX ux_ticket_open_device ON ticket (device_id)
    WHERE status IN ('NEW', 'CLASSIFIED', 'ASSIGNED', 'IN_PROGRESS');

CREATE TABLE ticket_status_log (
    id           BIGSERIAL    PRIMARY KEY,
    ticket_id    BIGINT       NOT NULL REFERENCES ticket (id),               -- FK 6
    from_status  VARCHAR(20)
                 CHECK (from_status IN ('NEW', 'CLASSIFIED', 'ASSIGNED', 'IN_PROGRESS', 'REJECTED')),
    to_status    VARCHAR(20)  NOT NULL
                 CHECK (to_status IN ('NEW', 'CLASSIFIED', 'ASSIGNED', 'IN_PROGRESS', 'REJECTED')),
    note         TEXT,
    changed_by   BIGINT       NOT NULL REFERENCES staff (id),                -- FK 7
    changed_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_log_reject_reason CHECK (
        to_status <> 'REJECTED' OR length(trim(coalesce(note, ''))) > 0
    )
);
CREATE INDEX idx_log_ticket_time ON ticket_status_log (ticket_id, changed_at);

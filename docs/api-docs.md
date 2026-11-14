# API documentation — Smart CRM (Mekong Mobile), flow L2

Author: Giang Huy Khải (2374802010205) · Repo: https://github.com/huykhaii2/baitap02-cdtn1 · Version `v1.0`
Base URL: `http://localhost:3000` (Docker or `npm start`). All examples below were **captured from a real run** on a freshly seeded database (14/11/2026); long values are shortened with `…`.

## Conventions

| Topic | Rule |
|---|---|
| Format | JSON, UTF-8. Timestamps ISO 8601 (UTC); dates `YYYY-MM-DD` |
| Authentication | `Authorization: Bearer <JWT>` from A1, on every endpoint except `GET /api/health` and A1 |
| Authorisation | Checked in the business layer on the server (NFR4), not by hiding buttons |
| Errors | Always `{"error": {"code": "...", "message": "...", "details": {...}}}`; `details.field` names the invalid input field. Messages are in Vietnamese for the UI |
| Status codes | Business errors carry a *kind*, mapped in one place (`src/backend/middlewares/errorHandler.js`): INVALID_INPUT → 400 · NOT_AUTHENTICATED → 401 · NOT_ALLOWED → 403 · NOT_FOUND → 404 · CONFLICT → 409. Database down → 503 `DB_UNAVAILABLE`; unexpected → 500 `INTERNAL_ERROR` (no stack trace) |
| Limits | Request body ≤ 100 KB (`413 PAYLOAD_TOO_LARGE`), invalid JSON → `400 INVALID_JSON`, page size ≤ 100. Unknown route → `404 ROUTE_NOT_FOUND` |
| Roles | `RECEPTIONIST`, `COORDINATOR`, `TECHNICIAN` |

Errors that apply to **every** protected endpoint and are not repeated below: `401 TOKEN_REQUIRED` / `TOKEN_INVALID` (no or bad token) · `503 DB_UNAVAILABLE` (database down) · `500 INTERNAL_ERROR`.

## Endpoint index

| Code | Method | Path | Roles |
|---|---|---|---|
| — | GET | `/api/health` | None (public). |
| A1 | POST | `/api/auth/login` | None (public). |
| C1 | GET | `/api/customers/by-phone/{phone}` | roles RECEPTIONIST, COORDINATOR. |
| C2 | POST | `/api/customers` | role RECEPTIONIST. |
| D1 | GET | `/api/devices/by-imei/{imei}` | roles RECEPTIONIST, COORDINATOR. |
| T1 | POST | `/api/tickets` | role RECEPTIONIST. |
| T2 | GET | `/api/tickets` | all roles. |
| T3 | GET | `/api/tickets/{code}` | all roles (technician: only own tickets). |
| T4 | POST | `/api/tickets/{code}/classify` | role COORDINATOR (BR5). |
| T5 | POST | `/api/tickets/{code}/reject` | role COORDINATOR. |
| T6 | POST | `/api/tickets/{code}/assign` | role COORDINATOR. |
| T7 | POST | `/api/tickets/{code}/acknowledge` | role TECHNICIAN (only the assignee). |
| T8 | GET | `/api/tickets/{code}/history` | same visibility as T3. |
| L1 | GET | `/api/issue-categories` | all roles. |
| L2 | GET | `/api/technicians` | role COORDINATOR. |
| S1 | GET · PUT · DELETE | `/api/customers · /api/customers/{id}` | read: RECEPTIONIST, COORDINATOR · write: RECEPTIONIST. |
| S2 | GET · POST · PUT · DELETE | `/api/devices · /api/devices/{id}` | read: RECEPTIONIST, COORDINATOR · write: RECEPTIONIST. |

There is intentionally **no PUT / DELETE for tickets** (BR6 – tickets are never edited or deleted); such calls return `404 ROUTE_NOT_FOUND`.

---

## — · Health check

1. **Method + path:** `GET /api/health`
2. **Description:** Checks that the app is running and the database answers `SELECT 1`. Used by the Docker health check.
3. **Authentication:** None (public).
4. **Parameters:** None.
5. **Success response:** `200` `{status, db, service}`
6. **Error codes:**

   | HTTP | code | When |
   |---|---|---|
   | 503 | `DB_UNAVAILABLE` | Database cannot be reached |

7. **Limits / notes:** No rate limit. Response contains no internal details.

**Example (real run):**

```http
GET /api/health
```

```json
// HTTP 200
{
  "status": "ok",
  "db": "ok",
  "service": "Smart CRM – Mekong Mobile · L2"
}
```

---

## A1 · Log in

1. **Method + path:** `POST /api/auth/login`
2. **Description:** Checks username + password (bcrypt) and returns a signed JWT plus the staff profile.
3. **Authentication:** None (public).
4. **Parameters:** Body: `username` (string, case-insensitive, required), `password` (string, required).
5. **Success response:** `200` `{token, staff: {id, username, fullName, role}}`. The password hash is never returned.
6. **Error codes:**

   | HTTP | code | When |
   |---|---|---|
   | 400 | `CREDENTIALS_REQUIRED` | Username or password missing |
   | 401 | `INVALID_CREDENTIALS` | Wrong username **or** wrong password (same message, does not reveal which) |
   | 403 | `ACCOUNT_LOCKED` | Account `is_active = false` |

7. **Limits / notes:** Token lifetime = `TOKEN_EXPIRES_IN` (default 8 h). Body ≤ 100 KB.

**Example (real run):**

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "tn1",
  "password": "Matkhau@123"
}
```

```json
// HTTP 200
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5…",
  "staff": {
    "id": 1,
    "username": "tn1",
    "fullName": "Lê Thu",
    "role": "RECEPTIONIST"
  }
}
```

**Error example (real run):**

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "tn1",
  "password": "sai"
}
```

```json
// HTTP 401
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Tên đăng nhập hoặc mật khẩu không đúng."
  }
}
```

---

## C1 · Find customer by phone (UC07)

1. **Method + path:** `GET /api/customers/by-phone/{phone}`
2. **Description:** Looks up one customer by phone number and returns the customer with all registered devices.
3. **Authentication:** Bearer token · roles RECEPTIONIST, COORDINATOR.
4. **Parameters:** Path `phone`: 10 digits starting with 0; spaces, dots and the `+84` prefix are accepted and normalised.
5. **Success response:** `200` customer `{id, fullName, phone, createdAt, devices[]}`
6. **Error codes:**

   | HTTP | code | When |
   |---|---|---|
   | 400 | `INVALID_PHONE` | Not a valid Vietnamese mobile number (UC01-2a) |
   | 403 | `ROLE_NOT_ALLOWED` | Technician |
   | 404 | `CUSTOMER_NOT_FOUND` | No customer with this phone (UC01-3a) |

7. **Limits / notes:** Exact match only.

**Example (real run):**

```http
GET /api/customers/by-phone/0901234567
Authorization: Bearer <token>
```

```json
// HTTP 200
{
  "id": 1,
  "fullName": "Nguyễn Văn An",
  "phone": "0901234567",
  "createdAt": "2026-11-14T08:15:37.996Z",
  "devices": [
    {
      "id": 2,
      "customerId": 1,
      "imei": "356789012345679",
      "model": "Samsung Galaxy A12",
      "warrantyEndDate": "2025-12-31",
      "warrantyExpired": true,
      "createdAt": "2026-11-14T08:15:37.996Z",
      "ticketCount": 0
    },
    {
      "id": 1,
      "customerId": 1,
      "imei": "356789012345678",
      "model": "Samsung Galaxy A55",
      "warrantyEndDate": "2027-03-10",
      "warrantyExpired": false,
      "createdAt": "2026-11-14T08:15:37.996Z",
      "ticketCount": 0
    }
  ]
}
```

**Error example (real run):**

```http
GET /api/customers/by-phone/0999000999
Authorization: Bearer <token>
```

```json
// HTTP 404
{
  "error": {
    "code": "CUSTOMER_NOT_FOUND",
    "message": "Chưa có khách hàng với số điện thoại này.",
    "details": {
      "phone": "0999000999"
    }
  }
}
```

---

## C2 · Create customer

1. **Method + path:** `POST /api/customers`
2. **Description:** Creates a customer (also the *create* operation of S1). Phone is normalised before saving.
3. **Authentication:** Bearer token · role RECEPTIONIST.
4. **Parameters:** Body: `fullName` (1–100 chars, required), `phone` (required).
5. **Success response:** `201` customer
6. **Error codes:**

   | HTTP | code | When |
   |---|---|---|
   | 400 | `FULL_NAME_REQUIRED / FULL_NAME_TOO_LONG / INVALID_PHONE` | Invalid input; `details.field` names the field |
   | 403 | `ROLE_NOT_ALLOWED` | Coordinator or technician |
   | 409 | `PHONE_EXISTS` | Phone already belongs to another customer |

7. **Limits / notes:** —

**Example (real run):**

```http
POST /api/customers
Authorization: Bearer <token>
Content-Type: application/json

{
  "fullName": "Trần Thị Mai",
  "phone": "0912345678"
}
```

```json
// HTTP 201
{
  "id": 26,
  "fullName": "Trần Thị Mai",
  "phone": "0912345678",
  "createdAt": "2026-11-14T08:15:39.926Z"
}
```

---

## D1 · Find device by IMEI

1. **Method + path:** `GET /api/devices/by-imei/{imei}`
2. **Description:** Returns the device, its owner, whether the warranty has expired (BR3, computed at query time) and the open ticket if any (BR2).
3. **Authentication:** Bearer token · roles RECEPTIONIST, COORDINATOR.
4. **Parameters:** Path `imei`: exactly 15 digits.
5. **Success response:** `200` `{id, customerId, imei, model, warrantyEndDate, warrantyExpired, ticketCount, customer, openTicket}`; `openTicket` is `null` when the device has no open ticket.
6. **Error codes:**

   | HTTP | code | When |
   |---|---|---|
   | 400 | `INVALID_IMEI` | Not 15 digits (UC01-4a) |
   | 403 | `ROLE_NOT_ALLOWED` | Technician |
   | 404 | `DEVICE_NOT_FOUND` | Unknown IMEI (UC01-5a) |

7. **Limits / notes:** —

**Example (real run):**

```http
GET /api/devices/by-imei/356789012345678
Authorization: Bearer <token>
```

```json
// HTTP 200
{
  "id": 1,
  "customerId": 1,
  "imei": "356789012345678",
  "model": "Samsung Galaxy A55",
  "warrantyEndDate": "2027-03-10",
  "warrantyExpired": false,
  "createdAt": "2026-11-14T08:15:37.996Z",
  "ticketCount": 0,
  "customer": {
    "id": 1,
    "fullName": "Nguyễn Văn An",
    "phone": "0901234567",
    "createdAt": "2026-11-14T08:15:37.996Z"
  },
  "openTicket": null
}
```

---

## T1 · Create warranty ticket (UC01, FR1)

1. **Method + path:** `POST /api/tickets`
2. **Description:** Creates a ticket in status `NEW` with code `BH-YYYY-NNNNNN` (year in Vietnam time, sequential, generated under an advisory lock). Customer, device, ticket and the first history row are written in **one transaction**.
3. **Authentication:** Bearer token · role RECEPTIONIST.
4. **Parameters:** Body: `phone` (required), `imei` (required), `issueDescription` (1–2000 chars, required); optional `customer: {fullName}` when the phone is new (UC01-3a); optional `device: {model, warrantyEndDate}` when the IMEI is new (UC01-5a).
5. **Success response:** `201` Ticket (see *Ticket object*)
6. **Error codes:**

   | HTTP | code | When |
   |---|---|---|
   | 400 | `INVALID_PHONE / INVALID_IMEI / DESCRIPTION_REQUIRED / DESCRIPTION_TOO_LONG / MODEL_REQUIRED / INVALID_WARRANTY_END_DATE` | Invalid input |
   | 403 | `ROLE_NOT_ALLOWED` | Not a receptionist |
   | 404 | `CUSTOMER_NOT_FOUND / DEVICE_NOT_FOUND` | Unknown phone / IMEI and no `customer` / `device` data sent |
   | 409 | `DEVICE_OWNED_BY_OTHER` | IMEI registered to another customer (BR1) |
   | 409 | `OPEN_TICKET_EXISTS` | Device already has an open ticket; `details.ticketCode` (BR2, UC01-5b) |

7. **Limits / notes:** No PUT / DELETE for tickets (BR6).

**Example (real run):**

```http
POST /api/tickets
Authorization: Bearer <token>
Content-Type: application/json

{
  "phone": "0912345678",
  "imei": "352222333344445",
  "issueDescription": "Máy tự tắt khi còn 30% pin"
}
```

```json
// HTTP 201
{
  "id": 17,
  "ticketCode": "BH-2026-000017",
  "deviceId": 27,
  "issueDescription": "Máy tự tắt khi còn 30% pin",
  "issueCategoryId": null,
  "priority": null,
  "dueDate": null,
  "status": "NEW",
  "assignedTo": null,
  "createdBy": 1,
  "createdAt": "2026-11-14T08:15:39.938Z",
  "updatedAt": "2026-11-14T08:15:39.938Z",
  "warrantyExpired": false,
  "overdue": false,
  "customer": {
    "id": 26,
    "fullName": "Trần Thị Mai",
    "phone": "0912345678"
  },
  "device": {
    "id": 27,
    "imei": "352222333344445",
    "model": "Xiaomi Redmi Note 13",
    "warrantyEndDate": "2027-06-30"
  },
  "issueCategory": null,
  "assignee": null,
  "creator": {
    "id": 1,
    "fullName": "Lê Thu"
  }
}
```

**Error example (real run):**

```http
POST /api/tickets
Authorization: Bearer <token>
Content-Type: application/json

{
  "phone": "0912345678",
  "imei": "352222333344445",
  "issueDescription": "Lần 2"
}
```

```json
// HTTP 409
{
  "error": {
    "code": "OPEN_TICKET_EXISTS",
    "message": "Thiết bị đang có phiếu BH-2026-000017 chưa đóng.",
    "details": {
      "ticketCode": "BH-2026-000017"
    }
  }
}
```

---

## T2 · List tickets (UC04, FR4)

1. **Method + path:** `GET /api/tickets`
2. **Description:** Filtered, searched and paginated list, newest first. Filtering and paging run in the database (index `(status, due_date)`). Technicians always see only tickets assigned to them.
3. **Authentication:** Bearer token · all roles.
4. **Parameters:** Query (all optional): `q` (ticket code or phone, ≤ 50 chars) · `status` (`NEW|CLASSIFIED|ASSIGNED|IN_PROGRESS|REJECTED`) · `priority` (`HIGH|MEDIUM|LOW`) · `dueFrom`, `dueTo` (`YYYY-MM-DD`, whole days in Vietnam time) · `page` (≥ 1, default 1) · `pageSize` (1–100, default 20).
5. **Success response:** `200` `{items: Ticket[], page, pageSize, total, totalPages}`
6. **Error codes:**

   | HTTP | code | When |
   |---|---|---|
   | 400 | `INVALID_STATUS / INVALID_PRIORITY / INVALID_DATE / INVALID_DATE_RANGE / INVALID_QUERY / INVALID_PAGE / INVALID_PAGE_SIZE` | Invalid filter |

7. **Limits / notes:** Max 100 items per page. Search is parameterised (`q=' OR '1'='1` returns 0 items).

**Example (real run):**

```http
GET /api/tickets?status=NEW&pageSize=2
Authorization: Bearer <token>
```

```json
// HTTP 200
{
  "items": [
    {
      "id": 17,
      "ticketCode": "BH-2026-000017",
      "deviceId": 27,
      "issueDescription": "Máy tự tắt khi còn 30% pin",
      "issueCategoryId": null,
      "priority": null,
      "dueDate": null,
      "status": "NEW",
      "assignedTo": null,
      "createdBy": 1,
      "createdAt": "2026-11-14T08:15:39.938Z",
      "updatedAt": "2026-11-14T08:15:39.938Z",
      "warrantyExpired": false,
      "overdue": false,
      "customer": {
        "id": 26,
        "fullName": "Trần Thị Mai",
        "phone": "0912345678"
      },
      "device": {
        "id": 27,
        "imei": "352222333344445",
        "model": "Xiaomi Redmi Note 13",
        "warrantyEndDate": "2027-06-30"
      },
      "issueCategory": null,
      "assignee": null,
      "creator": {
        "id": 1,
        "fullName": "Lê Thu"
      }
    },
    {
      "id": 1,
      "ticketCode": "BH-2026-000001",
      "deviceId": 3,
      "issueDescription": "Cảm ứng chỗ được chỗ không đã thử khởi động lại không được",
      "issueCategoryId": null,
      "priority": null,
      "dueDate": null,
      "status": "NEW",
      "assignedTo": null,
      "createdBy": 1,
      "createdAt": "2026-11-14T06:15:37.602Z",
      "updatedAt": "2026-11-14T06:15:37.602Z",
      "warrantyExpired": false,
      "overdue": false,
      "customer": {
        "id": 2,
        "fullName": "Phan Hữu Bình",
        "phone": "0763247885"
      },
      "device": {
        "id": 3,
        "imei": "354100000007919",
        "model": "Samsung Y2",
        "warrantyEndDate": "2027-01-28"
      },
      "issueCategory": null,
      "assignee": null,
      "creator": {
        "id": 1,
        "fullName": "Lê Thu"
      }
    }
  ],
  "page": 1,
  "pageSize": 2,
  "total": 5,
  "totalPages": 3
}
```

---

## T3 · Get ticket

1. **Method + path:** `GET /api/tickets/{code}`
2. **Description:** Full ticket with customer, device, category, assignee, creator, `warrantyExpired` and `overdue` (both computed).
3. **Authentication:** Bearer token · all roles (technician: only own tickets).
4. **Parameters:** Path `code`: `BH-YYYY-NNNNNN` (case-insensitive).
5. **Success response:** `200` Ticket
6. **Error codes:**

   | HTTP | code | When |
   |---|---|---|
   | 403 | `TICKET_NOT_ASSIGNED_TO_YOU` | Technician opens a ticket assigned to someone else |
   | 404 | `TICKET_NOT_FOUND` | Unknown code |

7. **Limits / notes:** —

**Example (real run):**

```http
GET /api/tickets/BH-2026-000017
Authorization: Bearer <token>
```

```json
// HTTP 200
{
  "id": 17,
  "ticketCode": "BH-2026-000017",
  "deviceId": 27,
  "issueDescription": "Máy tự tắt khi còn 30% pin",
  "issueCategoryId": null,
  "priority": null,
  "dueDate": null,
  "status": "NEW",
  "assignedTo": null,
  "createdBy": 1,
  "createdAt": "2026-11-14T08:15:39.938Z",
  "updatedAt": "2026-11-14T08:15:39.938Z",
  "warrantyExpired": false,
  "overdue": false,
  "customer": {
    "id": 26,
    "fullName": "Trần Thị Mai",
    "phone": "0912345678"
  },
  "device": {
    "id": 27,
    "imei": "352222333344445",
    "model": "Xiaomi Redmi Note 13",
    "warrantyEndDate": "2027-06-30"
  },
  "issueCategory": null,
  "assignee": null,
  "creator": {
    "id": 1,
    "fullName": "Lê Thu"
  }
}
```

---

## T4 · Classify ticket (UC02, FR2, BR4)

1. **Method + path:** `POST /api/tickets/{code}/classify`
2. **Description:** Sets issue category and priority; status `NEW → CLASSIFIED`; due date = now + 24 h (HIGH) / 72 h (MEDIUM) / 120 h (LOW). Status and columns are written in one conditional UPDATE (`status = 'NEW'`), plus one history row, in one transaction.
3. **Authentication:** Bearer token · role COORDINATOR (BR5).
4. **Parameters:** Body: `issueCategoryId` (integer, active category, required), `priority` (`HIGH|MEDIUM|LOW`, required).
5. **Success response:** `200` Ticket
6. **Error codes:**

   | HTTP | code | When |
   |---|---|---|
   | 400 | `ISSUE_CATEGORY_REQUIRED` | `issueCategoryId` missing |
   | 400 | `ISSUE_CATEGORY_INVALID` | Not a number, unknown or inactive |
   | 400 | `INVALID_PRIORITY` | Missing or not HIGH/MEDIUM/LOW |
   | 403 | `ROLE_NOT_ALLOWED` | Not a coordinator |
   | 404 | `TICKET_NOT_FOUND` |  |
   | 409 | `INVALID_TRANSITION` | Ticket is not `NEW` (BR6) |
   | 409 | `DATA_CHANGED` | Ticket was changed by someone else meanwhile (UC03-4b) |

7. **Limits / notes:** —

**Example (real run):**

```http
POST /api/tickets/BH-2026-000017/classify
Authorization: Bearer <token>
Content-Type: application/json

{
  "issueCategoryId": 2,
  "priority": "HIGH"
}
```

```json
// HTTP 200
{
  "id": 17,
  "ticketCode": "BH-2026-000017",
  "deviceId": 27,
  "issueDescription": "Máy tự tắt khi còn 30% pin",
  "issueCategoryId": 2,
  "priority": "HIGH",
  "dueDate": "2026-11-15T08:15:39.956Z",
  "status": "CLASSIFIED",
  "assignedTo": null,
  "createdBy": 1,
  "createdAt": "2026-11-14T08:15:39.938Z",
  "updatedAt": "2026-11-14T08:15:39.955Z",
  "warrantyExpired": false,
  "overdue": false,
  "customer": {
    "id": 26,
    "fullName": "Trần Thị Mai",
    "phone": "0912345678"
  },
  "device": {
    "id": 27,
    "imei": "352222333344445",
    "model": "Xiaomi Redmi Note 13",
    "warrantyEndDate": "2027-06-30"
  },
  "issueCategory": {
    "id": 2,
    "code": "PIN",
    "name": "Pin"
  },
  "assignee": null,
  "creator": {
    "id": 1,
    "fullName": "Lê Thu"
  }
}
```

**Error example (real run):**

```http
POST /api/tickets/BH-2026-000017/classify
Authorization: Bearer <token>
Content-Type: application/json

{
  "priority": "HIGH"
}
```

```json
// HTTP 400
{
  "error": {
    "code": "ISSUE_CATEGORY_REQUIRED",
    "message": "Vui lòng chọn danh mục lỗi.",
    "details": {
      "field": "issueCategoryId"
    }
  }
}
```

---

## T5 · Reject ticket (UC02, BR6)

1. **Method + path:** `POST /api/tickets/{code}/reject`
2. **Description:** Status `NEW → REJECTED`; the reason is stored in the history row.
3. **Authentication:** Bearer token · role COORDINATOR.
4. **Parameters:** Body: `reason` (1–500 chars, required).
5. **Success response:** `200` Ticket
6. **Error codes:**

   | HTTP | code | When |
   |---|---|---|
   | 400 | `REJECT_REASON_REQUIRED / REJECT_REASON_TOO_LONG` |  |
   | 403 | `ROLE_NOT_ALLOWED` |  |
   | 404 | `TICKET_NOT_FOUND` |  |
   | 409 | `INVALID_TRANSITION` | Only `NEW` tickets can be rejected |
   | 409 | `DATA_CHANGED` |  |

7. **Limits / notes:** —

**Example (real run):**

```http
POST /api/tickets/BH-2026-000001/reject
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Khách đổi ý, không tiếp tục bảo hành"
}
```

```json
// HTTP 200
{
  "id": 1,
  "ticketCode": "BH-2026-000001",
  "deviceId": 3,
  "issueDescription": "Cảm ứng chỗ được chỗ không đã thử khởi động lại không được",
  "issueCategoryId": null,
  "priority": null,
  "dueDate": null,
  "status": "REJECTED",
  "assignedTo": null,
  "createdBy": 1,
  "createdAt": "2026-11-14T06:15:37.602Z",
  "updatedAt": "2026-11-14T08:15:39.973Z",
  "warrantyExpired": false,
  "overdue": false,
  "customer": {
    "id": 2,
    "fullName": "Phan Hữu Bình",
    "phone": "0763247885"
  },
  "device": {
    "id": 3,
    "imei": "354100000007919",
    "model": "Samsung Y2",
    "warrantyEndDate": "2027-01-28"
  },
  "issueCategory": null,
  "assignee": null,
  "creator": {
    "id": 1,
    "fullName": "Lê Thu"
  }
}
```

---

## T6 · Assign technician (UC03, FR3, BR5)

1. **Method + path:** `POST /api/tickets/{code}/assign`
2. **Description:** Status `CLASSIFIED → ASSIGNED`, sets the assignee.
3. **Authentication:** Bearer token · role COORDINATOR.
4. **Parameters:** Body: `technicianId` (integer, required) – must be an **active** technician.
5. **Success response:** `200` Ticket
6. **Error codes:**

   | HTTP | code | When |
   |---|---|---|
   | 400 | `TECHNICIAN_REQUIRED` | Missing |
   | 400 | `TECHNICIAN_INVALID` | Unknown, not a technician, or locked |
   | 403 | `ROLE_NOT_ALLOWED` |  |
   | 404 | `TICKET_NOT_FOUND` |  |
   | 409 | `INVALID_TRANSITION` | Ticket not `CLASSIFIED` |
   | 409 | `DATA_CHANGED` |  |

7. **Limits / notes:** —

**Example (real run):**

```http
POST /api/tickets/BH-2026-000017/assign
Authorization: Bearer <token>
Content-Type: application/json

{
  "technicianId": 3
}
```

```json
// HTTP 200
{
  "id": 17,
  "ticketCode": "BH-2026-000017",
  "deviceId": 27,
  "issueDescription": "Máy tự tắt khi còn 30% pin",
  "issueCategoryId": 2,
  "priority": "HIGH",
  "dueDate": "2026-11-15T08:15:39.956Z",
  "status": "ASSIGNED",
  "assignedTo": 3,
  "createdBy": 1,
  "createdAt": "2026-11-14T08:15:39.938Z",
  "updatedAt": "2026-11-14T08:15:39.963Z",
  "warrantyExpired": false,
  "overdue": false,
  "customer": {
    "id": 26,
    "fullName": "Trần Thị Mai",
    "phone": "0912345678"
  },
  "device": {
    "id": 27,
    "imei": "352222333344445",
    "model": "Xiaomi Redmi Note 13",
    "warrantyEndDate": "2027-06-30"
  },
  "issueCategory": {
    "id": 2,
    "code": "PIN",
    "name": "Pin"
  },
  "assignee": {
    "id": 3,
    "fullName": "Phạm Huy"
  },
  "creator": {
    "id": 1,
    "fullName": "Lê Thu"
  }
}
```

---

## T7 · Technician acknowledges (UC05, FR5)

1. **Method + path:** `POST /api/tickets/{code}/acknowledge`
2. **Description:** Assigned technician confirms receipt; status `ASSIGNED → IN_PROGRESS`.
3. **Authentication:** Bearer token · role TECHNICIAN (only the assignee).
4. **Parameters:** No body.
5. **Success response:** `200` Ticket
6. **Error codes:**

   | HTTP | code | When |
   |---|---|---|
   | 403 | `ROLE_NOT_ALLOWED / TICKET_NOT_ASSIGNED_TO_YOU` |  |
   | 404 | `TICKET_NOT_FOUND` |  |
   | 409 | `INVALID_TRANSITION / DATA_CHANGED` |  |

7. **Limits / notes:** —

**Example (real run):**

```http
POST /api/tickets/BH-2026-000017/acknowledge
Authorization: Bearer <token>
```

```json
// HTTP 200
{
  "id": 17,
  "ticketCode": "BH-2026-000017",
  "deviceId": 27,
  "issueDescription": "Máy tự tắt khi còn 30% pin",
  "issueCategoryId": 2,
  "priority": "HIGH",
  "dueDate": "2026-11-15T08:15:39.956Z",
  "status": "IN_PROGRESS",
  "assignedTo": 3,
  "createdBy": 1,
  "createdAt": "2026-11-14T08:15:39.938Z",
  "updatedAt": "2026-11-14T08:15:39.967Z",
  "warrantyExpired": false,
  "overdue": false,
  "customer": {
    "id": 26,
    "fullName": "Trần Thị Mai",
    "phone": "0912345678"
  },
  "device": {
    "id": 27,
    "imei": "352222333344445",
    "model": "Xiaomi Redmi Note 13",
    "warrantyEndDate": "2027-06-30"
  },
  "issueCategory": {
    "id": 2,
    "code": "PIN",
    "name": "Pin"
  },
  "assignee": {
    "id": 3,
    "fullName": "Phạm Huy"
  },
  "creator": {
    "id": 1,
    "fullName": "Lê Thu"
  }
}
```

---

## T8 · Status history (UC06, FR5)

1. **Method + path:** `GET /api/tickets/{code}/history`
2. **Description:** All status changes of a ticket in time order: who, when, from → to, note. Exactly one row per change (NFR5); rows are never edited or deleted.
3. **Authentication:** Bearer token · same visibility as T3.
4. **Parameters:** Path `code`.
5. **Success response:** `200` `[{id, ticketId, fromStatus, toStatus, note, changedAt, changedBy: {id, fullName, role}}]`
6. **Error codes:**

   | HTTP | code | When |
   |---|---|---|
   | 403 | `TICKET_NOT_ASSIGNED_TO_YOU` |  |
   | 404 | `TICKET_NOT_FOUND` |  |

7. **Limits / notes:** —

**Example (real run):**

```http
GET /api/tickets/BH-2026-000017/history
Authorization: Bearer <token>
```

```json
// HTTP 200
[
  {
    "id": 38,
    "ticketId": 17,
    "fromStatus": null,
    "toStatus": "NEW",
    "note": "Tiếp nhận phiếu bảo hành",
    "changedBy": {
      "id": 1,
      "fullName": "Lê Thu",
      "role": "RECEPTIONIST"
    },
    "changedAt": "2026-11-14T08:15:39.938Z"
  },
  {
    "id": 39,
    "ticketId": 17,
    "fromStatus": "NEW",
    "toStatus": "CLASSIFIED",
    "note": "Phân loại: Pin",
    "changedBy": {
      "id": 2,
      "fullName": "Trần Minh",
      "role": "COORDINATOR"
    },
    "changedAt": "2026-11-14T08:15:39.955Z"
  },
  "… (more items)"
]
```

---

## L1 · Issue categories

1. **Method + path:** `GET /api/issue-categories`
2. **Description:** Active issue categories for T4.
3. **Authentication:** Bearer token · all roles.
4. **Parameters:** None.
5. **Success response:** `200` `[{id, code, name, isActive}]`
6. **Error codes:** only the common ones listed in *Conventions*.

7. **Limits / notes:** —

**Example (real run):**

```http
GET /api/issue-categories
Authorization: Bearer <token>
```

```json
// HTTP 200
[
  {
    "id": 1,
    "code": "MAN_HINH",
    "name": "Màn hình",
    "isActive": true
  },
  {
    "id": 2,
    "code": "PIN",
    "name": "Pin",
    "isActive": true
  },
  "… (more items)"
]
```

---

## L2 · Active technicians

1. **Method + path:** `GET /api/technicians`
2. **Description:** Active technicians for T6, each with the number of tickets currently held (`ASSIGNED` + `IN_PROGRESS`, computed).
3. **Authentication:** Bearer token · role COORDINATOR.
4. **Parameters:** None.
5. **Success response:** `200` `[{id, username, fullName, role, isActive, openTicketCount}]`
6. **Error codes:**

   | HTTP | code | When |
   |---|---|---|
   | 403 | `ROLE_NOT_ALLOWED` |  |

7. **Limits / notes:** —

**Example (real run):**

```http
GET /api/technicians
Authorization: Bearer <token>
```

```json
// HTTP 200
[
  {
    "id": 3,
    "username": "kt1",
    "fullName": "Phạm Huy",
    "role": "TECHNICIAN",
    "isActive": true,
    "openTicketCount": 3
  },
  {
    "id": 4,
    "username": "kt2",
    "fullName": "Võ Lan",
    "role": "TECHNICIAN",
    "isActive": true,
    "openTicketCount": 3
  }
]
```

---

## S1 · Customers CRUD (TD-13)

1. **Method + path:** `GET · PUT · DELETE /api/customers · /api/customers/{id}`
2. **Description:** List (`GET /api/customers?q=&page=&pageSize=`, each item has `deviceCount`), get one with devices (`GET /{id}`), update (`PUT /{id}`, body as C2), delete (`DELETE /{id}` → `204`). Create = C2.
3. **Authentication:** Bearer token · read: RECEPTIONIST, COORDINATOR · write: RECEPTIONIST.
4. **Parameters:** Path `id` (positive integer); query `q` searches name or phone.
5. **Success response:** `200` list / customer · `204` on delete
6. **Error codes:**

   | HTTP | code | When |
   |---|---|---|
   | 400 | `INVALID_ID / FULL_NAME_REQUIRED / INVALID_PHONE` |  |
   | 403 | `ROLE_NOT_ALLOWED` |  |
   | 404 | `CUSTOMER_NOT_FOUND` |  |
   | 409 | `PHONE_EXISTS` |  |
   | 409 | `CUSTOMER_HAS_DEVICES` | Delete refused while the customer still has devices |

7. **Limits / notes:** `pageSize` ≤ 100.

**Example (real run):**

```http
PUT /api/customers/26
Authorization: Bearer <token>
Content-Type: application/json

{
  "fullName": "Trần Thị Mai (đã sửa)",
  "phone": "0912345678"
}
```

```json
// HTTP 200
{
  "id": 26,
  "fullName": "Trần Thị Mai (đã sửa)",
  "phone": "0912345678",
  "createdAt": "2026-11-14T08:15:39.926Z"
}
```

**Error example (real run):**

```http
DELETE /api/customers/26
Authorization: Bearer <token>
```

```json
// HTTP 409
{
  "error": {
    "code": "CUSTOMER_HAS_DEVICES",
    "message": "Khách hàng còn 1 thiết bị nên không xoá được. Xoá thiết bị trước.",
    "details": {
      "deviceCount": 1
    }
  }
}
```

---

## S2 · Devices CRUD (TD-13)

1. **Method + path:** `GET · POST · PUT · DELETE /api/devices · /api/devices/{id}`
2. **Description:** List a customer's devices (`GET /api/devices?customerId=`), get one, create (`POST`, body `{customerId, imei, model, warrantyEndDate}` → `201`), update (`PUT /{id}`, body `{imei, model, warrantyEndDate}`), delete (`DELETE /{id}` → `204`).
3. **Authentication:** Bearer token · read: RECEPTIONIST, COORDINATOR · write: RECEPTIONIST.
4. **Parameters:** `imei` 15 digits, `warrantyEndDate` `YYYY-MM-DD` (real date), `model` 1–100 chars.
5. **Success response:** `200` / `201` device · `204` on delete
6. **Error codes:**

   | HTTP | code | When |
   |---|---|---|
   | 400 | `INVALID_IMEI / MODEL_REQUIRED / INVALID_WARRANTY_END_DATE / CUSTOMER_REQUIRED / INVALID_ID` |  |
   | 403 | `ROLE_NOT_ALLOWED` |  |
   | 404 | `DEVICE_NOT_FOUND / CUSTOMER_NOT_FOUND` |  |
   | 409 | `IMEI_EXISTS` |  |
   | 409 | `DEVICE_HAS_TICKETS` | Delete refused, or IMEI change refused, when the device already has tickets (BR6) |

7. **Limits / notes:** —

**Example (real run):**

```http
POST /api/devices
Authorization: Bearer <token>
Content-Type: application/json

{
  "customerId": 26,
  "imei": "352222333344445",
  "model": "Xiaomi Redmi Note 13",
  "warrantyEndDate": "2027-06-30"
}
```

```json
// HTTP 201
{
  "id": 27,
  "customerId": 26,
  "imei": "352222333344445",
  "model": "Xiaomi Redmi Note 13",
  "warrantyEndDate": "2027-06-30",
  "warrantyExpired": false,
  "createdAt": "2026-11-14T08:15:39.935Z"
}
```

**Error example (real run):**

```http
DELETE /api/devices/27
Authorization: Bearer <token>
```

```json
// HTTP 409
{
  "error": {
    "code": "DEVICE_HAS_TICKETS",
    "message": "Thiết bị đã có phiếu bảo hành nên không xoá được (BR6: phiếu không bao giờ bị xoá).",
    "details": {
      "ticketCount": 1
    }
  }
}
```

---

## Authorisation error examples (real run)

```http
GET /api/tickets
```

```json
// HTTP 401
{
  "error": {
    "code": "TOKEN_REQUIRED",
    "message": "Bạn cần đăng nhập để dùng chức năng này."
  }
}
```

```http
POST /api/tickets/BH-2026-000017/classify
Authorization: Bearer <token>
Content-Type: application/json

{
  "issueCategoryId": 1,
  "priority": "LOW"
}
```

```json
// HTTP 403
{
  "error": {
    "code": "ROLE_NOT_ALLOWED",
    "message": "Vai trò của bạn không được phép phân loại phiếu.",
    "details": {
      "allowedRoles": [
        "COORDINATOR"
      ]
    }
  }
}
```

## Ticket object

| Field | Type | Meaning |
|---|---|---|
| `id`, `ticketCode` | number, string | Internal id and business code `BH-YYYY-NNNNNN` |
| `status` | string | `NEW`, `CLASSIFIED`, `ASSIGNED`, `IN_PROGRESS`, `REJECTED` |
| `issueDescription` | string | Customer's description of the fault |
| `issueCategoryId`, `issueCategory` | number / object or `null` | Set by T4 |
| `priority`, `dueDate` | string / ISO time or `null` | Set by T4; due date by BR4 |
| `assignedTo`, `assignee` | number / object or `null` | Set by T6 |
| `createdBy`, `creator` | number / object | Receptionist who created the ticket |
| `customer`, `device` | object | Owner and device (customer is derived from the device – 3NF) |
| `warrantyExpired` | boolean | Computed: reception date (Vietnam time) after `device.warrantyEndDate` (BR3) |
| `overdue` | boolean | Computed: `dueDate` passed and status is CLASSIFIED / ASSIGNED / IN_PROGRESS |
| `createdAt`, `updatedAt` | ISO time | |

Try the whole flow from the command line: `bash scripts/demo-api.sh` (curl) or `node scripts/tc.js all` (12 system test cases).

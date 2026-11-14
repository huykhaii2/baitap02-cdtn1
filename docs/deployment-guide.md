# Deployment Guide — Smart CRM (Mekong Mobile), flow L2, track SE · tag `v1.0`

Warranty request intake and classification: receptionists create warranty tickets, coordinators classify and assign them, technicians acknowledge them.
Author: Giang Huy Khải (2374802010205) · Repo: https://github.com/huykhaii2/baitap02-cdtn1

The system is packaged as **two containers**: `app` (Node.js 22 + Express 4, serves both the REST API and the web UI) and `db` (PostgreSQL 16, reachable only inside the Compose network).
On start-up the app **automatically** creates the tables (`npm run migrate`) and loads the sample data (`npm run seed`); both steps are idempotent, so restarting never duplicates data.

## 1. Requirements

| Item | Version / value | Check with |
|---|---|---|
| OS | Windows 10/11 with Docker Desktop (WSL 2 backend), macOS, or Linux. Tested on Windows 11 + Docker Desktop | — |
| Docker Engine | 24 or newer | `docker version` (must show both *Client* and *Server*) |
| Docker Compose | v2 (plugin) | `docker compose version` |
| Git | any recent version | `git --version` |
| Disk / ports | about 2 GB free; host port **3000** free (change with `APP_PORT`) | — |

Node.js and PostgreSQL do **not** need to be installed on the host.

## 2. Setup steps

Run each step from an empty folder. Every step is one command.

| # | Step | Command |
|---|---|---|
| 1 | Get the submitted version | `git clone --branch v1.0 https://github.com/huykhaii2/baitap02-cdtn1.git` |
| 2 | Enter the project folder | `cd baitap02-cdtn1` |
| 3 | Create the configuration file (sample values work as-is) | `cp .env.example .env` (Windows PowerShell: `Copy-Item .env.example .env`) |
| 4 | Build and start both containers (first build takes 2–4 minutes) | `docker compose up -d --build` |

Wait about 30 seconds after step 4, then go to section 5. Open the app at **http://localhost:3000**.

Stop: `docker compose down` (keeps the data) · Stop and delete all data: `docker compose down -v`.

## 3. Environment variables

All variables live in `.env` (copied from `.env.example`). `.env` is git-ignored and is never copied into the image (`.dockerignore`).

| Name | Meaning | Sample value | Required |
|---|---|---|---|
| `DB_NAME` | PostgreSQL database name; also used by the `db` container to create the database on first start | `smartcrm` | yes |
| `DB_USER` | PostgreSQL user (created by the `db` container on first start) | `smartcrm` | yes |
| `DB_PASSWORD` | PostgreSQL password | `smartcrm` (sample – change for a real deployment) | yes |
| `DB_HOST`, `DB_PORT` | Database address. Used only when running without Docker; Compose overrides them with `db` and `5432` | `localhost`, `5432` | yes (no Docker) |
| `SECRET_KEY` | Key used to sign login tokens (JWT), at least 32 characters. Generate a real one with `openssl rand -hex 32` | sample string in `.env.example` | yes |
| `TOKEN_EXPIRES_IN` | Login token lifetime | `8h` | no (default `8h`) |
| `APP_PORT` | Host port mapped to the app (the port inside the container is always 3000) | `3000` | no (default `3000`) |
| `DATABASE_URL`, `DB_SSL` | Optional: connection string for a cloud database instead of the `DB_*` variables | — | no |

If a required variable is missing, the app stops immediately with `Thiếu biến môi trường <NAME>` ("missing environment variable") and prints only the variable name, never its value.

## 4. Sample data

Loaded automatically on start-up by `scripts/seed.js` from the case-study files in `dataset/` (phone numbers and names are cleaned). Expected counts after the first start:

| Table | Rows | Notes |
|---|---|---|
| `staff` | 5 | demo accounts below |
| `issue_category` | 6 | Màn hình, Pin, Sạc – nguồn, Phần mềm, Vào nước, Khác |
| `customer` | 25 | includes demo customer `0901234567` (Nguyễn Văn An) |
| `device` | 26 | demo devices `356789012345678` (in warranty, no ticket) and `356789012345679` (warranty expired) |
| `ticket` | 16 | all five statuses; 2 overdue tickets |
| `ticket_status_log` | 37 | one row per status change |

Demo accounts – shared password `Matkhau@123` (sample data; stored as bcrypt hashes, never in plain text):

| Username | Role | Can do |
|---|---|---|
| `tn1` | Receptionist | create tickets (M1), list (M2), manage customers & devices (M4) |
| `dp1` | Coordinator | classify / reject and assign tickets (M3); read-only M4 |
| `kt1`, `kt2` | Technician | see only their own tickets, acknowledge them |
| `kt3` | Technician (locked) | login is refused |

## 5. Verify it works

| # | Command | Expected result |
|---|---|---|
| 1 | `docker compose ps` | `app` and `db` both **Up … (healthy)**; only `app` publishes `0.0.0.0:3000->3000/tcp`, `db` shows `5432/tcp` (internal only) |
| 2 | `curl http://localhost:3000/api/health` (PowerShell: `curl.exe …`) | `{"status":"ok","db":"ok","service":"Smart CRM – Mekong Mobile · L2"}` |
| 3 | `docker compose logs app --tail 30` | contains `Migration xong`, `Seed xong` and `đang chạy tại http://localhost:3000` |
| 4 | `docker compose exec app npm test` | `tests 82` · `pass 82` · `fail 0` |
| 5 | `docker compose exec app npm run test:db` | `tests 19` · `pass 19` · `fail 0` (uses the PostgreSQL container; cleans up its own data) |
| 6 | `docker compose exec app node scripts/tc.js all` | the 12 system test cases of `docs/test-report.md`, ending with `TỔNG KẾT: 12/12 PASS` |
| 7 | Browser: http://localhost:3000 → log in as `tn1` / `Matkhau@123` | ticket creation screen; ticket list shows 16 sample tickets |
| 8 | Restart: `docker compose restart app`, then `docker compose logs app --tail 15` | seed prints `mới 0` for every table – no duplicated data |

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `failed to connect to the docker API … dockerDesktopLinuxEngine` | Docker Desktop is not running | Start Docker Desktop (Windows: `Start-Process "$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe"` or the Program Files path), wait until `docker info` works |
| `Bind for 0.0.0.0:3000 failed: port is already allocated` | Another program uses port 3000 | Set `APP_PORT=3001` in `.env`, run step 4 again, open http://localhost:3001 |
| `env file …/.env not found` | Step 3 was skipped | Run step 3 |
| `app` stays `starting` / `unhealthy` | Usually a wrong `DB_*` value or an old volume created with other credentials | `docker compose logs app --tail 50`; if it says `password authentication failed`, run `docker compose down -v` and step 4 again |
| Health returns `503 DB_UNAVAILABLE` | The database container is stopped | `docker compose start db`, wait 10 s, check #2 again |

## 6. Monitoring & alerts

Monitoring: `GET /api/health` checks the app and the database (used by the Compose health check every 10 s); errors ≥ 500 are logged with method and path; a lost database connection is logged as one warning line and returned as `503 DB_UNAVAILABLE`.

### ALERT-01 Service unavailable (technical)
- **Measure:** result of `GET /api/health`, checked every minute.
- **Threshold:** non-200 response 3 times in a row (3 minutes).
- **Notify:** on-duty operator (chat message).
- **Action:** 1) `docker compose ps` – find the unhealthy service; 2) if `db` is down: `docker compose start db`, then `curl /api/health` must return `"db":"ok"`; 3) otherwise `docker compose logs app --tail 50` and `docker compose restart app`; 4) still failing after 10 minutes → escalate to the developer.

### ALERT-02 Tickets about to miss the processing deadline (business)
- **Measure:** number of tickets in *Classified / Assigned / In progress* whose `due_date` is within the next 4 hours (`GET /api/tickets?status=…&dueTo=<today>`), checked hourly.
- **Threshold:** more than 10 tickets, or any ticket already overdue for more than 24 hours.
- **Notify:** service centre coordinator (e-mail).
- **Action:** open screen M2, filter by due date, reassign overdue tickets to technicians with the fewest open tickets (shown in the assignment list).

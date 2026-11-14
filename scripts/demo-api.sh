#!/usr/bin/env bash
# Gọi thử toàn bộ luồng chính qua API bằng curl (cần npm start đang chạy ở terminal khác).
#   bash scripts/demo-api.sh                    # mặc định http://localhost:3000
#   BASE=http://localhost:8080 bash scripts/demo-api.sh
# Mỗi lần chạy tạo khách hàng + thiết bị mới (SĐT, IMEI ngẫu nhiên) nên chạy lại được nhiều lần.
set -euo pipefail
BASE="${BASE:-http://localhost:3000}"
API="$BASE/api"
PHONE="09$(printf '%08d' $((RANDOM * RANDOM % 100000000)))"
IMEI="98$(printf '%013d' $((RANDOM * RANDOM * RANDOM % 10000000000000)))"

json() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s||"null");const v=process.argv[1].split(".").reduce((a,k)=>a==null?a:a[k],o);console.log(typeof v==="object"?JSON.stringify(v):v)})' "$1"; }
step() { printf '\n\033[1m== %s\033[0m\n' "$1"; }
call() { # call METHOD PATH TOKEN [BODY]
  local method=$1 path=$2 token=$3 body=${4:-}
  local args=(-s -w '\n%{http_code}' -X "$method" "$API$path" -H 'Content-Type: application/json')
  [ -n "$token" ] && args+=(-H "Authorization: Bearer $token")
  [ -n "$body" ] && args+=(-d "$body")
  local out; out=$(curl "${args[@]}")
  LAST_STATUS=$(tail -n1 <<<"$out"); LAST_BODY=$(sed '$d' <<<"$out")
  printf '%s %s → HTTP %s\n%s\n' "$method" "$path" "$LAST_STATUS" "$(head -c 400 <<<"$LAST_BODY")"
}
login() { call POST /auth/login "" "{\"username\":\"$1\",\"password\":\"Matkhau@123\"}" >/dev/null; json token <<<"$LAST_BODY"; }

step "0. Sức khoẻ hệ thống"
call GET /health ""

step "A1. Đăng nhập 3 vai trò (+ tài khoản đã khoá)"
TN=$(login tn1); DP=$(login dp1); KT=$(login kt1)
call POST /auth/login "" '{"username":"kt3","password":"Matkhau@123"}'

step "T1. Nhân viên tiếp nhận tạo phiếu (SĐT $PHONE, IMEI $IMEI – tạo luôn khách hàng và thiết bị)"
call POST /tickets "$TN" "{\"phone\":\"$PHONE\",\"imei\":\"$IMEI\",\"issueDescription\":\"Máy tự tắt khi còn 30% pin\",\"customer\":{\"fullName\":\"Khách demo API\"},\"device\":{\"model\":\"Samsung Galaxy A35\",\"warrantyEndDate\":\"2027-08-31\"}}"
CODE=$(json ticketCode <<<"$LAST_BODY")

step "BR2. Tạo phiếu thứ hai cho cùng IMEI → 409"
call POST /tickets "$TN" "{\"phone\":\"$PHONE\",\"imei\":\"$IMEI\",\"issueDescription\":\"Lần 2\"}"

step "NFR4. Nhân viên tiếp nhận gọi phân loại → 403"
call POST "/tickets/$CODE/classify" "$TN" '{"issueCategoryId":1,"priority":"HIGH"}'

step "T4. Điều phối viên phân loại (thiếu danh mục → 400, rồi hợp lệ → 200)"
call POST "/tickets/$CODE/classify" "$DP" '{"priority":"HIGH"}'
call POST "/tickets/$CODE/classify" "$DP" '{"issueCategoryId":2,"priority":"HIGH"}'

step "L2 + T6. Phân công cho kỹ thuật viên kt1"
call GET /technicians "$DP" >/dev/null
KT1_ID=$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).find(t=>t.username==="kt1").id))' <<<"$LAST_BODY")
call POST "/tickets/$CODE/assign" "$DP" "{\"technicianId\":$KT1_ID}"

step "T7. Kỹ thuật viên xác nhận nhận phiếu"
call POST "/tickets/$CODE/acknowledge" "$KT"

step "T8. Lịch sử trạng thái (4 dòng)"
call GET "/tickets/$CODE/history" "$DP" >/dev/null
node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>JSON.parse(s).forEach(l=>console.log(`  ${l.fromStatus||"—"} → ${l.toStatus}  (${l.changedBy.fullName})  ${l.note||""}`)))' <<<"$LAST_BODY"

step "T2. Danh sách phiếu lọc theo trạng thái Đang xử lý, tìm theo mã"
call GET "/tickets?status=IN_PROGRESS&q=$CODE" "$DP"

step "S1. Xoá khách hàng còn thiết bị → 409 CUSTOMER_HAS_DEVICES"
CID=$(call GET "/customers/by-phone/$PHONE" "$TN" >/dev/null; json id <<<"$LAST_BODY")
call DELETE "/customers/$CID" "$TN"

step "Không có token → 401"
call GET /tickets ""

printf '\nXong. Phiếu demo: %s\n' "$CODE"

// Quy tắc nghiệp vụ dùng chung (docs/srs.md mục 1.5). Đổi một quy tắc chỉ sửa file này (NFR3).
const ROLES = Object.freeze({
  RECEPTIONIST: 'RECEPTIONIST',
  COORDINATOR: 'COORDINATOR',
  TECHNICIAN: 'TECHNICIAN',
});

const STATUSES = Object.freeze(['NEW', 'CLASSIFIED', 'ASSIGNED', 'IN_PROGRESS', 'REJECTED']);
// BR2: phiếu "chưa đóng" – trùng với điều kiện của index ux_ticket_open_device.
const OPEN_STATUSES = Object.freeze(['NEW', 'CLASSIFIED', 'ASSIGNED', 'IN_PROGRESS']);

const STATUS_LABELS = Object.freeze({
  NEW: 'Mới',
  CLASSIFIED: 'Đã phân loại',
  ASSIGNED: 'Đã phân công',
  IN_PROGRESS: 'Đang xử lý',
  REJECTED: 'Từ chối',
});

// BR6: trạng thái chỉ đi tới, không quay lui; Từ chối chỉ từ Mới.
const TRANSITIONS = Object.freeze({
  NEW: ['CLASSIFIED', 'REJECTED'],
  CLASSIFIED: ['ASSIGNED'],
  ASSIGNED: ['IN_PROGRESS'],
  IN_PROGRESS: [],
  REJECTED: [],
});

const PRIORITIES = Object.freeze(['HIGH', 'MEDIUM', 'LOW']);
const PRIORITY_LABELS = Object.freeze({ HIGH: 'Cao', MEDIUM: 'Trung bình', LOW: 'Thấp' });

// BR4: hạn xử lý = thời điểm phân loại + số giờ theo mức ưu tiên.
const SLA_HOURS = Object.freeze({ HIGH: 24, MEDIUM: 72, LOW: 120 });

// Năm theo giờ Việt Nam (UTC+7) – dùng cho mã phiếu BH-YYYY-NNNNNN, không phụ thuộc múi giờ máy chủ.
function yearInVietnam(date) {
  return new Date(date.getTime() + 7 * 60 * 60 * 1000).getUTCFullYear();
}

function canTransition(fromStatus, toStatus) {
  return (TRANSITIONS[fromStatus] || []).includes(toStatus);
}

function computeDueDate(priority, classifiedAt) {
  const hours = SLA_HOURS[priority];
  if (!hours) throw new Error(`Mức ưu tiên không hợp lệ: ${priority}`);
  return new Date(classifiedAt.getTime() + hours * 60 * 60 * 1000);
}

module.exports = {
  ROLES,
  STATUSES,
  OPEN_STATUSES,
  STATUS_LABELS,
  TRANSITIONS,
  PRIORITIES,
  PRIORITY_LABELS,
  SLA_HOURS,
  canTransition,
  computeDueDate,
  yearInVietnam,
};

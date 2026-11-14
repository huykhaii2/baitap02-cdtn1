// Tiện ích hiển thị dùng chung cho các màn hình.
export const STATUS_LABELS = {
  NEW: 'Mới',
  CLASSIFIED: 'Đã phân loại',
  ASSIGNED: 'Đã phân công',
  IN_PROGRESS: 'Đang xử lý',
  REJECTED: 'Từ chối',
};
export const PRIORITY_LABELS = { HIGH: 'Cao', MEDIUM: 'Trung bình', LOW: 'Thấp' };
export const SLA_HOURS = { HIGH: 24, MEDIUM: 72, LOW: 120 }; // chỉ để hiển thị gợi ý; máy chủ mới là nơi tính (BR4)
export const ROLE_LABELS = { RECEPTIONIST: 'Nhân viên tiếp nhận', COORDINATOR: 'Điều phối viên', TECHNICIAN: 'Kỹ thuật viên' };

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const h = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ESC[ch]);

const dateTimeFmt = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric',
});
export const formatDateTime = (iso) => (iso ? dateTimeFmt.format(new Date(iso)) : '—');
export const formatDate = (ymd) => (ymd ? ymd.split('-').reverse().join('/') : '—');

export const statusBadge = (status) => `<span class="badge status-${h(status)}">${h(STATUS_LABELS[status] || status)}</span>`;
export const priorityBadge = (priority) =>
  priority ? `<span class="badge prio-${h(priority)}">${h(PRIORITY_LABELS[priority])}</span>` : '<span class="muted">—</span>';

let toastTimer;
export function toast(message, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = `toast show toast-${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 3500);
}

// Hiện lỗi theo trường: phần tử <small class="field-error" data-error-for="phone">.
export function clearFieldErrors(root) {
  root.querySelectorAll('.field-error').forEach((el) => { el.textContent = ''; });
  root.querySelectorAll('.invalid').forEach((el) => el.classList.remove('invalid'));
}
export function showFieldError(root, field, message) {
  const slot = root.querySelector(`[data-error-for="${field}"]`);
  if (!slot) return false;
  slot.textContent = message;
  const input = root.querySelector(`[name="${field}"]`);
  if (input) input.classList.add('invalid');
  return true;
}

// Banner thông báo trong vùng .alert-slot
export function showAlert(slot, message, type = 'error', extraHtml = '') {
  slot.innerHTML = message ? `<div class="alert alert-${type}" role="alert">${h(message)}${extraHtml}</div>` : '';
}

// Nút xoá hai bước: bấm lần 1 đổi chữ "Bấm lần nữa để xoá", lần 2 mới gọi onConfirm.
export function twoStepButton(button, onConfirm) {
  const original = button.textContent;
  let armed = false;
  let timer;
  button.addEventListener('click', async () => {
    if (!armed) {
      armed = true;
      button.textContent = 'Bấm lần nữa để xoá';
      button.classList.add('armed');
      timer = setTimeout(() => { armed = false; button.textContent = original; button.classList.remove('armed'); }, 3000);
      return;
    }
    clearTimeout(timer);
    armed = false;
    button.textContent = original;
    button.classList.remove('armed');
    await onConfirm();
  });
}

export function setBusy(button, busy, busyText = 'Đang lưu…') {
  if (busy) {
    button.dataset.label = button.textContent;
    button.textContent = busyText;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.label || button.textContent;
    button.disabled = false;
  }
}

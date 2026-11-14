// M2 – Danh sách phiếu bảo hành (UC04, FR4): lọc trạng thái, mức ưu tiên, khoảng hạn xử lý; tìm mã phiếu / SĐT;
// phân trang 20 phiếu/trang với nút ‹ / › (TD-09); phiếu quá hạn được đánh dấu.
import { listTickets } from '../api/ticket.api.js';
import { loadInto } from '../components/DataState.js';
import { h, formatDateTime, statusBadge, priorityBadge, STATUS_LABELS, PRIORITY_LABELS } from '../components/ui.js';

const FILTER_KEYS = ['q', 'status', 'priority', 'dueFrom', 'dueTo', 'page'];

export function render(root, { session, query, navigate }) {
  const role = session.staff.role;
  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, query[k] || '']));
  const options = (labels, selected) =>
    Object.entries(labels).map(([v, l]) => `<option value="${v}"${v === selected ? ' selected' : ''}>${h(l)}</option>`).join('');

  root.innerHTML = `
    <div class="page-head">
      <div>
        <p class="eyebrow">M2 · UC04</p>
        <h1>${role === 'TECHNICIAN' ? 'Phiếu được giao cho tôi' : 'Danh sách phiếu bảo hành'}</h1>
      </div>
      ${role === 'RECEPTIONIST' ? '<a class="btn btn-primary" href="#/tickets/new" id="newTicketBtn">+ Tạo phiếu bảo hành</a>' : ''}
    </div>
    <form class="card filters" id="filterForm">
      <label class="field field-grow"><span>Tìm mã phiếu hoặc SĐT</span>
        <input name="q" id="q" value="${h(filters.q)}" placeholder="VD: BH-2026-000012 hoặc 0901234567" maxlength="50"></label>
      <label class="field"><span>Trạng thái</span>
        <select name="status" id="status"><option value="">Tất cả</option>${options(STATUS_LABELS, filters.status)}</select></label>
      <label class="field"><span>Mức ưu tiên</span>
        <select name="priority" id="priority"><option value="">Tất cả</option>${options(PRIORITY_LABELS, filters.priority)}</select></label>
      <label class="field"><span>Hạn xử lý từ</span><input type="date" name="dueFrom" id="dueFrom" value="${h(filters.dueFrom)}"></label>
      <label class="field"><span>đến</span><input type="date" name="dueTo" id="dueTo" value="${h(filters.dueTo)}"></label>
      <div class="filter-actions">
        <button class="btn btn-primary" type="submit">Lọc</button>
        <button class="btn btn-ghost" type="button" id="clearFilters">Xoá lọc</button>
      </div>
    </form>
    <section class="card card-flush" id="ticketArea" aria-live="polite"></section>`;

  const go = (next) => {
    const qs = new URLSearchParams(Object.entries(next).filter(([, v]) => v !== '' && v !== undefined)).toString();
    navigate(`#/tickets${qs ? `?${qs}` : ''}`);
  };

  root.querySelector('#filterForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    go({ ...Object.fromEntries(FILTER_KEYS.map((k) => [k, (form.get(k) || '').toString().trim()])), page: '' });
  });
  root.querySelector('#clearFilters').addEventListener('click', () => go({}));

  const area = root.querySelector('#ticketArea');
  const hasFilter = FILTER_KEYS.some((k) => k !== 'page' && filters[k]);

  loadInto(area, {
    loadingText: 'Đang tải danh sách phiếu…',
    load: () => listTickets({ ...filters, pageSize: 20 }),
    isEmpty: (data) => data.items.length === 0,
    empty: {
      title: hasFilter ? 'Không có phiếu nào khớp bộ lọc' : 'Chưa có phiếu bảo hành nào',
      hint: hasFilter ? 'Thử bỏ bớt điều kiện lọc hoặc kiểm tra lại từ khoá.' : role === 'TECHNICIAN' ? 'Bạn chưa được phân công phiếu nào.' : '',
      actionHtml: hasFilter ? '<a class="btn btn-secondary" href="#/tickets">Xoá lọc</a>' : '',
    },
    render: (data) => {
      area.innerHTML = `
        <div class="table-meta"><span>${data.total} phiếu</span></div>
        <div class="table-wrap">
          <table class="table table-responsive" id="ticketTable">
            <thead><tr>
              <th>Mã phiếu</th><th>Khách hàng</th><th>Thiết bị</th><th>Danh mục lỗi</th>
              <th>Ưu tiên</th><th>Hạn xử lý</th><th>Trạng thái</th><th>Kỹ thuật viên</th>
            </tr></thead>
            <tbody>${data.items.map(row).join('')}</tbody>
          </table>
        </div>
        <nav class="pager" aria-label="Phân trang">
          <button class="btn btn-secondary btn-sm" id="prevPage" ${data.page <= 1 ? 'disabled' : ''} aria-label="Trang trước">‹</button>
          <span id="pageInfo">Trang ${data.page} / ${data.totalPages}</span>
          <button class="btn btn-secondary btn-sm" id="nextPage" ${data.page >= data.totalPages ? 'disabled' : ''} aria-label="Trang sau">›</button>
        </nav>`;
      area.querySelector('#prevPage').addEventListener('click', () => go({ ...filters, page: String(data.page - 1) }));
      area.querySelector('#nextPage').addEventListener('click', () => go({ ...filters, page: String(data.page + 1) }));
    },
  });
}

function row(t) {
  return `<tr class="${t.overdue ? 'row-overdue' : ''}">
    <td data-label="Mã phiếu"><a class="code-link" href="#/tickets/${h(t.ticketCode)}">${h(t.ticketCode)}</a>
      <div class="sub">${formatDateTime(t.createdAt)}</div></td>
    <td data-label="Khách hàng">${h(t.customer.fullName)}<div class="sub">${h(t.customer.phone)}</div></td>
    <td data-label="Thiết bị">${h(t.device.model)}<div class="sub mono">${h(t.device.imei)}</div>
      ${t.warrantyExpired ? '<span class="badge badge-warn">Hết hạn bảo hành</span>' : ''}</td>
    <td data-label="Danh mục lỗi">${t.issueCategory ? h(t.issueCategory.name) : '<span class="muted">Chưa phân loại</span>'}</td>
    <td data-label="Ưu tiên">${priorityBadge(t.priority)}</td>
    <td data-label="Hạn xử lý">${t.dueDate ? formatDateTime(t.dueDate) : '<span class="muted">—</span>'}
      ${t.overdue ? '<span class="badge badge-danger">Quá hạn</span>' : ''}</td>
    <td data-label="Trạng thái">${statusBadge(t.status)}</td>
    <td data-label="Kỹ thuật viên">${t.assignee ? h(t.assignee.fullName) : '<span class="muted">—</span>'}</td>
  </tr>`;
}

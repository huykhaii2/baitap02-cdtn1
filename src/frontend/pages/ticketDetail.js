// M3 – Chi tiết phiếu bảo hành: UC02 phân loại / từ chối, UC03 phân công, UC05 nhận phiếu, UC06 lịch sử.
// Nút chỉ hiện khi vai trò + trạng thái cho phép; máy chủ vẫn kiểm tra lại (NFR4).
import {
  getTicket, getTicketHistory, classifyTicket, rejectTicket, assignTicket, acknowledgeTicket,
  listIssueCategories, listTechnicians,
} from '../api/ticket.api.js';
import { loadInto } from '../components/DataState.js';
import {
  h, formatDate, formatDateTime, statusBadge, priorityBadge, toast, showAlert, setBusy,
  clearFieldErrors, showFieldError, PRIORITY_LABELS, SLA_HOURS, STATUS_LABELS, ROLE_LABELS,
} from '../components/ui.js';

export function render(root, { session, params }) {
  const { code } = params;
  const role = session.staff.role;

  root.innerHTML = `
    <div class="page-head">
      <div><p class="eyebrow">M3 · UC02 · UC03 · UC05 · UC06</p><h1 class="mono">${h(code)}</h1></div>
      <a class="btn btn-ghost" href="#/tickets">← Danh sách phiếu</a>
    </div>
    <div id="detailArea"></div>`;
  const area = root.querySelector('#detailArea');

  const reload = () =>
    loadInto(area, {
      loadingText: 'Đang tải phiếu…',
      load: () => getTicket(code),
      render: (ticket) => draw(ticket),
    });

  function draw(t) {
    area.innerHTML = `
      <div class="alert-slot" id="actionAlert"></div>
      <div class="detail-grid">
        <section class="card">
          <div class="ticket-head">
            ${statusBadge(t.status)}
            ${t.warrantyExpired ? '<span class="badge badge-warn" id="warrantyExpired">Hết hạn bảo hành</span>' : ''}
            ${t.overdue ? '<span class="badge badge-danger" id="overdueBadge">Quá hạn xử lý</span>' : ''}
          </div>
          <dl class="kv">
            <dt>Khách hàng</dt><dd>${h(t.customer.fullName)}</dd>
            <dt>Số điện thoại</dt><dd>${h(t.customer.phone)}</dd>
            <dt>Thiết bị</dt><dd>${h(t.device.model)}</dd>
            <dt>IMEI</dt><dd class="mono">${h(t.device.imei)}</dd>
            <dt>Hết hạn bảo hành</dt><dd>${formatDate(t.device.warrantyEndDate)}</dd>
            <dt>Tiếp nhận</dt><dd>${formatDateTime(t.createdAt)} · ${h(t.creator.fullName)}</dd>
            <dt>Danh mục lỗi</dt><dd>${t.issueCategory ? h(t.issueCategory.name) : '<span class="muted">Chưa phân loại</span>'}</dd>
            <dt>Mức ưu tiên</dt><dd>${priorityBadge(t.priority)}</dd>
            <dt>Hạn xử lý</dt><dd>${t.dueDate ? formatDateTime(t.dueDate) : '<span class="muted">—</span>'}</dd>
            <dt>Kỹ thuật viên</dt><dd>${t.assignee ? h(t.assignee.fullName) : '<span class="muted">—</span>'}</dd>
          </dl>
          <h3>Mô tả lỗi</h3>
          <p class="description">${h(t.issueDescription)}</p>
        </section>
        <div class="stack">
          <div id="actions"></div>
          <section class="card">
            <h2>Lịch sử trạng thái</h2>
            <div id="historyArea"></div>
          </section>
        </div>
      </div>`;
    drawActions(t);
    loadInto(area.querySelector('#historyArea'), {
      loadingText: 'Đang tải lịch sử…',
      load: () => getTicketHistory(t.ticketCode),
      isEmpty: (rows) => rows.length === 0,
      empty: { title: 'Chưa có lịch sử' },
      render: (rows) => {
        area.querySelector('#historyArea').innerHTML = `<ol class="timeline" id="historyList">${rows
          .map((r) => `<li>
            <div class="timeline-head">${r.fromStatus ? `${statusBadge(r.fromStatus)} → ` : ''}${statusBadge(r.toStatus)}</div>
            <div class="sub">${formatDateTime(r.changedAt)} · ${h(r.changedBy.fullName)} (${h(ROLE_LABELS[r.changedBy.role] || r.changedBy.role)})</div>
            ${r.note ? `<div class="timeline-note">${h(r.note)}</div>` : ''}
          </li>`)
          .join('')}</ol>`;
      },
    });
  }

  // Lỗi khi thao tác: lỗi theo trường hiện dưới ô nhập; 409 DATA_CHANGED (UC03-4b) có nút tải lại.
  function handleActionError(container, err) {
    const alertSlot = area.querySelector('#actionAlert');
    if (err.details && err.details.field && showFieldError(container, err.details.field, err.message)) return;
    const extra = err.code === 'DATA_CHANGED' || err.code === 'INVALID_TRANSITION'
      ? ' <button type="button" class="btn btn-secondary btn-sm" id="reloadTicket">Tải lại phiếu</button>' : '';
    showAlert(alertSlot, err.message, 'error', extra);
    const btn = alertSlot.querySelector('#reloadTicket');
    if (btn) btn.addEventListener('click', reload);
  }

  async function runAction(container, button, action, successMessage) {
    clearFieldErrors(container);
    showAlert(area.querySelector('#actionAlert'), '');
    setBusy(button, true);
    try {
      await action();
      toast(successMessage);
      reload();
    } catch (err) {
      setBusy(button, false);
      handleActionError(container, err);
    }
  }

  function drawActions(t) {
    const box = area.querySelector('#actions');
    if (role === 'COORDINATOR' && t.status === 'NEW') return drawClassify(box, t);
    if (role === 'COORDINATOR' && t.status === 'CLASSIFIED') return drawAssign(box, t);
    if (role === 'TECHNICIAN' && t.status === 'ASSIGNED' && t.assignedTo === session.staff.id) return drawAcknowledge(box, t);
    const note = {
      REJECTED: 'Phiếu đã bị từ chối – không thao tác thêm được (BR6).',
      IN_PROGRESS: 'Phiếu đang được kỹ thuật viên xử lý.',
    }[t.status] || (role === 'RECEPTIONIST'
      ? 'Nhân viên tiếp nhận chỉ xem phiếu; Điều phối viên sẽ phân loại và phân công.'
      : `Trạng thái hiện tại: ${STATUS_LABELS[t.status]}.`);
    box.innerHTML = `<section class="card card-muted" id="noAction"><p>${h(note)}</p></section>`;
    return undefined;
  }

  // UC02 – phân loại hoặc từ chối (chỉ khi phiếu Mới)
  function drawClassify(box, t) {
    box.innerHTML = `
      <section class="card" id="classifyCard">
        <h2>Phân loại phiếu</h2>
        <div id="classifyBody"></div>
      </section>
      <section class="card card-disabled" aria-disabled="true">
        <h2>Phân công kỹ thuật viên</h2>
        <p class="muted">Phân loại phiếu trước rồi mới phân công được (US3).</p>
        <button class="btn btn-secondary" disabled>Phân công</button>
      </section>
      <section class="card" id="rejectCard">
        <h2>Từ chối phiếu</h2>
        ${t.warrantyExpired ? '<p class="badge badge-warn">Thiết bị đã hết hạn bảo hành (BR3)</p>' : ''}
        <form id="rejectForm" novalidate>
          <label class="field"><span>Lý do từ chối</span>
            <textarea name="reason" id="reason" rows="2" maxlength="500" placeholder="VD: Máy vào nước do sử dụng, không thuộc điều kiện bảo hành"></textarea>
            <small class="field-error" data-error-for="reason"></small></label>
          <button class="btn btn-danger" type="submit" id="rejectBtn">Từ chối phiếu</button>
        </form>
      </section>`;
    const body = box.querySelector('#classifyBody');
    loadInto(body, {
      loadingText: 'Đang tải danh mục lỗi…',
      load: listIssueCategories,
      isEmpty: (rows) => rows.length === 0,
      empty: { title: 'Chưa có danh mục lỗi', hint: 'Chạy npm run seed để nạp danh mục.' },
      render: (categories) => {
        body.innerHTML = `
          <form id="classifyForm" novalidate>
            <label class="field"><span>Danh mục lỗi</span>
              <select name="issueCategoryId" id="issueCategoryId">
                <option value="">— Chọn danh mục —</option>
                ${categories.map((c) => `<option value="${c.id}">${h(c.name)}</option>`).join('')}
              </select>
              <small class="field-error" data-error-for="issueCategoryId"></small></label>
            <fieldset class="field">
              <legend>Mức ưu tiên</legend>
              <div class="segmented">
                ${Object.entries(PRIORITY_LABELS).map(([v, l]) => `
                  <label class="seg prio-${v}"><input type="radio" name="priority" value="${v}">
                    <span>${h(l)}<small>+${SLA_HOURS[v]} giờ</small></span></label>`).join('')}
              </div>
              <small class="field-error" data-error-for="priority"></small>
            </fieldset>
            <p class="field-hint" id="duePreview">Hạn xử lý = thời điểm lưu + số giờ theo mức ưu tiên (BR4).</p>
            <button class="btn btn-primary" type="submit" id="classifyBtn">Lưu phân loại</button>
          </form>`;
        const form = body.querySelector('#classifyForm');
        form.addEventListener('change', (e) => {
          const slot = form.querySelector(`[data-error-for="${e.target.name}"]`);
          if (slot) { slot.textContent = ''; e.target.classList.remove('invalid'); }
          const p = form.priority.value;
          if (p) body.querySelector('#duePreview').textContent = `Hạn xử lý dự kiến: ${formatDateTime(new Date(Date.now() + SLA_HOURS[p] * 3600e3).toISOString())} (BR4).`;
        });
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          clearFieldErrors(form);
          let bad = false;
          if (!form.issueCategoryId.value) { showFieldError(form, 'issueCategoryId', 'Vui lòng chọn danh mục lỗi.'); bad = true; }
          if (!form.priority.value) { showFieldError(form, 'priority', 'Vui lòng chọn mức ưu tiên.'); bad = true; }
          if (bad) return;
          runAction(form, form.querySelector('#classifyBtn'),
            () => classifyTicket(t.ticketCode, { issueCategoryId: Number(form.issueCategoryId.value), priority: form.priority.value }),
            `Đã phân loại phiếu ${t.ticketCode}`);
        });
      },
    });
    const rejectForm = box.querySelector('#rejectForm');
    rejectForm.addEventListener('submit', (e) => {
      e.preventDefault();
      clearFieldErrors(rejectForm);
      const reason = rejectForm.reason.value.trim();
      if (!reason) { showFieldError(rejectForm, 'reason', 'Vui lòng nhập lý do từ chối.'); return; }
      runAction(rejectForm, rejectForm.querySelector('#rejectBtn'), () => rejectTicket(t.ticketCode, reason), `Đã từ chối phiếu ${t.ticketCode}`);
    });
  }

  // UC03 – phân công (chỉ khi phiếu Đã phân loại, chỉ kỹ thuật viên đang hoạt động)
  function drawAssign(box, t) {
    box.innerHTML = `<section class="card" id="assignCard"><h2>Phân công kỹ thuật viên</h2><div id="assignBody"></div></section>`;
    const body = box.querySelector('#assignBody');
    loadInto(body, {
      loadingText: 'Đang tải danh sách kỹ thuật viên…',
      load: listTechnicians,
      isEmpty: (rows) => rows.length === 0,
      empty: { title: 'Không có kỹ thuật viên đang hoạt động' },
      render: (techs) => {
        body.innerHTML = `
          <form id="assignForm" novalidate>
            <label class="field"><span>Kỹ thuật viên</span>
              <select name="technicianId" id="technicianId">
                <option value="">— Chọn kỹ thuật viên —</option>
                ${techs.map((s) => `<option value="${s.id}">${h(s.fullName)} · đang giữ ${s.openTicketCount} phiếu</option>`).join('')}
              </select>
              <small class="field-error" data-error-for="technicianId"></small></label>
            <button class="btn btn-primary" type="submit" id="assignBtn">Phân công</button>
          </form>`;
        const form = body.querySelector('#assignForm');
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          clearFieldErrors(form);
          if (!form.technicianId.value) { showFieldError(form, 'technicianId', 'Vui lòng chọn kỹ thuật viên.'); return; }
          runAction(form, form.querySelector('#assignBtn'), () => assignTicket(t.ticketCode, Number(form.technicianId.value)), `Đã phân công phiếu ${t.ticketCode}`);
        });
      },
    });
  }

  // UC05 – kỹ thuật viên xác nhận nhận phiếu
  function drawAcknowledge(box, t) {
    box.innerHTML = `
      <section class="card" id="ackCard">
        <h2>Nhận phiếu</h2>
        <p>Xác nhận bạn đã nhận thiết bị và bắt đầu xử lý. Trạng thái sẽ chuyển sang <strong>Đang xử lý</strong>.</p>
        <button class="btn btn-primary" id="ackBtn">Xác nhận nhận phiếu</button>
      </section>`;
    const btn = box.querySelector('#ackBtn');
    btn.addEventListener('click', () => runAction(box, btn, () => acknowledgeTicket(t.ticketCode), `Đã nhận phiếu ${t.ticketCode}`));
  }

  reload();
}

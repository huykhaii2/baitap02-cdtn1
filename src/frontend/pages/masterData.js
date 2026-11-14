// M4 – Khách hàng & thiết bị (S1, S2 – TD-13). Nhân viên tiếp nhận: xem, thêm, sửa, xoá; Điều phối viên: chỉ xem.
// Xoá có ràng buộc: khách còn thiết bị → 409 CUSTOMER_HAS_DEVICES; thiết bị đã có phiếu → 409 DEVICE_HAS_TICKETS.
import {
  listCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer,
  createDevice, updateDevice, deleteDevice,
} from '../api/masterData.api.js';
import { loadInto } from '../components/DataState.js';
import {
  h, formatDate, toast, showAlert, setBusy, clearFieldErrors, showFieldError, twoStepButton,
} from '../components/ui.js';

export function render(root, { session, query, navigate }) {
  const canWrite = session.staff.role === 'RECEPTIONIST';
  const page = Number(query.page) || 1;
  const q = query.q || '';
  const selectedId = query.id || '';

  root.innerHTML = `
    <div class="page-head">
      <div><p class="eyebrow">M4 · S1 · S2</p><h1>Khách hàng & thiết bị</h1></div>
      ${canWrite ? '<button class="btn btn-primary" id="newCustomerBtn">+ Thêm khách hàng</button>' : '<span class="role-note">Chế độ chỉ xem</span>'}
    </div>
    <div class="alert-slot" id="mdAlert"></div>
    <div class="md-grid">
      <section class="card card-flush">
        <form class="search-bar" id="customerSearch">
          <input name="q" id="customerQ" value="${h(q)}" placeholder="Tìm theo họ tên hoặc SĐT" maxlength="50">
          <button class="btn btn-secondary" type="submit">Tìm</button>
        </form>
        <div id="customerList"></div>
      </section>
      <section class="card" id="customerPanel"></section>
    </div>`;

  const $ = (sel) => root.querySelector(sel);
  const alertSlot = $('#mdAlert');
  const go = (next) => {
    const merged = { q, page: String(page), id: selectedId, ...next };
    const qs = new URLSearchParams(Object.entries(merged).filter(([k, v]) => v && !(k === 'page' && v === '1'))).toString();
    navigate(`#/data${qs ? `?${qs}` : ''}`);
  };

  $('#customerSearch').addEventListener('submit', (e) => {
    e.preventDefault();
    go({ q: $('#customerQ').value.trim(), page: '', id: '' });
  });
  if (canWrite) $('#newCustomerBtn').addEventListener('click', () => drawCustomerForm(null));

  // ---------- danh sách khách hàng ----------
  const listEl = $('#customerList');
  loadInto(listEl, {
    loadingText: 'Đang tải khách hàng…',
    load: () => listCustomers({ q, page, pageSize: 10 }),
    isEmpty: (d) => d.items.length === 0,
    empty: { title: q ? 'Không tìm thấy khách hàng phù hợp' : 'Chưa có khách hàng', hint: canWrite ? 'Bấm “+ Thêm khách hàng” để tạo mới.' : '' },
    render: (d) => {
      listEl.innerHTML = `
        <ul class="list" id="customerItems">
          ${d.items.map((c) => `
            <li><a href="#/data?${new URLSearchParams({ ...(q ? { q } : {}), ...(page > 1 ? { page } : {}), id: c.id })}"
                   class="list-item${String(c.id) === selectedId ? ' active' : ''}">
              <span><strong>${h(c.fullName)}</strong><span class="sub">${h(c.phone)}</span></span>
              <span class="count" title="Số thiết bị">${c.deviceCount} TB</span>
            </a></li>`).join('')}
        </ul>
        <nav class="pager">
          <button class="btn btn-secondary btn-sm" id="cPrev" ${d.page <= 1 ? 'disabled' : ''}>‹</button>
          <span>Trang ${d.page} / ${d.totalPages}</span>
          <button class="btn btn-secondary btn-sm" id="cNext" ${d.page >= d.totalPages ? 'disabled' : ''}>›</button>
        </nav>`;
      $('#cPrev').addEventListener('click', () => go({ page: String(d.page - 1), id: '' }));
      $('#cNext').addEventListener('click', () => go({ page: String(d.page + 1), id: '' }));
    },
  });

  // ---------- chi tiết khách hàng ----------
  const panel = $('#customerPanel');
  const showCustomer = () => {
    if (!selectedId) {
      panel.innerHTML = `<div class="state state-empty" data-state="empty"><div class="state-icon">☰</div>
        <p class="state-title">Chọn một khách hàng ở danh sách bên trái</p></div>`;
      return;
    }
    loadInto(panel, {
      loadingText: 'Đang tải khách hàng…',
      load: () => getCustomer(selectedId),
      render: (c) => drawCustomer(c),
    });
  };

  function drawCustomer(c) {
    panel.innerHTML = `
      <div class="panel-head">
        <div><h2>${h(c.fullName)}</h2><p class="sub">${h(c.phone)} · mã KH #${c.id}</p></div>
        ${canWrite ? `<div class="btn-row">
          <button class="btn btn-secondary btn-sm" id="editCustomerBtn">Sửa</button>
          <button class="btn btn-danger btn-sm" id="deleteCustomerBtn">Xoá</button></div>` : ''}
      </div>
      <h3>Thiết bị (${c.devices.length})</h3>
      <div id="deviceArea"></div>
      <div id="deviceFormSlot"></div>`;
    const deviceArea = panel.querySelector('#deviceArea');
    if (!c.devices.length) {
      deviceArea.innerHTML = `<div class="state state-empty compact" data-state="empty"><p class="state-title">Khách hàng chưa có thiết bị</p></div>`;
    } else {
      deviceArea.innerHTML = `<div class="table-wrap"><table class="table table-responsive" id="deviceTable">
        <thead><tr><th>IMEI</th><th>Model</th><th>Hết hạn BH</th><th>Phiếu</th>${canWrite ? '<th></th>' : ''}</tr></thead>
        <tbody>${c.devices.map((d) => `<tr>
          <td data-label="IMEI" class="mono">${h(d.imei)}</td>
          <td data-label="Model">${h(d.model)}</td>
          <td data-label="Hết hạn BH">${formatDate(d.warrantyEndDate)} ${d.warrantyExpired ? '<span class="badge badge-warn">Hết hạn</span>' : ''}</td>
          <td data-label="Phiếu">${d.ticketCount}</td>
          ${canWrite ? `<td class="actions-cell"><button class="btn btn-ghost btn-sm" data-edit-device="${d.id}">Sửa</button>
            <button class="btn btn-ghost btn-sm text-danger" data-delete-device="${d.id}">Xoá</button></td>` : ''}
        </tr>`).join('')}</tbody></table></div>`;
    }
    if (!canWrite) return;
    panel.insertAdjacentHTML('beforeend', '<button class="btn btn-secondary" id="addDeviceBtn">+ Thêm thiết bị</button>');
    panel.querySelector('#addDeviceBtn').addEventListener('click', () => drawDeviceForm(c, null));
    panel.querySelector('#editCustomerBtn').addEventListener('click', () => drawCustomerForm(c));
    twoStepButton(panel.querySelector('#deleteCustomerBtn'), async () => {
      try {
        await deleteCustomer(c.id);
        toast(`Đã xoá khách hàng ${c.fullName}`);
        go({ id: '' });
      } catch (err) {
        showAlert(alertSlot, err.message);
      }
    });
    panel.querySelectorAll('[data-edit-device]').forEach((btn) =>
      btn.addEventListener('click', () => drawDeviceForm(c, c.devices.find((d) => String(d.id) === btn.dataset.editDevice))));
    panel.querySelectorAll('[data-delete-device]').forEach((btn) =>
      twoStepButton(btn, async () => {
        try {
          await deleteDevice(btn.dataset.deleteDevice);
          toast('Đã xoá thiết bị');
          go({});
        } catch (err) {
          showAlert(alertSlot, err.message);
        }
      }));
  }

  // ---------- form khách hàng (thêm / sửa) ----------
  function drawCustomerForm(c) {
    showAlert(alertSlot, '');
    panel.innerHTML = `
      <h2>${c ? 'Sửa khách hàng' : 'Thêm khách hàng'}</h2>
      <form id="customerForm" novalidate>
        <label class="field"><span>Họ tên</span><input name="fullName" id="cFullName" maxlength="100" value="${h(c ? c.fullName : '')}">
          <small class="field-error" data-error-for="fullName"></small></label>
        <label class="field"><span>Số điện thoại</span><input name="phone" id="cPhone" inputmode="tel" maxlength="15" value="${h(c ? c.phone : '')}">
          <small class="field-error" data-error-for="phone"></small></label>
        <div class="btn-row">
          <button class="btn btn-primary" type="submit" id="saveCustomerBtn">Lưu</button>
          <button class="btn btn-ghost" type="button" id="cancelCustomer">Huỷ</button>
        </div>
      </form>`;
    const form = panel.querySelector('#customerForm');
    panel.querySelector('#cancelCustomer').addEventListener('click', showCustomer);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearFieldErrors(form);
      const data = { fullName: form.fullName.value.trim(), phone: form.phone.value.trim() };
      if (!data.fullName) { showFieldError(form, 'fullName', 'Vui lòng nhập họ tên.'); return; }
      const btn = form.querySelector('#saveCustomerBtn');
      setBusy(btn, true);
      try {
        const saved = c ? await updateCustomer(c.id, data) : await createCustomer(data);
        toast(c ? 'Đã cập nhật khách hàng' : `Đã thêm khách hàng ${saved.fullName}`);
        go({ id: String(saved.id), q: c ? q : '', page: c ? String(page) : '' });
      } catch (err) {
        setBusy(btn, false);
        if (!showFieldError(form, err.details?.field, err.message)) showAlert(alertSlot, err.message);
      }
    });
    form.fullName.focus();
  }

  // ---------- form thiết bị (thêm / sửa) ----------
  function drawDeviceForm(c, d) {
    showAlert(alertSlot, '');
    const slot = panel.querySelector('#deviceFormSlot');
    slot.innerHTML = `
      <form class="subform" id="deviceForm" novalidate>
        <h3>${d ? 'Sửa thiết bị' : 'Thêm thiết bị'}</h3>
        <div class="row">
          <label class="field field-grow"><span>IMEI</span><input name="imei" id="dImei" inputmode="numeric" maxlength="15" value="${h(d ? d.imei : '')}">
            <small class="field-error" data-error-for="imei"></small></label>
          <label class="field field-grow"><span>Model</span><input name="model" id="dModel" maxlength="100" value="${h(d ? d.model : '')}">
            <small class="field-error" data-error-for="model"></small></label>
          <label class="field"><span>Hết hạn bảo hành</span><input type="date" name="warrantyEndDate" id="dWarranty" value="${h(d ? d.warrantyEndDate : '')}">
            <small class="field-error" data-error-for="warrantyEndDate"></small></label>
        </div>
        <div class="btn-row">
          <button class="btn btn-primary" type="submit" id="saveDeviceBtn">Lưu thiết bị</button>
          <button class="btn btn-ghost" type="button" id="cancelDevice">Huỷ</button>
        </div>
      </form>`;
    const form = slot.querySelector('#deviceForm');
    slot.querySelector('#cancelDevice').addEventListener('click', () => { slot.innerHTML = ''; });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearFieldErrors(form);
      const data = { imei: form.imei.value.trim(), model: form.model.value.trim(), warrantyEndDate: form.warrantyEndDate.value };
      const btn = form.querySelector('#saveDeviceBtn');
      setBusy(btn, true);
      try {
        if (d) await updateDevice(d.id, data);
        else await createDevice({ ...data, customerId: c.id });
        toast(d ? 'Đã cập nhật thiết bị' : 'Đã thêm thiết bị');
        go({});
      } catch (err) {
        setBusy(btn, false);
        if (!showFieldError(form, err.details?.field, err.message)) showAlert(alertSlot, err.message);
      }
    });
    form.imei.focus();
  }

  showCustomer();
}

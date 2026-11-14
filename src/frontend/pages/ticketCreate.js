// M1 – Tạo phiếu bảo hành (UC01, include UC07). Mỗi luồng ngoại lệ có chỗ hiển thị riêng, ghi mã bước trong ngoặc.
import { createTicket } from '../api/ticket.api.js';
import { findCustomerByPhone, createCustomer, findDeviceByImei } from '../api/masterData.api.js';
import { h, formatDate, toast, clearFieldErrors, showFieldError, showAlert, setBusy } from '../components/ui.js';

const FIELD_ALIAS = { 'device.model': 'model', 'device.warrantyEndDate': 'warrantyEndDate', 'customer.fullName': 'fullName' };

export function render(root, { navigate }) {
  const state = { customer: null, device: null, deviceMode: 'unknown' }; // unknown | existing | new | blocked

  root.innerHTML = `
    <div class="page-head">
      <div><p class="eyebrow">M1 · UC01</p><h1>Tạo phiếu bảo hành</h1></div>
      <a class="btn btn-ghost" href="#/tickets">← Danh sách phiếu</a>
    </div>
    <div class="alert-slot" id="formAlert"></div>
    <form id="ticketForm" class="steps" novalidate>
      <section class="card step" id="stepCustomer">
        <h2><span class="step-no">1</span> Khách hàng</h2>
        <div class="row">
          <label class="field field-grow"><span>Số điện thoại khách hàng</span>
            <input name="phone" id="phone" inputmode="tel" placeholder="VD: 0901234567" maxlength="15" autocomplete="off" autofocus>
            <small class="field-error" data-error-for="phone"></small></label>
          <button type="button" class="btn btn-secondary align-end" id="lookupCustomerBtn">Tra cứu</button>
        </div>
        <div id="customerResult" aria-live="polite"></div>
      </section>

      <section class="card step is-locked" id="stepDevice">
        <h2><span class="step-no">2</span> Thiết bị</h2>
        <div class="row">
          <label class="field field-grow"><span>IMEI (15 chữ số)</span>
            <input name="imei" id="imei" inputmode="numeric" placeholder="VD: 356789012345678" maxlength="15" autocomplete="off" disabled>
            <small class="field-error" data-error-for="imei"></small></label>
          <button type="button" class="btn btn-secondary align-end" id="lookupDeviceBtn" disabled>Kiểm tra</button>
        </div>
        <div id="deviceResult" aria-live="polite"></div>
      </section>

      <section class="card step is-locked" id="stepIssue">
        <h2><span class="step-no">3</span> Mô tả lỗi</h2>
        <label class="field"><span>Khách mô tả lỗi như thế nào?</span>
          <textarea name="issueDescription" id="issueDescription" rows="4" maxlength="2000" placeholder="VD: Máy tắt nguồn khi còn 30% pin, đã thử khởi động lại không được" disabled></textarea>
          <small class="field-hint"><span id="descCount">0</span>/2000</small>
          <small class="field-error" data-error-for="issueDescription"></small></label>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary" id="saveTicketBtn" disabled>Lưu phiếu</button>
        </div>
      </section>
    </form>`;

  const $ = (sel) => root.querySelector(sel);
  const form = $('#ticketForm');
  const formAlert = $('#formAlert');
  const customerResult = $('#customerResult');
  const deviceResult = $('#deviceResult');

  function refresh() {
    const deviceReady = Boolean(state.customer);
    $('#stepDevice').classList.toggle('is-locked', !deviceReady);
    $('#imei').disabled = !deviceReady;
    $('#lookupDeviceBtn').disabled = !deviceReady;
    const issueReady = deviceReady && (state.deviceMode === 'existing' || state.deviceMode === 'new');
    $('#stepIssue').classList.toggle('is-locked', !issueReady);
    $('#issueDescription').disabled = !issueReady;
    $('#saveTicketBtn').disabled = !issueReady;
  }

  function resetDevice() {
    state.device = null;
    state.deviceMode = 'unknown';
    deviceResult.innerHTML = '';
    refresh();
  }

  function showCustomer(customer) {
    state.customer = customer;
    const devices = customer.devices || [];
    customerResult.innerHTML = `
      <div class="result result-ok" id="customerFound">
        <div><strong>${h(customer.fullName)}</strong> · ${h(customer.phone)}</div>
        ${devices.length ? `<div class="chips"><span class="muted">Thiết bị đã đăng ký:</span>
          ${devices.map((d) => `<button type="button" class="chip" data-imei="${h(d.imei)}">${h(d.model)} · ${h(d.imei)}</button>`).join('')}</div>` : ''}
      </div>`;
    customerResult.querySelectorAll('[data-imei]').forEach((btn) =>
      btn.addEventListener('click', () => { $('#imei').value = btn.dataset.imei; lookupDevice(); }));
    refresh();
    $('#imei').focus();
  }

  // UC01 bước 2–3, ngoại lệ 2a, 3a
  async function lookupCustomer() {
    clearFieldErrors($('#stepCustomer'));
    showAlert(formAlert, '');
    state.customer = null;
    resetDevice();
    const phone = $('#phone').value.replace(/[\s.\-]/g, '');
    if (!/^(0\d{9}|\+84\d{9})$/.test(phone)) {
      showFieldError(root, 'phone', 'Số điện thoại không hợp lệ (2a).');
      customerResult.innerHTML = '';
      return;
    }
    const btn = $('#lookupCustomerBtn');
    setBusy(btn, true, 'Đang tra…');
    try {
      showCustomer(await findCustomerByPhone(phone));
    } catch (err) {
      if (err.code === 'CUSTOMER_NOT_FOUND') {
        customerResult.innerHTML = `
          <div class="result result-warn" id="customerNotFound">
            <p>Chưa có khách hàng với số điện thoại này (3a).</p>
            <button type="button" class="btn btn-secondary btn-sm" id="showNewCustomer">Tạo khách hàng mới</button>
            <div class="row hidden" id="newCustomerRow">
              <label class="field field-grow"><span>Họ tên khách hàng</span>
                <input name="fullName" id="fullName" maxlength="100" autocomplete="off">
                <small class="field-error" data-error-for="fullName"></small></label>
              <button type="button" class="btn btn-primary align-end" id="confirmNewCustomer">Xác nhận</button>
            </div>
          </div>`;
        $('#showNewCustomer').addEventListener('click', () => {
          $('#newCustomerRow').classList.remove('hidden');
          $('#showNewCustomer').classList.add('hidden');
          $('#fullName').focus();
        });
        $('#confirmNewCustomer').addEventListener('click', confirmNewCustomer);
      } else if (err.details && err.details.field === 'phone') {
        showFieldError(root, 'phone', `${err.message} (2a)`);
        customerResult.innerHTML = '';
      } else {
        customerResult.innerHTML = '';
        showAlert(formAlert, err.message);
      }
    } finally {
      setBusy(btn, false);
    }
  }

  async function confirmNewCustomer() {
    const fullName = $('#fullName').value.trim();
    if (!fullName) {
      showFieldError(root, 'fullName', 'Vui lòng nhập họ tên khách hàng.');
      return;
    }
    const btn = $('#confirmNewCustomer');
    setBusy(btn, true);
    try {
      const customer = await createCustomer({ fullName, phone: $('#phone').value });
      toast(`Đã tạo khách hàng ${customer.fullName}`);
      showCustomer({ ...customer, devices: [] });
    } catch (err) {
      if (!showFieldError(root, FIELD_ALIAS[err.details?.field] || err.details?.field, err.message)) showAlert(formAlert, err.message);
      setBusy(btn, false);
    }
  }

  // UC01 bước 4–5, ngoại lệ 4a, 5a, 5b, 5c
  async function lookupDevice() {
    clearFieldErrors($('#stepDevice'));
    showAlert(formAlert, '');
    resetDevice();
    const imei = $('#imei').value.replace(/\s/g, '');
    if (!/^\d{15}$/.test(imei)) {
      showFieldError(root, 'imei', 'IMEI phải gồm 15 chữ số (4a).');
      return;
    }
    const btn = $('#lookupDeviceBtn');
    setBusy(btn, true, 'Đang kiểm tra…');
    try {
      const device = await findDeviceByImei(imei);
      state.device = device;
      if (device.customerId !== state.customer.id) {
        state.deviceMode = 'blocked';
        deviceResult.innerHTML = `<div class="result result-error" id="deviceOtherOwner">IMEI này đã đăng ký cho một khách hàng khác (BR1). Kiểm tra lại IMEI hoặc số điện thoại.</div>`;
      } else if (device.openTicket) {
        state.deviceMode = 'blocked';
        deviceResult.innerHTML = `<div class="result result-error" id="deviceOpenTicket">
          Thiết bị đang có phiếu <a href="#/tickets/${h(device.openTicket.ticketCode)}">${h(device.openTicket.ticketCode)}</a> chưa đóng (5b – BR2). Không tạo được phiếu mới.</div>`;
      } else {
        state.deviceMode = 'existing';
        deviceResult.innerHTML = `<div class="result result-ok" id="deviceFound">
          <div><strong>${h(device.model)}</strong> · hết hạn bảo hành ${formatDate(device.warrantyEndDate)}</div>
          ${device.warrantyExpired ? '<p class="badge badge-warn" id="warrantyExpiredBadge">Hết hạn bảo hành (5c – BR3): vẫn tạo được phiếu, Điều phối viên sẽ quyết định.</p>' : ''}
        </div>`;
      }
    } catch (err) {
      if (err.code === 'DEVICE_NOT_FOUND') {
        state.deviceMode = 'new';
        deviceResult.innerHTML = `
          <div class="result result-warn" id="deviceNew">
            <p>IMEI chưa có trong hệ thống (5a) – nhập thêm thông tin thiết bị, thiết bị sẽ được tạo cùng phiếu.</p>
            <div class="row">
              <label class="field field-grow"><span>Model</span><input name="model" id="model" maxlength="100" placeholder="VD: Samsung Galaxy A55">
                <small class="field-error" data-error-for="model"></small></label>
              <label class="field"><span>Ngày hết hạn bảo hành</span><input type="date" name="warrantyEndDate" id="warrantyEndDate">
                <small class="field-error" data-error-for="warrantyEndDate"></small></label>
            </div>
          </div>`;
      } else if (err.details && err.details.field === 'imei') {
        showFieldError(root, 'imei', `${err.message} (4a)`);
      } else {
        showAlert(formAlert, err.message);
      }
    } finally {
      setBusy(btn, false);
      refresh();
    }
  }

  // UC01 bước 6–8, ngoại lệ 7a
  async function save(event) {
    event.preventDefault();
    clearFieldErrors(root);
    showAlert(formAlert, '');
    const issueDescription = $('#issueDescription').value.trim();
    let invalid = false;
    if (!issueDescription) {
      showFieldError(root, 'issueDescription', 'Vui lòng nhập mô tả lỗi (7a).');
      invalid = true;
    }
    const body = { phone: state.customer.phone, imei: $('#imei').value.replace(/\s/g, ''), issueDescription };
    if (state.deviceMode === 'new') {
      body.device = { model: $('#model').value.trim(), warrantyEndDate: $('#warrantyEndDate').value };
      if (!body.device.model) { showFieldError(root, 'model', 'Vui lòng nhập model thiết bị.'); invalid = true; }
      if (!body.device.warrantyEndDate) { showFieldError(root, 'warrantyEndDate', 'Vui lòng chọn ngày hết hạn bảo hành.'); invalid = true; }
    }
    if (invalid) return;
    const btn = $('#saveTicketBtn');
    setBusy(btn, true);
    try {
      const ticket = await createTicket(body);
      toast(`Đã tạo phiếu ${ticket.ticketCode}`);
      navigate(`#/tickets/${ticket.ticketCode}`);
    } catch (err) {
      setBusy(btn, false);
      const field = FIELD_ALIAS[err.details?.field] || err.details?.field;
      if (field && showFieldError(root, field, err.message)) return;
      const link = err.details?.ticketCode ? ` <a href="#/tickets/${h(err.details.ticketCode)}">Mở phiếu ${h(err.details.ticketCode)}</a>` : '';
      showAlert(formAlert, err.message, 'error', link);
    }
  }

  $('#lookupCustomerBtn').addEventListener('click', lookupCustomer);
  $('#phone').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); lookupCustomer(); } });
  $('#phone').addEventListener('input', () => { if (state.customer) { state.customer = null; customerResult.innerHTML = ''; resetDevice(); } });
  $('#lookupDeviceBtn').addEventListener('click', lookupDevice);
  $('#imei').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); lookupDevice(); } });
  $('#imei').addEventListener('input', () => { if (state.deviceMode !== 'unknown') resetDevice(); });
  $('#issueDescription').addEventListener('input', (e) => { $('#descCount').textContent = e.target.value.length; });
  form.addEventListener('submit', save);
}

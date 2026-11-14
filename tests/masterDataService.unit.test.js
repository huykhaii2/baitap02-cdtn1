// Unit test MasterDataService – CRUD khách hàng (S1), thiết bị (S2), tra cứu C1/D1, ràng buộc xoá (TD-13).
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createMasterDataService } = require('../src/backend/services/masterDataService');
const { makeFakes, ACTORS } = require('./helpers/fakes');
const { rejectsWith } = require('./helpers/assertions');

let f;
let svc;
beforeEach(() => {
  f = makeFakes();
  svc = createMasterDataService(f);
});

describe('Khách hàng (S1, C1, C2)', () => {
  it('thêm khách hàng: chuẩn hoá SĐT "0912.345.678" → "0912345678"', async () => {
    const c = await svc.createCustomer(ACTORS.receptionist, { fullName: ' Trần Thị Mai ', phone: '0912.345.678' });
    assert.deepEqual([c.fullName, c.phone], ['Trần Thị Mai', '0912345678']);
  });

  it('SĐT đã có → PHONE_EXISTS; họ tên trống → FULL_NAME_REQUIRED', async () => {
    await rejectsWith(svc.createCustomer(ACTORS.receptionist, { fullName: 'A', phone: '0901234567' }), 'CONFLICT', 'PHONE_EXISTS');
    await rejectsWith(svc.createCustomer(ACTORS.receptionist, { fullName: ' ', phone: '0911111111' }), 'INVALID_INPUT', 'FULL_NAME_REQUIRED');
  });

  it('C1: tra cứu theo SĐT trả kèm danh sách thiết bị; không có → CUSTOMER_NOT_FOUND', async () => {
    const c = await svc.findCustomerByPhone(ACTORS.receptionist, '0901 234 567');
    assert.equal(c.devices.length, 2);
    await rejectsWith(svc.findCustomerByPhone(ACTORS.receptionist, '0999999999'), 'NOT_FOUND', 'CUSTOMER_NOT_FOUND');
  });

  it('Điều phối viên được xem nhưng không được thêm / sửa / xoá; Kỹ thuật viên không xem được', async () => {
    await svc.listCustomers(ACTORS.coordinator, {});
    await rejectsWith(svc.createCustomer(ACTORS.coordinator, { fullName: 'A', phone: '0911111111' }), 'NOT_ALLOWED');
    await rejectsWith(svc.updateCustomer(ACTORS.coordinator, 1, { fullName: 'A', phone: '0901234567' }), 'NOT_ALLOWED');
    await rejectsWith(svc.deleteCustomer(ACTORS.coordinator, 1), 'NOT_ALLOWED');
    await rejectsWith(svc.listCustomers(ACTORS.tech1, {}), 'NOT_ALLOWED');
  });

  it('xoá khách còn thiết bị → CUSTOMER_HAS_DEVICES; khách không còn thiết bị → xoá được', async () => {
    await rejectsWith(svc.deleteCustomer(ACTORS.receptionist, 1), 'CONFLICT', 'CUSTOMER_HAS_DEVICES');
    const c = await svc.createCustomer(ACTORS.receptionist, { fullName: 'Khách tạm', phone: '0911111111' });
    await svc.deleteCustomer(ACTORS.receptionist, c.id);
    assert.equal(f.store.customers.some((x) => x.id === c.id), false);
  });

  it('sửa / xoá khách không tồn tại → CUSTOMER_NOT_FOUND; id không phải số → INVALID_ID', async () => {
    await rejectsWith(svc.updateCustomer(ACTORS.receptionist, 999, { fullName: 'A', phone: '0911111111' }), 'NOT_FOUND', 'CUSTOMER_NOT_FOUND');
    await rejectsWith(svc.deleteCustomer(ACTORS.receptionist, 999), 'NOT_FOUND', 'CUSTOMER_NOT_FOUND');
    await rejectsWith(svc.getCustomer(ACTORS.receptionist, 'abc'), 'INVALID_INPUT', 'INVALID_ID');
  });
});

describe('Thiết bị (S2, D1)', () => {
  const dev = { customerId: 1, imei: '352222333344445', model: 'Xiaomi 13', warrantyEndDate: '2027-06-30' };

  it('thêm thiết bị hợp lệ; IMEI trùng → IMEI_EXISTS; ngày 2027-02-30 → INVALID_WARRANTY_END_DATE', async () => {
    const d = await svc.createDevice(ACTORS.receptionist, dev);
    assert.equal(d.imei, dev.imei);
    await rejectsWith(svc.createDevice(ACTORS.receptionist, dev), 'CONFLICT', 'IMEI_EXISTS');
    await rejectsWith(svc.createDevice(ACTORS.receptionist, { ...dev, imei: '352222333344446', warrantyEndDate: '2027-02-30' }), 'INVALID_INPUT', 'INVALID_WARRANTY_END_DATE');
  });

  it('D1: tra cứu IMEI trả về phiếu chưa đóng để giao diện khoá nút Lưu (BR2)', async () => {
    const t = f.addTicket({ deviceId: 1, status: 'NEW' });
    const d = await svc.findDeviceByImei(ACTORS.receptionist, '356789012345678');
    assert.equal(d.openTicket.ticketCode, t.ticketCode);
    assert.equal(d.customer.phone, '0901234567');
  });

  it('thiết bị đã có phiếu: không xoá được (BR6), không đổi được IMEI', async () => {
    f.addTicket({ deviceId: 1, status: 'REJECTED' });
    await rejectsWith(svc.deleteDevice(ACTORS.receptionist, 1), 'CONFLICT', 'DEVICE_HAS_TICKETS');
    await rejectsWith(
      svc.updateDevice(ACTORS.receptionist, 1, { imei: '351111111111111', model: 'X', warrantyEndDate: '2027-01-01' }),
      'CONFLICT',
      'DEVICE_HAS_TICKETS'
    );
    const same = await svc.updateDevice(ACTORS.receptionist, 1, { imei: '356789012345678', model: 'Samsung Galaxy A55 5G', warrantyEndDate: '2027-03-10' });
    assert.equal(same.model, 'Samsung Galaxy A55 5G');
  });

  it('thiết bị chưa có phiếu xoá được', async () => {
    await svc.deleteDevice(ACTORS.receptionist, 2);
    assert.equal(f.store.devices.some((d) => d.id === 2), false);
  });
});

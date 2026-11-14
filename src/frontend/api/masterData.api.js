// Khách hàng và thiết bị: C1, C2, D1, S1, S2 (docs/api-contract.md).
import { http } from './client.js';

const enc = encodeURIComponent;

export const findCustomerByPhone = (phone) => http.get(`/customers/by-phone/${enc(phone)}`); // C1
export const createCustomer = (data) => http.post('/customers', data); // C2
export const listCustomers = (query) => http.get('/customers', query); // S1
export const getCustomer = (id) => http.get(`/customers/${enc(id)}`); // S1
export const updateCustomer = (id, data) => http.put(`/customers/${enc(id)}`, data); // S1
export const deleteCustomer = (id) => http.del(`/customers/${enc(id)}`); // S1

export const findDeviceByImei = (imei) => http.get(`/devices/by-imei/${enc(imei)}`); // D1
export const listDevices = (customerId) => http.get('/devices', { customerId }); // S2
export const createDevice = (data) => http.post('/devices', data); // S2
export const updateDevice = (id, data) => http.put(`/devices/${enc(id)}`, data); // S2
export const deleteDevice = (id) => http.del(`/devices/${enc(id)}`); // S2

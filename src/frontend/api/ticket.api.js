// Phiếu bảo hành T1–T8 và danh mục L1, L2 – mỗi hàm ánh xạ đúng một endpoint (docs/api-contract.md).
import { http } from './client.js';

const enc = encodeURIComponent;

export const createTicket = (data) => http.post('/tickets', data); // T1
export const listTickets = (filters) => http.get('/tickets', filters); // T2
export const getTicket = (code) => http.get(`/tickets/${enc(code)}`); // T3
export const classifyTicket = (code, data) => http.post(`/tickets/${enc(code)}/classify`, data); // T4
export const rejectTicket = (code, reason) => http.post(`/tickets/${enc(code)}/reject`, { reason }); // T5
export const assignTicket = (code, technicianId) => http.post(`/tickets/${enc(code)}/assign`, { technicianId }); // T6
export const acknowledgeTicket = (code) => http.post(`/tickets/${enc(code)}/acknowledge`); // T7
export const getTicketHistory = (code) => http.get(`/tickets/${enc(code)}/history`); // T8
export const listIssueCategories = () => http.get('/issue-categories'); // L1
export const listTechnicians = () => http.get('/technicians'); // L2

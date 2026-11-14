// CustomerController – khách hàng và thiết bị: C1, C2, D1, S1, S2 (docs/api-contract.md).
// Chỉ đọc request, gọi service, trả JSON. Không truy vấn CSDL (tiêu chí C2).
const express = require('express');
const { asyncHandler } = require('../middlewares/asyncHandler');

function createCustomerController({ masterDataService: svc }) {
  const r = express.Router();
  const h = asyncHandler;

  // C1 – tra cứu khách hàng theo SĐT (UC07)
  r.get('/customers/by-phone/:phone', h(async (req, res) => res.json(await svc.findCustomerByPhone(req.actor, req.params.phone))));
  // S1 – CRUD khách hàng (C2 là thao tác tạo)
  r.get('/customers', h(async (req, res) => res.json(await svc.listCustomers(req.actor, req.query))));
  r.get('/customers/:id', h(async (req, res) => res.json(await svc.getCustomer(req.actor, req.params.id))));
  r.post('/customers', h(async (req, res) => res.status(201).json(await svc.createCustomer(req.actor, req.body))));
  r.put('/customers/:id', h(async (req, res) => res.json(await svc.updateCustomer(req.actor, req.params.id, req.body))));
  r.delete('/customers/:id', h(async (req, res) => {
    await svc.deleteCustomer(req.actor, req.params.id);
    res.status(204).end();
  }));

  // D1 – tra cứu thiết bị theo IMEI
  r.get('/devices/by-imei/:imei', h(async (req, res) => res.json(await svc.findDeviceByImei(req.actor, req.params.imei))));
  // S2 – CRUD thiết bị
  r.get('/devices', h(async (req, res) => res.json(await svc.listDevices(req.actor, req.query))));
  r.get('/devices/:id', h(async (req, res) => res.json(await svc.getDevice(req.actor, req.params.id))));
  r.post('/devices', h(async (req, res) => res.status(201).json(await svc.createDevice(req.actor, req.body))));
  r.put('/devices/:id', h(async (req, res) => res.json(await svc.updateDevice(req.actor, req.params.id, req.body))));
  r.delete('/devices/:id', h(async (req, res) => {
    await svc.deleteDevice(req.actor, req.params.id);
    res.status(204).end();
  }));

  return r;
}

module.exports = { createCustomerController };

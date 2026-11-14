// TicketController – phiếu bảo hành T1–T8 và danh mục L1, L2 (docs/api-contract.md).
// Không có PUT/DELETE phiếu: BR6 – phiếu không bao giờ bị sửa nội dung tiếp nhận hay bị xoá.
const express = require('express');
const { asyncHandler } = require('../middlewares/asyncHandler');

function createTicketController({ ticketService, classifyService, assignService }) {
  const r = express.Router();
  const h = asyncHandler;

  r.post('/tickets', h(async (req, res) => res.status(201).json(await ticketService.create(req.actor, req.body)))); // T1
  r.get('/tickets', h(async (req, res) => res.json(await ticketService.list(req.actor, req.query)))); // T2
  r.get('/tickets/:code', h(async (req, res) => res.json(await ticketService.getDetail(req.actor, req.params.code)))); // T3
  r.post('/tickets/:code/classify', h(async (req, res) => res.json(await classifyService.classify(req.actor, req.params.code, req.body)))); // T4
  r.post('/tickets/:code/reject', h(async (req, res) => res.json(await classifyService.reject(req.actor, req.params.code, req.body)))); // T5
  r.post('/tickets/:code/assign', h(async (req, res) => res.json(await assignService.assign(req.actor, req.params.code, req.body)))); // T6
  r.post('/tickets/:code/acknowledge', h(async (req, res) => res.json(await assignService.acknowledge(req.actor, req.params.code)))); // T7
  r.get('/tickets/:code/history', h(async (req, res) => res.json(await ticketService.getHistory(req.actor, req.params.code)))); // T8

  r.get('/issue-categories', h(async (req, res) => res.json(await classifyService.listCategories(req.actor)))); // L1
  r.get('/technicians', h(async (req, res) => res.json(await assignService.listTechnicians(req.actor)))); // L2
  return r;
}

module.exports = { createTicketController };

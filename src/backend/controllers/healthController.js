// GET /api/health – 200 khi CSDL kết nối được, 503 DB_UNAVAILABLE khi mất kết nối.
const express = require('express');
const { asyncHandler } = require('../middlewares/asyncHandler');

function createHealthController({ healthService }) {
  const router = express.Router();
  router.get('/health', asyncHandler(async (req, res) => {
    res.json(await healthService.check());
  }));
  return router;
}

module.exports = { createHealthController };

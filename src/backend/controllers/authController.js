// AuthController – A1 POST /api/auth/login.
const express = require('express');
const { asyncHandler } = require('../middlewares/asyncHandler');

function createAuthController({ authService }) {
  const router = express.Router();
  router.post('/auth/login', asyncHandler(async (req, res) => {
    res.json(await authService.login(req.body));
  }));
  return router;
}

module.exports = { createAuthController };

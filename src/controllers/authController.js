const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const asyncHandler = require('../utils/asyncHandler');
const { issueToken, clearToken } = require('../middleware/auth');

const login = asyncHandler(async (req, res) => {
  const email = req.body.email.toLowerCase();
  const admin = await Admin.findOne({ email }).select('+passwordHash');
  const valid = admin && await bcrypt.compare(req.body.password, admin.passwordHash);
  if (!valid) return res.status(401).json({ success: false, message: 'Email or password is incorrect' });
  issueToken(admin, res);
  res.json({ success: true, data: { admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } } });
});

const logout = asyncHandler(async (req, res) => {
  clearToken(res);
  res.json({ success: true, message: 'Signed out' });
});

const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { admin: { id: req.admin.id, name: req.admin.name, email: req.admin.email, role: req.admin.role } } });
});

module.exports = { login, logout, me };

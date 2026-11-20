const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const Admin = require('../models/Admin');
const { jwtLifetimeSeconds } = require('../config/security');

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === 'true',
  sameSite: 'lax',
  // The same session protects doctors, patients, and dashboard routes too.
  path: '/api/v1',
  maxAge: jwtLifetimeSeconds(process.env.JWT_EXPIRES_IN || '1d') * 1000,
});

const requireAuth = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.doctor_tracker_token || req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ success: false, message: 'Authentication required' });
  let payload;
  try { payload = jwt.verify(token, process.env.JWT_SECRET); }
  catch { return res.status(401).json({ success: false, message: 'Session is invalid or expired' }); }
  const admin = await Admin.findById(payload.sub).select('name email role');
  if (!admin) return res.status(401).json({ success: false, message: 'Account is unavailable' });
  req.admin = admin;
  next();
});

function issueToken(admin, res) {
  const token = jwt.sign({ sub: admin.id, role: admin.role }, process.env.JWT_SECRET, { expiresIn: jwtLifetimeSeconds(process.env.JWT_EXPIRES_IN || '1d') });
  res.cookie('doctor_tracker_token', token, cookieOptions());
}

function clearToken(res) {
  const { maxAge: _maxAge, ...options } = cookieOptions();
  res.clearCookie('doctor_tracker_token', options);
}

module.exports = { requireAuth, issueToken, clearToken };

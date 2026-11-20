const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function trustedOrigins() {
  return (process.env.CLIENT_ORIGIN || 'http://localhost:3000')
    .split(',').map((origin) => origin.trim()).filter(Boolean);
}

function protectCookieWrites(req, res, next) {
  if (SAFE_METHODS.has(req.method) || !req.cookies?.doctor_tracker_token) return next();
  const origin = req.get('origin');
  if (!origin || !trustedOrigins().includes(origin)) {
    return res.status(403).json({ success: false, message: 'Request origin is not allowed' });
  }
  next();
}

module.exports = { protectCookieWrites };

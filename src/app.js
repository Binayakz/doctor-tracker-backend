const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('./middleware/auth');
const { protectCookieWrites } = require('./middleware/csrf');

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) {
  const proxySetting = process.env.TRUST_PROXY.trim();
  app.set('trust proxy', /^\d+$/.test(proxySetting)
    ? Number(proxySetting)
    : proxySetting.split(',').map((value) => value.trim()));
}
app.use(helmet());
app.use(compression());
app.use(cors({ origin: (process.env.CLIENT_ORIGIN || 'http://localhost:3000').split(',').map((origin) => origin.trim()), credentials: true }));
app.use(express.json({ limit: '20kb' }));
app.use(cookieParser());
app.use('/api/v1', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use('/api/v1', protectCookieWrites);

app.get('/health', (_req, res) => res.json({ success: true, status: 'ok' }));
app.use('/api/v1/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false }));
app.use('/api/v1/auth', require('./routes/authRoutes'));
app.use('/api/v1/doctors', requireAuth, require('./routes/doctorRoutes'));
app.use('/api/v1/patients', requireAuth, require('./routes/patientRoutes'));
app.use('/api/v1/dashboard', requireAuth, require('./routes/dashboardRoutes'));
app.use((_req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

app.use((err, _req, res, _next) => {
  if (err.status === 413 || err.type === 'entity.too.large') return res.status(413).json({ success: false, message: 'Request body is too large' });
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) return res.status(400).json({ success: false, message: 'Malformed JSON request body' });
  if (err.code === 11000) return res.status(409).json({ success: false, message: 'A record with that email already exists' });
  if (err.name === 'ValidationError') return res.status(400).json({ success: false, message: err.message });
  if (err.name === 'CastError') return res.status(400).json({ success: false, message: 'Invalid identifier or value' });
  console.error(err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

module.exports = app;

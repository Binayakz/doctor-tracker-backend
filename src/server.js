require('dotenv').config();
const bcrypt = require('bcryptjs');
const app = require('./app');
const { connectDatabase } = require('./config/db');
const mongoose = require('mongoose');
const Admin = require('./models/Admin');
const Doctor = require('./models/Doctor');
const Patient = require('./models/Patient');
const { validateSecurityConfig } = require('./config/security');

async function bootstrapAdmin() {
  if (process.env.SEED_ADMIN !== 'true') return;
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 12 || password.startsWith('replace-')) {
    throw new Error('Set ADMIN_EMAIL and a strong ADMIN_PASSWORD (12+ characters) before enabling SEED_ADMIN');
  }
  if (await Admin.exists({ email })) return;
  const passwordHash = await bcrypt.hash(password, 12);
  await Admin.create({ name: process.env.ADMIN_NAME || 'Administrator', email, passwordHash });
  console.log(`Initial administrator created for ${email}`);
}

async function start() {
  validateSecurityConfig();
  await connectDatabase();
  const createIndexesAtStartup = process.env.AUTO_CREATE_INDEXES === 'true'
    || (process.env.AUTO_CREATE_INDEXES !== 'false' && process.env.NODE_ENV !== 'production');
  if (createIndexesAtStartup) {
    await Promise.all([Admin.createIndexes(), Doctor.createIndexes(), Patient.createIndexes()]);
  }
  await bootstrapAdmin();
  const port = Number(process.env.PORT) || 4000;
  const server = app.listen(port, () => console.log(`Doctor Tracker API listening on port ${port}`));
  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received; closing API`);
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
    const forceExit = setTimeout(() => {
      server.closeAllConnections?.();
      process.exit(1);
    }, 10000);
    forceExit.unref();
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
  return server;
}

start().catch((error) => { console.error('API startup failed:', error.message); process.exit(1); });

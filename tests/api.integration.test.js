const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');

const testMongoUri = process.env.TEST_MONGODB_URI;

test('REST API auth, validation, records, filtering, analytics, and logout', {
  skip: !testMongoUri ? 'Set TEST_MONGODB_URI to an isolated database ending in _test' : false,
}, async () => {
  const databaseName = new URL(testMongoUri).pathname.replace(/^\//, '').split('?')[0];
  assert.match(databaseName, /_test$/, 'TEST_MONGODB_URI must target a database ending in _test');

  process.env.JWT_SECRET = 'integration-test-secret-with-more-than-32-bytes';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.CLIENT_ORIGIN = 'http://localhost:3000';
  process.env.COOKIE_SECURE = 'true';
  process.env.COOKIE_SAME_SITE = 'none';

  const mongoose = require('mongoose');
  const bcrypt = require('bcryptjs');
  const Admin = require('../src/models/Admin');
  const Doctor = require('../src/models/Doctor');
  const Patient = require('../src/models/Patient');
  const app = require('../src/app');
  const unique = crypto.randomUUID();
  const email = `api-test-${unique}@example.test`;
  let doctorId;
  let patientId;
  let adminId;
  const server = http.createServer(app);

  await mongoose.connect(testMongoUri, { serverSelectionTimeoutMS: 5000 });
  await Promise.all([Admin.createIndexes(), Doctor.createIndexes(), Patient.createIndexes()]);
  const admin = await Admin.create({ name: 'API Test Admin', email, passwordHash: await bcrypt.hash('Test-Password-1234', 4) });
  adminId = admin._id;
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, { method = 'GET', body, cookie, origin } = {}) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(cookie ? { cookie } : {}),
        ...(origin ? { origin } : {}),
      },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    const raw = await response.text();
    let json;
    try { json = JSON.parse(raw); } catch { json = null; }
    return { response, json };
  };

  try {
    let result = await call('/api/v1/doctors');
    assert.equal(result.response.status, 401);

    result = await call('/api/v1/auth/login', { method: 'POST', body: { email, password: 'Test-Password-1234' } });
    assert.equal(result.response.status, 200);
    assert.match(result.response.headers.get('set-cookie'), /HttpOnly/);
    assert.match(result.response.headers.get('set-cookie'), /SameSite=None/);
    assert.match(result.response.headers.get('set-cookie'), /Secure/);
    assert.match(result.response.headers.get('set-cookie'), /Path=\/api\/v1/);
    const cookie = result.response.headers.get('set-cookie').split(';')[0];

    result = await call('/api/v1/doctors', { method: 'POST', cookie, origin: 'https://untrusted.example', body: { name: 'Blocked Doctor' } });
    assert.equal(result.response.status, 403);

    const doctor = { name: `QA ${unique}`, specialization: 'Cardiology', hospital: 'Test Hospital', phone: '+10000000001', email: `doctor-${unique}@example.test` };
    result = await call('/api/v1/doctors', { method: 'POST', cookie, origin: process.env.CLIENT_ORIGIN, body: doctor });
    assert.equal(result.response.status, 201);
    doctorId = result.json.data.doctor._id;

    result = await call(`/api/v1/doctors?search=${encodeURIComponent(unique)}&specialization=Cardiology&limit=1`, { cookie });
    assert.equal(result.response.status, 200);
    assert.equal(result.json.pagination.total, 1);
    assert.equal(result.json.data.doctors[0].patientCount, 0);
    assert.equal(result.response.headers.get('cache-control'), 'no-store');

    result = await call('/api/v1/doctors/filters', { cookie });
    assert.equal(result.response.status, 200);
    assert.ok(Array.isArray(result.json.data.specializations));

    result = await call('/api/v1/doctors?page=1&limit=101', { cookie });
    assert.equal(result.response.status, 400);
    result = await call('/api/v1/doctors?from=2026-02-30', { cookie });
    assert.equal(result.response.status, 400);
    result = await call('/api/v1/doctors?from=2026-02-20&to=2026-02-01', { cookie });
    assert.equal(result.response.status, 400);

    result = await call(`/api/v1/doctors/${doctorId}/patients`, { method: 'POST', cookie, origin: process.env.CLIENT_ORIGIN, body: { name: `Patient ${unique}`, age: 37, gender: 'female', condition: 'Migraine' } });
    assert.equal(result.response.status, 201);
    patientId = result.json.data.patient._id;

    result = await call(`/api/v1/doctors?search=${encodeURIComponent(unique)}&limit=1`, { cookie });
    assert.equal(result.json.data.doctors[0].patientCount, 1);

    result = await call(`/api/v1/patients?search=${encodeURIComponent(unique)}&condition=Migraine`, { cookie });
    assert.equal(result.response.status, 200);
    assert.equal(result.json.pagination.total, 1);
    result = await call('/api/v1/patients/filters', { cookie });
    assert.ok(result.json.data.conditions.includes('Migraine'));

    result = await call('/api/v1/dashboard', { cookie });
    assert.equal(result.json.data.totals.patients, 1);
    assert.equal(result.json.data.daily.patients.length, 30);
    assert.ok(result.json.data.patientsPerDoctor.some((item) => item.doctorId === doctorId && item.patientCount === 1));

    result = await call(`/api/v1/patients/${patientId}`, { method: 'PATCH', cookie, origin: process.env.CLIENT_ORIGIN, body: { condition: 'Asthma' } });
    assert.equal(result.response.status, 200);
    assert.equal(result.json.data.patient.condition, 'Asthma');
    result = await call(`/api/v1/patients/${patientId}`, { method: 'DELETE', cookie, origin: process.env.CLIENT_ORIGIN });
    assert.equal(result.response.status, 200);

    result = await call('/api/v1/auth/logout', { method: 'POST', cookie, origin: process.env.CLIENT_ORIGIN });
    assert.equal(result.response.status, 200);
    assert.match(result.response.headers.get('set-cookie'), /Expires=/);
  } finally {
    if (patientId) await Patient.deleteOne({ _id: patientId });
    if (doctorId) await Doctor.deleteOne({ _id: doctorId });
    if (adminId) await Admin.deleteOne({ _id: adminId });
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
  }
});

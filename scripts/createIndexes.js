require('dotenv').config();
const { connectDatabase } = require('../src/config/db');
const mongoose = require('mongoose');
const Admin = require('../src/models/Admin');
const Doctor = require('../src/models/Doctor');
const Patient = require('../src/models/Patient');

async function createIndexes() {
  await connectDatabase();
  await Promise.all([Admin.createIndexes(), Doctor.createIndexes(), Patient.createIndexes()]);
  console.log('Declared indexes created or confirmed');
}

createIndexes().catch((error) => {
  console.error('Index setup failed:', error.message);
  process.exitCode = 1;
}).finally(async () => {
  await mongoose.disconnect();
});

const { matchedData } = require('express-validator');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const asyncHandler = require('../utils/asyncHandler');
const { pagination, dateRange } = require('../utils/query');

const listPatients = asyncHandler(async (req, res) => {
  const { page, limit, skip } = pagination(req.query);
  const filter = { ...dateRange(req.query) };
  if (req.query.doctorId) filter.doctor = req.query.doctorId;
  if (req.query.condition) filter.condition = req.query.condition;
  if (req.query.search?.trim()) filter.$text = { $search: req.query.search.trim() };
  const [items, total] = await Promise.all([
    Patient.find(filter).populate('doctor', 'name specialization hospital').sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    Patient.countDocuments(filter),
  ]);
  res.json({ success: true, data: { patients: items }, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

const createPatient = asyncHandler(async (req, res) => {
  const input = matchedData(req, { locations: ['body'] });
  // The doctor is supplied by the nested route after body validation.
  input.doctor = req.params.id || input.doctor;
  if (!input.doctor) return res.status(400).json({ success: false, message: 'A doctor is required for this patient' });
  if (!await Doctor.exists({ _id: input.doctor })) return res.status(404).json({ success: false, message: 'Doctor not found' });
  const patient = await Patient.create(input);
  res.status(201).json({ success: true, data: { patient } });
});

const updatePatient = asyncHandler(async (req, res) => {
  const update = matchedData(req, { locations: ['body'] });
  if (update.doctor && !await Doctor.exists({ _id: update.doctor })) return res.status(404).json({ success: false, message: 'Doctor not found' });
  const patient = await Patient.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true }).lean();
  if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });
  res.json({ success: true, data: { patient } });
});

const deletePatient = asyncHandler(async (req, res) => {
  const patient = await Patient.findByIdAndDelete(req.params.id).lean();
  if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });
  res.json({ success: true, message: 'Patient deleted' });
});

const listPatientConditions = asyncHandler(async (_req, res) => {
  const conditions = await Patient.distinct('condition');
  res.json({ success: true, data: { conditions: conditions.sort((a, b) => a.localeCompare(b)) } });
});

module.exports = { listPatients, createPatient, updatePatient, deletePatient, listPatientConditions };

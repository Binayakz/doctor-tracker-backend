const { matchedData } = require('express-validator');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const asyncHandler = require('../utils/asyncHandler');
const { pagination, dateRange } = require('../utils/query');

const listDoctors = asyncHandler(async (req, res) => {
  const { page, limit, skip } = pagination(req.query);
  const filter = { ...dateRange(req.query) };
  if (req.query.specialization) filter.specialization = req.query.specialization;
  if (req.query.search?.trim()) filter.$text = { $search: req.query.search.trim() };
  const [items, total] = await Promise.all([
    Doctor.aggregate([
      { $match: filter },
      { $sort: { createdAt: -1, _id: -1 } },
      { $skip: skip },
      { $limit: limit },
      { $lookup: {
        from: 'patients',
        let: { doctorId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$doctor', '$$doctorId'] } } },
          { $count: 'count' },
        ],
        as: 'patientStats',
      } },
      { $addFields: { patientCount: { $ifNull: [{ $arrayElemAt: ['$patientStats.count', 0] }, 0] } } },
      { $project: { patientStats: 0 } },
    ]),
    Doctor.countDocuments(filter),
  ]);
  res.json({ success: true, data: { doctors: items }, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

const createDoctor = asyncHandler(async (req, res) => {
  const doctor = await Doctor.create(matchedData(req, { locations: ['body'] }));
  res.status(201).json({ success: true, data: { doctor } });
});

const getDoctor = asyncHandler(async (req, res) => {
  const doctor = await Doctor.findById(req.params.id).lean();
  if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });
  res.json({ success: true, data: { doctor } });
});

const listDoctorSpecializations = asyncHandler(async (_req, res) => {
  const specializations = await Doctor.distinct('specialization');
  res.json({ success: true, data: { specializations: specializations.sort((a, b) => a.localeCompare(b)) } });
});

const listDoctorPatients = asyncHandler(async (req, res) => {
  const doctorExists = await Doctor.exists({ _id: req.params.id });
  if (!doctorExists) return res.status(404).json({ success: false, message: 'Doctor not found' });
  const { page, limit, skip } = pagination(req.query);
  const filter = { doctor: req.params.id, ...dateRange(req.query) };
  if (req.query.condition) filter.condition = req.query.condition;
  if (req.query.search?.trim()) filter.$text = { $search: req.query.search.trim() };
  const [items, total] = await Promise.all([
    Patient.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    Patient.countDocuments(filter),
  ]);
  res.json({ success: true, data: { patients: items }, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

module.exports = { listDoctors, createDoctor, getDoctor, listDoctorPatients, listDoctorSpecializations };

const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const asyncHandler = require('../utils/asyncHandler');

const getDashboard = asyncHandler(async (_req, res) => {
  const now = new Date();
  const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 29));
  const [totalDoctors, totalPatients, patientsPerDoctor, patientTimeline, doctorTimeline] = await Promise.all([
    Doctor.countDocuments(),
    Patient.countDocuments(),
    Doctor.aggregate([
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
      { $project: { _id: 0, doctorId: '$_id', name: 1, specialization: 1, patientCount: 1 } },
      { $sort: { patientCount: -1, name: 1 } },
      { $limit: 10 },
    ]),
    Patient.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: now } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Doctor.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: now } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);
  const fillTimeline = (rows) => {
    const counts = new Map(rows.map(({ _id, count }) => [_id, count]));
    return Array.from({ length: 30 }, (_, offset) => {
      const day = new Date(startDate);
      day.setUTCDate(startDate.getUTCDate() + offset);
      const date = day.toISOString().slice(0, 10);
      return { _id: date, count: counts.get(date) || 0 };
    });
  };
  res.json({ success: true, data: {
    totals: { doctors: totalDoctors, patients: totalPatients },
    patientsPerDoctor,
    daily: { patients: fillTimeline(patientTimeline), doctors: fillTimeline(doctorTimeline) },
  } });
});

module.exports = { getDashboard };

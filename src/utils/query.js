const { validationResult, query } = require('express-validator');

function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({
    success: false,
    message: 'Request validation failed',
    errors: errors.array().map(({ path, msg }) => ({ field: path, message: msg })),
  });
  next();
}

function pagination(query) {
  const page = Math.min(10000, Math.max(1, Number.parseInt(query.page, 10) || 1));
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 10));
  return { page, limit, skip: (page - 1) * limit };
}

function dateRange(query, field = 'createdAt') {
  const filter = {};
  if (query.from || query.to) {
    filter[field] = {};
    if (query.from) filter[field].$gte = new Date(`${query.from}T00:00:00.000Z`);
    if (query.to) filter[field].$lte = new Date(`${query.to}T23:59:59.999Z`);
  }
  return filter;
}

function dateQueryValidators() {
  const date = (key) => query(key).optional().matches(/^\d{4}-\d{2}-\d{2}$/).bail()
    .isISO8601({ strict: true, strictSeparator: true });
  return [
    query('page').optional().isInt({ min: 1, max: 10000 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().trim().isLength({ max: 100 }),
    date('from'),
    date('to').custom((to, { req }) => !req.query.from || req.query.from <= to)
      .withMessage('to must be on or after from'),
  ];
}

function doctorQueryValidators() {
  return [...dateQueryValidators(), query('specialization').optional().trim().isLength({ max: 100 })];
}

function patientQueryValidators() {
  return [
    ...dateQueryValidators(),
    query('condition').optional().trim().isLength({ max: 120 }),
    query('doctorId').optional().isMongoId(),
  ];
}

module.exports = { validateRequest, pagination, dateRange, doctorQueryValidators, patientQueryValidators };

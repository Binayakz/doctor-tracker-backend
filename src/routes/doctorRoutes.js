const router = require('express').Router();
const { body, param } = require('express-validator');
const { listDoctors, createDoctor, getDoctor, listDoctorPatients, listDoctorSpecializations } = require('../controllers/doctorController');
const { createPatient } = require('../controllers/patientController');
const { validateRequest, doctorQueryValidators, patientQueryValidators } = require('../utils/query');

const doctorFields = [
  body('name').trim().isLength({ min: 2, max: 120 }),
  body('specialization').trim().isLength({ min: 2, max: 100 }),
  body('hospital').trim().isLength({ min: 2, max: 160 }),
  body('phone').trim().isLength({ min: 5, max: 30 }),
  body('email').isEmail().normalizeEmail(),
];
const patientFields = [
  body('name').trim().isLength({ min: 2, max: 120 }),
  body('age').isInt({ min: 0, max: 125 }).toInt(),
  body('gender').isIn(['female', 'male', 'other', 'prefer_not_to_say']),
  body('condition').trim().isLength({ min: 2, max: 120 }),
  body('phone').optional({ values: 'falsy' }).trim().isLength({ min: 5, max: 30 }),
  body('email').optional({ values: 'falsy' }).isEmail().normalizeEmail(),
];

router.get('/', doctorQueryValidators(), validateRequest, listDoctors);
router.get('/filters', listDoctorSpecializations);
router.post('/', doctorFields, validateRequest, createDoctor);
router.get('/:id', param('id').isMongoId(), validateRequest, getDoctor);
router.get('/:id/patients', param('id').isMongoId(), ...patientQueryValidators(), validateRequest, listDoctorPatients);
router.post('/:id/patients', param('id').isMongoId(), ...patientFields, validateRequest, (req, _res, next) => { req.body.doctor = req.params.id; next(); }, createPatient);
module.exports = router;

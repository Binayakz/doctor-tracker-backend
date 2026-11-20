const router = require('express').Router();
const { body, param } = require('express-validator');
const { listPatients, updatePatient, deletePatient, listPatientConditions } = require('../controllers/patientController');
const { validateRequest, patientQueryValidators } = require('../utils/query');

router.get('/', patientQueryValidators(), validateRequest, listPatients);
router.get('/filters', listPatientConditions);
const editable = [
  body('name').optional().trim().isLength({ min: 2, max: 120 }),
  body('age').optional().isInt({ min: 0, max: 125 }).toInt(),
  body('gender').optional().isIn(['female', 'male', 'other', 'prefer_not_to_say']),
  body('condition').optional().trim().isLength({ min: 2, max: 120 }),
  body('phone').optional().trim().isLength({ max: 30 }),
  body('email').optional({ values: 'falsy' }).isEmail().normalizeEmail(),
  body('doctor').optional().isMongoId(),
];
router.patch('/:id', param('id').isMongoId(), ...editable, validateRequest, updatePatient);
router.delete('/:id', param('id').isMongoId(), validateRequest, deletePatient);
module.exports = router;

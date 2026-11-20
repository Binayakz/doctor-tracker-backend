const router = require('express').Router();
const { body } = require('express-validator');
const { login, logout, me } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { validateRequest } = require('../utils/query');

router.post('/login', [body('email').isEmail().normalizeEmail(), body('password').isString().isLength({ min: 8, max: 128 })], validateRequest, login);
router.post('/logout', logout);
router.get('/me', requireAuth, me);
module.exports = router;

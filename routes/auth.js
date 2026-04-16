const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/authController');
const { redirectIfAuthenticated } = require('../middleware/auth');

router.get('/login', redirectIfAuthenticated, ctrl.getLogin);
router.post('/login', ctrl.postLogin);
router.get('/register', redirectIfAuthenticated, ctrl.getRegister);
router.post('/register', ctrl.postRegister);
router.post('/firebase', ctrl.firebaseAuth);
router.get('/logout', ctrl.logout);
router.get('/forgot-password', ctrl.getForgotPassword);
router.post('/forgot-password', ctrl.postForgotPassword);
router.get('/reset-password/:token', ctrl.getResetPassword);
router.post('/reset-password/:token', ctrl.postResetPassword);

module.exports = router;

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/alumniController');
const { isAuthenticated, isAlumni } = require('../middleware/auth');

router.use(isAuthenticated);

router.get('/dashboard', ctrl.getDashboard);
router.get('/pending', ctrl.getPending);
router.get('/profile', ctrl.getProfile);
router.get('/profile/edit', ctrl.getEditProfile);
router.post('/profile/edit', ctrl.postEditProfile);
router.get('/membership', ctrl.getMembership);
router.post('/membership/apply', ctrl.applyMembership);
router.post('/membership/verify-payment', ctrl.verifyPayment);
router.get('/certificate', ctrl.getCertificate);
router.get('/payments', ctrl.getPayments);
router.get('/directory', ctrl.getDirectory);

module.exports = router;

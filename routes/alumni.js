const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/alumniController');
const { isAuthenticated, isApproved } = require('../middleware/auth');

router.use(isAuthenticated);

// Pending page — accessible before approval
router.get('/pending', ctrl.getPending);

// All other routes require account to be verified
router.get('/dashboard', isApproved, ctrl.getDashboard);
router.get('/profile', isApproved, ctrl.getProfile);
router.get('/profile/edit', isApproved, ctrl.getEditProfile);
router.post('/profile/edit', isApproved, ctrl.postEditProfile);
router.get('/membership', isApproved, ctrl.getMembership);
router.post('/membership/apply', isApproved, ctrl.applyMembership);
router.post('/membership/verify-payment', isApproved, ctrl.verifyPayment);
router.get('/certificate', isApproved, ctrl.getCertificate);
router.get('/payments', isApproved, ctrl.getPayments);
router.get('/directory', isApproved, ctrl.getDirectory);

module.exports = router;

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/adminController');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

router.use(isAuthenticated, isAdmin);

// Root redirect — /admin → /admin/dashboard (prevents 404)
router.get('/', (req, res) => res.redirect('/admin/dashboard'));

router.get('/dashboard',          ctrl.getDashboard);
router.get('/alumni',             ctrl.getAllAlumni);
router.post('/alumni/:id/approve',ctrl.approveAlumni);
router.post('/alumni/:id/reject', ctrl.rejectAlumni);
router.delete('/alumni/:id',      ctrl.deleteAlumni);
router.get('/memberships',        ctrl.getMemberships);
router.post('/memberships/:id/approve', ctrl.approveMembership);
router.post('/memberships/:id/reject',  ctrl.rejectMembership);
router.get('/payments',           ctrl.getPayments);
router.get('/export/alumni',      ctrl.exportAlumni);
router.get('/events',             ctrl.getEvents);
router.post('/events',            ctrl.createEvent);
router.delete('/events/:id',      ctrl.deleteEvent);
router.get('/events/:id/registrations',                    ctrl.getEventRegistrations);
router.post('/events/:id/registrations/:regId/status',     ctrl.updateRegistrationStatus);
router.get('/announcements',      ctrl.getAnnouncements);
router.post('/announcements',     ctrl.createAnnouncement);
router.delete('/announcements/:id', ctrl.deleteAnnouncement);
router.get('/membership-plans',   ctrl.getMembershipPlans);
router.post('/membership-plans',  ctrl.createMembershipPlan);
router.delete('/membership-plans/:id', ctrl.deleteMembershipPlan);

module.exports = router;

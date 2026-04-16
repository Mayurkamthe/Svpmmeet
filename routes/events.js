const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/eventsController');
const { isAuthenticated } = require('../middleware/auth');

router.get('/', ctrl.getEvents);
router.get('/:id', ctrl.getEvent);
router.post('/:id/register', isAuthenticated, ctrl.registerEvent);

module.exports = router;

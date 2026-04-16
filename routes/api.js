const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const User = require('../models/User');
const Payment = require('../models/Payment');

// GET /api/stats (admin)
router.get('/stats', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const [totalAlumni, lifeMembers, revenue] = await Promise.all([
      User.countDocuments({ role: 'alumni' }),
      User.countDocuments({ membershipStatus: 'approved' }),
      Payment.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: null, total: { $sum: '$amount' } } }])
    ]);
    res.json({ totalAlumni, lifeMembers, revenue: revenue[0]?.total || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/alumni/:id (authenticated)
router.get('/alumni/:id', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password -resetPasswordToken');
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

// routes/index.js
const express = require('express');
const router = express.Router();
const { Event } = require('../models/Event');
const Announcement = require('../models/Announcement');

router.get('/', async (req, res) => {
  try {
    const events = await Event.find({ date: { $gte: new Date() }, isActive: true, isFeatured: true }).sort('date').limit(3);
    const announcements = await Announcement.find({ isPublished: true }).sort('-createdAt').limit(3);
    res.render('index', { title: 'SVPM Alumni Association', events, announcements });
  } catch (err) {
    res.render('index', { title: 'SVPM Alumni Association', events: [], announcements: [] });
  }
});

module.exports = router;

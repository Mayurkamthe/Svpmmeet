const { Event, EventRegistration } = require('../models/Event');
const Payment = require('../models/Payment');

// GET /events
exports.getEvents = async (req, res) => {
  try {
    const upcoming = await Event.find({ date: { $gte: new Date() }, isActive: true }).sort('date');
    const past = await Event.find({ date: { $lt: new Date() }, isActive: true }).sort('-date').limit(6);
    res.render('events/list', { title: 'Events', upcoming, past });
  } catch (err) {
    req.flash('error_msg', 'Error loading events');
    res.redirect('/alumni/dashboard');
  }
};

// GET /events/:id
exports.getEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate('createdBy', 'name');
    if (!event) {
      req.flash('error_msg', 'Event not found');
      return res.redirect('/events');
    }

    const registrationCount = await EventRegistration.countDocuments({ event: event._id });
    let userRegistered = false;
    if (req.user) {
      userRegistered = await EventRegistration.exists({ event: event._id, user: req.user._id });
    }

    res.render('events/detail', { title: event.title, event, registrationCount, userRegistered });
  } catch (err) {
    req.flash('error_msg', 'Error loading event');
    res.redirect('/events');
  }
};

// POST /events/:id/register
exports.registerEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.json({ success: false, message: 'Event not found' });

    const existing = await EventRegistration.exists({ event: event._id, user: req.user._id });
    if (existing) return res.json({ success: false, message: 'Already registered' });

    await EventRegistration.create({ event: event._id, user: req.user._id });
    res.json({ success: true, message: 'Registered successfully!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
};

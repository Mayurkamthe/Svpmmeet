const User = require('../models/User');
const Payment = require('../models/Payment');
const { Event, EventRegistration } = require('../models/Event');
const Announcement = require('../models/Announcement');
const { sendEmail, emailTemplates } = require('../config/email');
const xlsx = require('xlsx');

// GET /admin/dashboard
exports.getDashboard = async (req, res) => {
  try {
    const [totalAlumni, pendingAlumni, approvedAlumni, totalPayments,
      recentAlumni, pendingMemberships, recentPayments, upcomingEvents] = await Promise.all([
      User.countDocuments({ role: 'alumni' }),
      User.countDocuments({ role: 'alumni', isVerified: false }),
      User.countDocuments({ role: 'alumni', isVerified: true }),
      Payment.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      User.find({ role: 'alumni' }).sort('-createdAt').limit(6),
      User.find({ role: 'alumni', membershipStatus: 'pending' }).sort('-membershipAppliedAt').limit(5),
      Payment.find({ status: 'paid' }).populate('user', 'name alumniId').sort('-paidAt').limit(5),
      Event.find({ date: { $gte: new Date() }, isActive: true }).sort('date').limit(4)
    ]);

    const revenue = totalPayments[0]?.total || 0;
    const lifeMembers = await User.countDocuments({ membershipStatus: 'approved' });

    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      stats: { totalAlumni, pendingAlumni, approvedAlumni, revenue, lifeMembers },
      recentAlumni, pendingMemberships, recentPayments, upcomingEvents
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error loading dashboard');
    res.redirect('/');
  }
};

// GET /admin/alumni
exports.getAllAlumni = async (req, res) => {
  try {
    const { search, branch, year, status, page = 1 } = req.query;
    const query = { role: 'alumni' };

    if (search) query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { alumniId: { $regex: search, $options: 'i' } }
    ];
    if (branch) query['profile.branch'] = branch;
    if (year) query['profile.passOutYear'] = parseInt(year);
    if (status === 'verified') query.isVerified = true;
    if (status === 'pending') query.isVerified = false;

    const limit = 15;
    const skip = (parseInt(page) - 1) * limit;
    const total = await User.countDocuments(query);
    const alumni = await User.find(query).sort('-createdAt').skip(skip).limit(limit);

    const branches = ['Computer Engineering', 'Mechanical Engineering', 'Civil Engineering',
      'Electronics & Telecommunication', 'Electrical Engineering', 'Information Technology'];
    const years = Array.from({ length: new Date().getFullYear() - 1989 }, (_, i) => 1990 + i).reverse();

    res.render('admin/alumni', {
      title: 'Manage Alumni',
      alumni, total, page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      limit, branches, years, query: req.query
    });
  } catch (err) {
    req.flash('error_msg', 'Error loading alumni list');
    res.redirect('/admin/dashboard');
  }
};

// POST /admin/alumni/:id/approve
exports.approveAlumni = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id,
      { isVerified: true }, { new: true });
    if (!user) return res.json({ success: false, message: 'User not found' });

    await sendEmail({
      to: user.email,
      subject: 'Account Approved — SVPM Alumni',
      html: `<div style="font-family: Arial, sans-serif;"><h2 style="color:#1e3a5f;">Your alumni account has been approved!</h2><p>Welcome, ${user.name}. You can now log in and access all features.</p><a href="${process.env.APP_URL}/alumni/dashboard" style="background:#2d6a9f;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;">Go to Dashboard</a></div>`
    });

    res.json({ success: true, message: 'Alumni approved' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /admin/alumni/:id/reject
exports.rejectAlumni = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id,
      { isVerified: false, isActive: false }, { new: true });
    res.json({ success: true, message: 'Alumni rejected' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /admin/alumni/:id
exports.deleteAlumni = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    req.flash('success_msg', 'Alumni deleted');
    res.redirect('/admin/alumni');
  } catch (err) {
    req.flash('error_msg', 'Error deleting alumni');
    res.redirect('/admin/alumni');
  }
};

// GET /admin/memberships
exports.getMemberships = async (req, res) => {
  try {
    const { status = 'pending' } = req.query;
    const query = { role: 'alumni' };
    if (status !== 'all') query.membershipStatus = status;

    const users = await User.find(query).sort('-membershipAppliedAt');
    res.render('admin/memberships', { title: 'Membership Requests', users, status });
  } catch (err) {
    req.flash('error_msg', 'Error loading memberships');
    res.redirect('/admin/dashboard');
  }
};

// POST /admin/memberships/:id/approve
exports.approveMembership = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, {
      membershipStatus: 'approved',
      membershipApprovedAt: new Date()
    }, { new: true });

    const tmpl = emailTemplates.membershipApproved(user);
    await sendEmail({ to: user.email, ...tmpl });

    res.json({ success: true, message: 'Membership approved' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /admin/memberships/:id/reject
exports.rejectMembership = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, {
      membershipStatus: 'rejected',
      membershipRejectedAt: new Date(),
      membershipRejectionReason: req.body.reason
    }, { new: true });

    await sendEmail({
      to: user.email,
      subject: 'Membership Application Update — SVPM Alumni',
      html: `<p>Dear ${user.name}, your life membership application was not approved at this time. Reason: ${req.body.reason || 'N/A'}. Please contact us for more information.</p>`
    });

    res.json({ success: true, message: 'Membership rejected' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /admin/payments
exports.getPayments = async (req, res) => {
  try {
    const { status, page = 1 } = req.query;
    const query = status ? { status } : {};
    const limit = 15;
    const skip = (parseInt(page) - 1) * limit;
    const total = await Payment.countDocuments(query);
    const payments = await Payment.find(query).populate('user', 'name email alumniId')
      .sort('-createdAt').skip(skip).limit(limit);

    const revenue = await Payment.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    res.render('admin/payments', {
      title: 'Payment Management',
      payments, total, page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      revenue: revenue[0]?.total || 0, query: req.query
    });
  } catch (err) {
    req.flash('error_msg', 'Error loading payments');
    res.redirect('/admin/dashboard');
  }
};

// GET /admin/export
exports.exportAlumni = async (req, res) => {
  try {
    const alumni = await User.find({ role: 'alumni' }).lean();
    const data = alumni.map(a => ({
      'Alumni ID': a.alumniId || '',
      'Name': a.name,
      'Email': a.email,
      'Phone': a.phone || '',
      'Branch': a.profile?.branch || '',
      'Pass Out Year': a.profile?.passOutYear || '',
      'Company': a.profile?.company || '',
      'Location': a.profile?.location || '',
      'Membership Status': a.membershipStatus,
      'Account Verified': a.isVerified ? 'Yes' : 'No',
      'Registered On': new Date(a.createdAt).toLocaleDateString('en-IN')
    }));

    const ws = xlsx.utils.json_to_sheet(data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Alumni');

    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', `attachment; filename=SVPM-Alumni-${Date.now()}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    req.flash('error_msg', 'Export failed');
    res.redirect('/admin/alumni');
  }
};

// GET /admin/events
exports.getEvents = async (req, res) => {
  try {
    const events = await Event.find().sort('-createdAt').lean();
    for (const e of events) {
      e.registrationCount = await EventRegistration.countDocuments({ event: e._id });
    }
    res.render('admin/events', { title: 'Manage Events', events });
  } catch (err) {
    req.flash('error_msg', 'Error loading events');
    res.redirect('/admin/dashboard');
  }
};

// POST /admin/events
exports.createEvent = async (req, res) => {
  try {
    const { title, description, date, endDate, venue, type, isFree, fee, maxAttendees, isFeatured } = req.body;

    await Event.create({
      title, description, date, endDate, venue, type,
      isFree: isFree === 'on',
      fee: parseFloat(fee) || 0,
      maxAttendees: parseInt(maxAttendees) || 0,
      isFeatured: isFeatured === 'on',
      createdBy: req.user._id
    });

    req.flash('success_msg', 'Event created successfully');
    res.redirect('/admin/events');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error creating event');
    res.redirect('/admin/events');
  }
};

// DELETE /admin/events/:id
exports.deleteEvent = async (req, res) => {
  try {
    await Event.findByIdAndDelete(req.params.id);
    req.flash('success_msg', 'Event deleted');
    res.redirect('/admin/events');
  } catch (err) {
    req.flash('error_msg', 'Error deleting event');
    res.redirect('/admin/events');
  }
};

// GET /admin/announcements
exports.getAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.find().populate('createdBy', 'name').sort('-createdAt');
    res.render('admin/announcements', { title: 'Announcements', announcements });
  } catch (err) {
    req.flash('error_msg', 'Error loading announcements');
    res.redirect('/admin/dashboard');
  }
};

// POST /admin/announcements
exports.createAnnouncement = async (req, res) => {
  try {
    await Announcement.create({ ...req.body, createdBy: req.user._id });
    req.flash('success_msg', 'Announcement created');
    res.redirect('/admin/announcements');
  } catch (err) {
    req.flash('error_msg', 'Error creating announcement');
    res.redirect('/admin/announcements');
  }
};

// DELETE /admin/announcements/:id
exports.deleteAnnouncement = async (req, res) => {
  try {
    await Announcement.findByIdAndDelete(req.params.id);
    req.flash('success_msg', 'Announcement deleted');
    res.redirect('/admin/announcements');
  } catch (err) {
    req.flash('error_msg', 'Error deleting announcement');
    res.redirect('/admin/announcements');
  }
};

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
      // FIX: show ALL recent registrations, not just unverified
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

    try {
      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      await sendEmail({
        to: user.email,
        subject: 'Account Approved — SVPM Alumni',
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;">
          <div style="background:#1e3a5f;padding:30px;text-align:center;">
            <h1 style="color:#fff;margin:0;">Account Approved!</h1>
          </div>
          <div style="padding:30px;">
            <h2 style="color:#1e3a5f;">Welcome, ${user.name}!</h2>
            <p>Your alumni account has been approved. You can now log in and access all features.</p>
            <a href="${appUrl}/alumni/dashboard" style="background:#2d6a9f;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:15px;">Go to Dashboard</a>
          </div>
        </div>`
      });
    } catch (emailErr) {
      console.error('Email error (non-fatal):', emailErr.message);
    }

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

    // Also get the paid payment for each user to show payment info
    const users = await User.find(query).sort('-membershipAppliedAt');

    // Attach payment info to each user
    const usersWithPayments = await Promise.all(users.map(async (u) => {
      const payment = await Payment.findOne({
        user: u._id, purpose: 'life_membership', status: 'paid'
      }).sort('-paidAt');
      return { ...u.toObject(), paidPayment: payment };
    }));

    res.render('admin/memberships', { title: 'Membership Requests', users: usersWithPayments, status });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error loading memberships');
    res.redirect('/admin/dashboard');
  }
};

// POST /admin/memberships/:id/approve
exports.approveMembership = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, {
      membershipStatus: 'approved',
      membershipApprovedAt: new Date(),
      isVerified: true // CRITICAL FIX: also verify account when approving membership
    }, { new: true });

    if (!user) return res.json({ success: false, message: 'User not found' });

    try {
      const tmpl = emailTemplates.membershipApproved(user);
      await sendEmail({ to: user.email, ...tmpl });
    } catch (emailErr) {
      console.error('Email error (non-fatal):', emailErr.message);
    }

    res.json({ success: true, message: 'Life membership approved!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /admin/memberships/:id/reject
exports.rejectMembership = async (req, res) => {
  try {
    const { reason } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, {
      membershipStatus: 'rejected',
      membershipRejectedAt: new Date(),
      membershipRejectionReason: reason || 'No reason provided'
    }, { new: true });

    if (!user) return res.json({ success: false, message: 'User not found' });

    try {
      await sendEmail({
        to: user.email,
        subject: 'Membership Application Update — SVPM Alumni',
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;padding:30px;">
          <h2 style="color:#1e3a5f;">Membership Application Update</h2>
          <p>Dear ${user.name},</p>
          <p>Your life membership application was not approved at this time.</p>
          <p><strong>Reason:</strong> ${reason || 'Please contact the admin for details.'}</p>
          <p>You may re-apply after addressing the above concern. Contact us at <a href="mailto:${process.env.COLLEGE_EMAIL || 'info@svpmcoe.edu.in'}">${process.env.COLLEGE_EMAIL || 'info@svpmcoe.edu.in'}</a></p>
        </div>`
      });
    } catch (emailErr) {
      console.error('Email error (non-fatal):', emailErr.message);
    }

    res.json({ success: true, message: 'Membership rejected' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /admin/payments
exports.getPayments = async (req, res) => {
  try {
    const { status, page = 1 } = req.query;
    const query = {};
    if (status && ['paid', 'created', 'failed', 'refunded'].includes(status)) {
      query.status = status;
    }
    const limit = 15;
    const skip = (parseInt(page) - 1) * limit;
    const total = await Payment.countDocuments(query);
    const payments = await Payment.find(query)
      .populate('user', 'name email alumniId')
      .sort('-createdAt').skip(skip).limit(limit);

    const revenueAgg = await Payment.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    res.render('admin/payments', {
      title: 'Payment Management',
      payments, total, page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      revenue: revenueAgg[0]?.total || 0,
      query: req.query
    });
  } catch (err) {
    req.flash('error_msg', 'Error loading payments');
    res.redirect('/admin/dashboard');
  }
};

// GET /admin/export/alumni
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
      'Designation': a.profile?.designation || '',
      'Location': a.profile?.location || '',
      'LinkedIn': a.profile?.linkedin || '',
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
    console.error(err);
    req.flash('error_msg', 'Export failed: ' + err.message);
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
    const { title, description, date, endDate, venue, type, fee, maxAttendees } = req.body;

    if (!title || !description || !date || !venue) {
      req.flash('error_msg', 'Title, description, date and venue are required');
      return res.redirect('/admin/events');
    }

    await Event.create({
      title: title.trim(),
      description: description.trim(),
      date: new Date(date),
      endDate: endDate ? new Date(endDate) : undefined,
      venue: venue.trim(),
      type: type || 'other',
      isFree: req.body.isFree === 'on' || !fee || parseFloat(fee) === 0,
      fee: parseFloat(fee) || 0,
      maxAttendees: parseInt(maxAttendees) || 0,
      isFeatured: req.body.isFeatured === 'on',
      createdBy: req.user._id,
      isActive: true
    });

    req.flash('success_msg', 'Event created successfully');
    res.redirect('/admin/events');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error creating event: ' + err.message);
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
    const announcements = await Announcement.find()
      .populate('createdBy', 'name')
      .sort('-createdAt');
    res.render('admin/announcements', { title: 'Announcements', announcements });
  } catch (err) {
    req.flash('error_msg', 'Error loading announcements');
    res.redirect('/admin/dashboard');
  }
};

// POST /admin/announcements
exports.createAnnouncement = async (req, res) => {
  try {
    const { title, content, type } = req.body;

    if (!title || !content) {
      req.flash('error_msg', 'Title and content are required');
      return res.redirect('/admin/announcements');
    }

    // FIX: sanitize fields individually instead of spreading req.body
    await Announcement.create({
      title: title.trim(),
      content: content.trim(),
      type: ['general', 'urgent', 'event', 'membership'].includes(type) ? type : 'general',
      isPublished: req.body.isPublished === 'on' || req.body.isPublished === 'true' || req.body.isPublished === true,
      createdBy: req.user._id
    });

    req.flash('success_msg', 'Announcement published successfully');
    res.redirect('/admin/announcements');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error creating announcement: ' + err.message);
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

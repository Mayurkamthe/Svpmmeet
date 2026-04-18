const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const Payment = require('../models/Payment');
const { Event, EventRegistration } = require('../models/Event');
const Announcement = require('../models/Announcement');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { sendEmail, emailTemplates } = require('../config/email');

// GET /alumni/dashboard
exports.getDashboard = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) { req.session.destroy(); return res.redirect('/auth/login'); }

    const payments = await Payment.find({ user: req.user._id, status: 'paid' }).sort('-paidAt').limit(5);
    const announcements = await Announcement.find({ isPublished: true }).sort('-createdAt').limit(5);
    const upcomingEvents = await Event.find({ date: { $gte: new Date() }, isActive: true }).sort('date').limit(4);

    res.render('alumni/dashboard', {
      title: 'Alumni Dashboard',
      user, payments, announcements, upcomingEvents
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error loading dashboard');
    res.redirect('/');
  }
};

// GET /alumni/profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.render('alumni/profile', { title: 'My Profile', user, editing: false });
  } catch (err) {
    req.flash('error_msg', 'Error loading profile');
    res.redirect('/alumni/dashboard');
  }
};

// GET /alumni/profile/edit
exports.getEditProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.render('alumni/profile', { title: 'Edit Profile', user, editing: true });
  } catch (err) {
    req.flash('error_msg', 'Error loading profile');
    res.redirect('/alumni/dashboard');
  }
};

// POST /alumni/profile/edit
exports.postEditProfile = async (req, res) => {
  try {
    const { name, phone, branch, passOutYear, designation, company, location, linkedin, bio } = req.body;
    const user = await User.findById(req.user._id);

    user.name = name || user.name;
    user.phone = phone || user.phone;
    user.profile = {
      branch: branch || user.profile?.branch,
      passOutYear: parseInt(passOutYear) || user.profile?.passOutYear,
      designation: designation || '',
      company: company || '',
      location: location || '',
      linkedin: linkedin || '',
      bio: bio || ''
    };

    if (req.files && req.files.avatar) {
      const file = req.files.avatar;
      const ext = path.extname(file.name).toLowerCase();
      const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
      if (!allowed.includes(ext)) {
        req.flash('error_msg', 'Only JPG, PNG, WEBP allowed');
        return res.redirect('/alumni/profile/edit');
      }
      const uploadDir = path.join(__dirname, '../public/uploads/avatars');
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      const filename = `avatar-${user._id}-${Date.now()}${ext}`;
      await file.mv(path.join(uploadDir, filename));
      if (user.avatar && user.avatar.startsWith('/uploads/')) {
        const oldPath = path.join(__dirname, '../public', user.avatar);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      user.avatar = `/uploads/avatars/${filename}`;
    }

    await user.save({ validateBeforeSave: false });
    req.session.user = user.toPublicJSON();
    req.flash('success_msg', 'Profile updated successfully');
    res.redirect('/alumni/profile');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error updating profile: ' + err.message);
    res.redirect('/alumni/profile/edit');
  }
};

// GET /alumni/membership
exports.getMembership = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const payment = await Payment.findOne({ user: req.user._id, purpose: 'life_membership', status: 'paid' });
    const membershipAmount = parseInt(process.env.MEMBERSHIP_AMOUNT) || 1000;
    res.render('alumni/membership', { title: 'Life Membership', user, payment, membershipAmount });
  } catch (err) {
    req.flash('error_msg', 'Error loading membership page');
    res.redirect('/alumni/dashboard');
  }
};

// POST /alumni/membership/apply
exports.applyMembership = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user.membershipStatus === 'approved') {
      return res.json({ success: false, message: 'Already a life member' });
    }

    // Cancel any previously stuck 'created' payment
    await Payment.updateMany(
      { user: user._id, purpose: 'life_membership', status: 'created' },
      { status: 'failed' }
    );

    const amount = parseInt(process.env.MEMBERSHIP_AMOUNT || 1000) * 100;
    let order;

    const rzpConfigured = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET &&
      process.env.RAZORPAY_KEY_ID !== 'your_key_here';

    if (rzpConfigured) {
      const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
      });
      order = await razorpay.orders.create({
        amount,
        currency: 'INR',
        receipt: `mem_${user._id.toString().substring(18)}_${Date.now()}`,
        notes: { userId: user._id.toString(), purpose: 'life_membership' }
      });
    } else {
      // Demo mode
      order = { id: `order_demo_${Date.now()}`, amount, currency: 'INR' };
    }

    const payment = await Payment.create({
      user: user._id,
      razorpayOrderId: order.id,
      amount: amount / 100,
      currency: 'INR',
      purpose: 'life_membership',
      status: 'created'
    });

    // Only set pending AFTER payment record is created
    if (user.membershipStatus !== 'pending') {
      user.membershipStatus = 'pending';
      user.membershipAppliedAt = new Date();
      await user.save({ validateBeforeSave: false });
    }

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      paymentId: payment._id,
      key: process.env.RAZORPAY_KEY_ID || '',
      demo: !rzpConfigured
    });
  } catch (err) {
    console.error('Membership apply error:', err);
    const errorMsg = err.error ? err.error.description : err.message;
    res.status(500).json({ success: false, message: 'Error creating payment order: ' + errorMsg });
  }
};

// POST /alumni/membership/verify-payment
exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, payment_id } = req.body;

    const rzpConfigured = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET &&
      process.env.RAZORPAY_KEY_ID !== 'your_key_here';

    let isValid = false;
    if (rzpConfigured && razorpay_signature) {
      const body = razorpay_order_id + '|' + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body).digest('hex');
      isValid = expectedSignature === razorpay_signature;
    } else {
      isValid = true; // demo mode
    }

    if (!isValid) {
      return res.json({ success: false, message: 'Payment verification failed. Please contact admin.' });
    }

    const payment = await Payment.findByIdAndUpdate(payment_id, {
      razorpayPaymentId: razorpay_payment_id || `demo_${Date.now()}`,
      razorpaySignature: razorpay_signature || 'demo',
      status: 'paid',
      paidAt: new Date()
    }, { new: true });

    if (!payment) {
      return res.json({ success: false, message: 'Payment record not found' });
    }

    // CRITICAL FIX: keep membershipStatus = 'pending' so admin can approve
    // but mark payment as paid so admin sees it
    await User.findByIdAndUpdate(req.user._id, {
      membershipStatus: 'pending',
      membershipAppliedAt: payment.paidAt
    });

    // Send receipt email (non-blocking)
    try {
      const user = await User.findById(req.user._id);
      const tmpl = emailTemplates.paymentSuccess(user, payment);
      await sendEmail({ to: user.email, ...tmpl });
    } catch (emailErr) {
      console.error('Email error (non-fatal):', emailErr.message);
    }

    res.json({ success: true, receiptNumber: payment.receiptNumber });
  } catch (err) {
    console.error('Payment verify error:', err);
    res.status(500).json({ success: false, message: 'Payment verification error: ' + err.message });
  }
};

// GET /alumni/directory
exports.getDirectory = async (req, res) => {
  try {
    const { name, branch, year, company, page = 1 } = req.query;
    // FIX: show all active alumni, not just isVerified (so directory isn't empty)
    const query = { role: 'alumni', isActive: true };

    if (name) query.$or = [
      { name: { $regex: name, $options: 'i' } },
      { 'profile.company': { $regex: name, $options: 'i' } }
    ];
    if (branch) query['profile.branch'] = branch;
    if (year) query['profile.passOutYear'] = parseInt(year);
    if (company) query['profile.company'] = { $regex: company, $options: 'i' };

    const limit = 12;
    const skip = (parseInt(page) - 1) * limit;
    const total = await User.countDocuments(query);
    const alumni = await User.find(query).select('-password -resetPasswordToken').sort('name').skip(skip).limit(limit);

    const branches = ['Computer Engineering', 'Mechanical Engineering', 'Civil Engineering',
      'Electronics & Telecommunication', 'Electrical Engineering', 'Information Technology'];
    const years = Array.from({ length: new Date().getFullYear() - 1989 }, (_, i) => 1990 + i).reverse();

    res.render('alumni/directory', {
      title: 'Alumni Directory',
      alumni, total, page: parseInt(page), limit,
      totalPages: Math.ceil(total / limit),
      branches, years, query: req.query
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error loading directory');
    res.redirect('/alumni/dashboard');
  }
};

// GET /alumni/certificate
exports.getCertificate = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user.membershipStatus !== 'approved') {
      req.flash('error_msg', 'Membership certificate not available yet. Please wait for admin approval.');
      return res.redirect('/alumni/membership');
    }

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 60 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=SVPM-Certificate-${user.alumniId}.pdf`);
    doc.pipe(res);

    const W = doc.page.width, H = doc.page.height;

    // Outer border
    doc.rect(15, 15, W - 30, H - 30).lineWidth(4).stroke('#1e3a5f');
    doc.rect(22, 22, W - 44, H - 44).lineWidth(1.5).stroke('#c8a31a');

    // Header band
    doc.rect(30, 30, W - 60, 70).fill('#1e3a5f');
    doc.fillColor('#ffffff').fontSize(24).font('Helvetica-Bold')
      .text('SVPM College of Engineering', 0, 42, { align: 'center' });
    doc.fontSize(12).font('Helvetica')
      .text('Alumni Association — Malegaon Bk, Baramati, Pune', 0, 72, { align: 'center' });

    // Gold divider
    doc.moveTo(80, 112).lineTo(W - 80, 112).lineWidth(2).stroke('#c8a31a');

    // Certificate title
    doc.fontSize(20).fillColor('#c8a31a').font('Helvetica-Bold')
      .text('LIFE MEMBERSHIP CERTIFICATE', 0, 125, { align: 'center' });

    doc.moveTo(80, 152).lineTo(W - 80, 152).lineWidth(0.5).stroke('#1e3a5f');

    // Body
    doc.fontSize(13).fillColor('#4a5568').font('Helvetica')
      .text('This is to certify that', 0, 168, { align: 'center' });

    doc.fontSize(28).fillColor('#1e3a5f').font('Helvetica-Bold')
      .text(user.name, 0, 190, { align: 'center' });

    const details = `Alumni ID: ${user.alumniId || 'N/A'}   |   Branch: ${user.profile?.branch || 'N/A'}   |   Batch: ${user.profile?.passOutYear || 'N/A'}`;
    doc.fontSize(12).fillColor('#6b7280').font('Helvetica')
      .text(details, 0, 230, { align: 'center' });

    doc.fontSize(14).fillColor('#374151').font('Helvetica')
      .text('is a registered Life Member of the SVPM Alumni Association', 0, 255, { align: 'center' });
    doc.fontSize(12).fillColor('#374151')
      .text('and is entitled to all benefits and privileges therein.', 0, 275, { align: 'center' });

    const approvedDate = user.membershipApprovedAt
      ? new Date(user.membershipApprovedAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
      : new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });

    doc.fontSize(11).fillColor('#6b7280')
      .text(`Date of Issue: ${approvedDate}`, 0, 305, { align: 'center' });

    // Signature lines
    const sigY = H - 100;
    doc.moveTo(80, sigY).lineTo(220, sigY).lineWidth(1).stroke('#1e3a5f');
    doc.moveTo(W - 220, sigY).lineTo(W - 80, sigY).lineWidth(1).stroke('#1e3a5f');

    doc.fontSize(11).fillColor('#1e3a5f').font('Helvetica-Bold')
      .text('Secretary', 80, sigY + 8, { width: 140, align: 'center' });
    doc.fontSize(10).fillColor('#6b7280').font('Helvetica')
      .text('SVPM Alumni Association', 80, sigY + 22, { width: 140, align: 'center' });

    doc.fontSize(11).fillColor('#1e3a5f').font('Helvetica-Bold')
      .text('Principal', W - 220, sigY + 8, { width: 140, align: 'center' });
    doc.fontSize(10).fillColor('#6b7280').font('Helvetica')
      .text('SVPM College of Engineering', W - 220, sigY + 22, { width: 140, align: 'center' });

    doc.end();
  } catch (err) {
    console.error('Certificate error:', err);
    req.flash('error_msg', 'Error generating certificate');
    res.redirect('/alumni/membership');
  }
};

// GET /alumni/payments
exports.getPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ user: req.user._id }).sort('-createdAt');
    res.render('alumni/payments', { title: 'Payment History', payments });
  } catch (err) {
    req.flash('error_msg', 'Error loading payments');
    res.redirect('/alumni/dashboard');
  }
};

// GET /alumni/pending
exports.getPending = (req, res) => {
  res.render('alumni/pending', { title: 'Account Pending', user: req.user || null });
};

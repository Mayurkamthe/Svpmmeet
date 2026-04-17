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
    const payments = await Payment.find({ user: req.user._id, status: 'paid' }).sort('-paidAt').limit(5);
    const registrations = await EventRegistration.find({ user: req.user._id })
      .populate('event').sort('-registeredAt').limit(5);
    const announcements = await Announcement.find({ isPublished: true }).sort('-createdAt').limit(5);
    const upcomingEvents = await Event.find({ date: { $gte: new Date() }, isActive: true })
      .sort('date').limit(4);

    res.render('alumni/dashboard', {
      title: 'Alumni Dashboard',
      user, payments, registrations, announcements, upcomingEvents
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
    user.phone = phone;
    user.profile = {
      branch, passOutYear: parseInt(passOutYear),
      designation, company, location, linkedin, bio
    };

    // Handle avatar upload
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

      // Remove old avatar
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
    req.flash('error_msg', 'Error updating profile');
    res.redirect('/alumni/profile/edit');
  }
};

// GET /alumni/membership
exports.getMembership = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const payment = await Payment.findOne({ user: req.user._id, purpose: 'life_membership', status: 'paid' });
    const razorpayKey = process.env.RAZORPAY_KEY_ID || '';
    const membershipAmount = parseInt(process.env.MEMBERSHIP_AMOUNT) || 1000;

    res.render('alumni/membership', {
      title: 'Life Membership',
      user, payment, razorpayKey, membershipAmount
    });
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

    // Create Razorpay order
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    const amount = parseInt(process.env.MEMBERSHIP_AMOUNT || 1000) * 100; // paise

    let order;
    try {
      order = await razorpay.orders.create({
        amount,
        currency: 'INR',
        receipt: `membership_${user._id}_${Date.now()}`,
        notes: { userId: user._id.toString(), purpose: 'life_membership' }
      });
    } catch (rzpErr) {
      // Demo mode if Razorpay not configured
      order = {
        id: `order_demo_${Date.now()}`,
        amount,
        currency: 'INR'
      };
    }

    // Create pending payment
    const payment = await Payment.create({
      user: user._id,
      razorpayOrderId: order.id,
      amount: amount / 100,
      currency: 'INR',
      purpose: 'life_membership',
      status: 'created'
    });

    user.membershipStatus = 'pending';
    user.membershipAppliedAt = new Date();
    await user.save({ validateBeforeSave: false });

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      paymentId: payment._id,
      key: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    console.error('Membership apply error:', err);
    res.status(500).json({ success: false, message: 'Error creating payment order' });
  }
};

// POST /alumni/membership/verify-payment
exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, payment_id } = req.body;

    // Verify Razorpay signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'demo')
      .update(body).digest('hex');

    const isValid = expectedSignature === razorpay_signature ||
      process.env.NODE_ENV === 'development'; // Allow demo in dev

    if (!isValid) {
      return res.json({ success: false, message: 'Payment verification failed' });
    }

    const payment = await Payment.findByIdAndUpdate(payment_id, {
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      status: 'paid',
      paidAt: new Date()
    }, { new: true });

    // Send receipt email
    const user = await User.findById(req.user._id);
    const tmpl = emailTemplates.paymentSuccess(user, payment);
    await sendEmail({ to: user.email, ...tmpl });

    res.json({ success: true, receiptNumber: payment.receiptNumber });
  } catch (err) {
    console.error('Payment verify error:', err);
    res.status(500).json({ success: false, message: 'Payment verification error' });
  }
};

// GET /alumni/directory
exports.getDirectory = async (req, res) => {
  try {
    const { name, branch, year, company, page = 1 } = req.query;
    const query = { role: 'alumni', isVerified: true, isActive: true };

    if (name) query.name = { $regex: name, $options: 'i' };
    if (branch) query['profile.branch'] = branch;
    if (year) query['profile.passOutYear'] = parseInt(year);
    if (company) query['profile.company'] = { $regex: company, $options: 'i' };

    const limit = 12;
    const skip = (parseInt(page) - 1) * limit;
    const total = await User.countDocuments(query);
    const alumni = await User.find(query).select('-password').sort('-createdAt').skip(skip).limit(limit);

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
      req.flash('error_msg', 'Membership certificate not available yet');
      return res.redirect('/alumni/membership');
    }

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=SVPM-Certificate-${user.alumniId}.pdf`);
    doc.pipe(res);

    // Certificate background & border
    doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40)
      .lineWidth(3).stroke('#1e3a5f');
    doc.rect(30, 30, doc.page.width - 60, doc.page.height - 60)
      .lineWidth(1).stroke('#2d6a9f');

    // Header
    doc.fontSize(28).fillColor('#1e3a5f')
      .font('Helvetica-Bold')
      .text('SVPM College of Engineering', { align: 'center' });
    doc.fontSize(16).fillColor('#2d6a9f')
      .font('Helvetica')
      .text('Alumni Association — Malegaon Bk, Baramati', { align: 'center' });

    doc.moveDown(0.5);
    doc.moveTo(100, doc.y).lineTo(doc.page.width - 100, doc.y).stroke('#1e3a5f');
    doc.moveDown(0.5);

    doc.fontSize(22).fillColor('#c8a31a').font('Helvetica-Bold')
      .text('LIFE MEMBERSHIP CERTIFICATE', { align: 'center' });

    doc.moveDown(1);
    doc.fontSize(14).fillColor('#374151').font('Helvetica')
      .text('This is to certify that', { align: 'center' });

    doc.moveDown(0.5);
    doc.fontSize(26).fillColor('#1e3a5f').font('Helvetica-Bold')
      .text(user.name, { align: 'center' });

    doc.moveDown(0.5);
    doc.fontSize(14).fillColor('#374151').font('Helvetica')
      .text(`Alumni ID: ${user.alumniId}  |  Branch: ${user.profile?.branch || 'N/A'}  |  Batch: ${user.profile?.passOutYear || 'N/A'}`,
        { align: 'center' });

    doc.moveDown(0.5);
    doc.fontSize(14).fillColor('#374151').font('Helvetica')
      .text('is a registered Life Member of the SVPM Alumni Association.', { align: 'center' });

    doc.moveDown(1);
    doc.fontSize(13).fillColor('#6b7280')
      .text(`Date of Issue: ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}`,
        { align: 'center' });

    doc.moveDown(2);
    doc.fontSize(12).fillColor('#1e3a5f').font('Helvetica-Bold')
      .text('Secretary', doc.page.width * 0.2, doc.y, { width: 150, align: 'center' });
    doc.fontSize(12).fillColor('#1e3a5f').font('Helvetica-Bold')
      .text('Principal', doc.page.width * 0.75, doc.y - 15, { width: 150, align: 'center' });

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

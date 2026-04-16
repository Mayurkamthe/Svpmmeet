const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const { verifyFirebaseToken } = require('../config/firebase');
const { sendEmail, emailTemplates } = require('../config/email');

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET || 'svpm-jwt-secret', {
  expiresIn: process.env.JWT_EXPIRE || '7d'
});

// GET /auth/login
exports.getLogin = (req, res) => {
  res.render('auth/login', { title: 'Login — SVPM Alumni' });
};

// GET /auth/register
exports.getRegister = (req, res) => {
  res.render('auth/register', { title: 'Register — SVPM Alumni' });
};

// POST /auth/register
exports.postRegister = async (req, res) => {
  try {
    const { name, email, password, confirmPassword, phone, branch, passOutYear } = req.body;

    if (password !== confirmPassword) {
      req.flash('error_msg', 'Passwords do not match');
      return res.redirect('/auth/register');
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      req.flash('error_msg', 'Email already registered');
      return res.redirect('/auth/register');
    }

    const user = await User.create({
      name, email, password, phone,
      role: 'alumni',
      authProvider: 'local',
      profile: {
        branch: branch || 'Computer Engineering',
        passOutYear: parseInt(passOutYear) || new Date().getFullYear()
      }
    });

    // Send welcome email
    const tmpl = emailTemplates.registrationConfirmation(user);
    await sendEmail({ to: user.email, ...tmpl });

    req.flash('success_msg', `Registration successful! Your Alumni ID is ${user.alumniId}. Please log in.`);
    res.redirect('/auth/login');
  } catch (err) {
    console.error('Register error:', err);
    req.flash('error_msg', 'Registration failed. Please try again.');
    res.redirect('/auth/register');
  }
};

// POST /auth/login
exports.postLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user || !user.password) {
      req.flash('error_msg', 'Invalid email or password');
      return res.redirect('/auth/login');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      req.flash('error_msg', 'Invalid email or password');
      return res.redirect('/auth/login');
    }

    if (!user.isActive) {
      req.flash('error_msg', 'Account deactivated. Contact admin.');
      return res.redirect('/auth/login');
    }

    const token = signToken(user._id);
    req.session.token = token;
    req.session.user = user.toPublicJSON();
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const redirect = user.role === 'admin' ? '/admin/dashboard' : '/alumni/dashboard';
    res.redirect(redirect);
  } catch (err) {
    console.error('Login error:', err);
    req.flash('error_msg', 'Login failed. Try again.');
    res.redirect('/auth/login');
  }
};

// POST /auth/firebase — Firebase token verification (Google/OTP)
exports.firebaseAuth = async (req, res) => {
  try {
    const { idToken, name, email, phone, photoURL, provider } = req.body;

    let firebaseUser = null;

    // Try Firebase verification (graceful fallback if not configured)
    if (idToken && idToken !== 'demo_token') {
      firebaseUser = await verifyFirebaseToken(idToken);
    }

    const userEmail = (firebaseUser?.email || email || '').toLowerCase();
    const userPhone = firebaseUser?.phone_number || phone;
    const userName = firebaseUser?.name || name || 'Alumni';
    const uid = firebaseUser?.uid || `firebase-${Date.now()}`;

    if (!userEmail && !userPhone) {
      return res.status(400).json({ success: false, message: 'Email or phone required' });
    }

    let user = await User.findOne({
      $or: [
        userEmail ? { email: userEmail } : null,
        { firebaseUid: uid }
      ].filter(Boolean)
    });

    if (!user) {
      // Auto-register
      user = await User.create({
        name: userName,
        email: userEmail || `${uid}@firebase.user`,
        phone: userPhone,
        firebaseUid: uid,
        authProvider: provider || 'google',
        avatar: photoURL || null,
        role: 'alumni',
        profile: { passOutYear: new Date().getFullYear() }
      });

      const tmpl = emailTemplates.registrationConfirmation(user);
      if (userEmail) await sendEmail({ to: userEmail, ...tmpl });
    } else {
      user.firebaseUid = uid;
      user.lastLogin = new Date();
      if (photoURL && !user.avatar) user.avatar = photoURL;
      await user.save({ validateBeforeSave: false });
    }

    const token = signToken(user._id);
    req.session.token = token;
    req.session.user = user.toPublicJSON();

    res.json({
      success: true,
      redirect: user.role === 'admin' ? '/admin/dashboard' : '/alumni/dashboard'
    });
  } catch (err) {
    console.error('Firebase auth error:', err);
    res.status(500).json({ success: false, message: 'Authentication failed' });
  }
};

// GET /auth/logout
exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('Session destroy error:', err);
    res.clearCookie('token');
    res.redirect('/');
  });
};

// GET /auth/forgot-password
exports.getForgotPassword = (req, res) => {
  res.render('auth/forgot-password', { title: 'Forgot Password — SVPM Alumni' });
};

// POST /auth/forgot-password
exports.postForgotPassword = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email.toLowerCase() });
    if (!user) {
      req.flash('error_msg', 'No account found with that email');
      return res.redirect('/auth/forgot-password');
    }

    const token = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');
    user.resetPasswordExpire = Date.now() + 30 * 60 * 1000; // 30 min
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.APP_URL}/auth/reset-password/${token}`;
    await sendEmail({
      to: user.email,
      subject: 'Password Reset — SVPM Alumni',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2 style="color: #1e3a5f;">Password Reset Request</h2>
          <p>Click the link below to reset your password (valid for 30 minutes):</p>
          <a href="${resetUrl}" style="background: #2d6a9f; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin: 20px 0;">
            Reset Password
          </a>
          <p style="color: #718096; font-size: 13px;">If you didn't request this, please ignore this email.</p>
        </div>
      `
    });

    req.flash('success_msg', 'Password reset link sent to your email');
    res.redirect('/auth/forgot-password');
  } catch (err) {
    console.error('Forgot password error:', err);
    req.flash('error_msg', 'Error sending reset email');
    res.redirect('/auth/forgot-password');
  }
};

// GET /auth/reset-password/:token
exports.getResetPassword = async (req, res) => {
  const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpire: { $gt: Date.now() }
  });

  if (!user) {
    req.flash('error_msg', 'Invalid or expired reset token');
    return res.redirect('/auth/forgot-password');
  }

  res.render('auth/reset-password', { title: 'Reset Password', token: req.params.token });
};

// POST /auth/reset-password/:token
exports.postResetPassword = async (req, res) => {
  try {
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      req.flash('error_msg', 'Invalid or expired reset token');
      return res.redirect('/auth/forgot-password');
    }

    if (req.body.password !== req.body.confirmPassword) {
      req.flash('error_msg', 'Passwords do not match');
      return res.redirect(`/auth/reset-password/${req.params.token}`);
    }

    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    req.flash('success_msg', 'Password updated successfully. Please log in.');
    res.redirect('/auth/login');
  } catch (err) {
    console.error('Reset password error:', err);
    req.flash('error_msg', 'Password reset failed');
    res.redirect('/auth/forgot-password');
  }
};

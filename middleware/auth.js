const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Ensure user is authenticated via session
const isAuthenticated = async (req, res, next) => {
  try {
    const token = req.session.token || req.cookies.token;
    if (!token) {
      req.flash('error_msg', 'Please log in to access this page');
      return res.redirect('/auth/login');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'svpm-jwt-secret');
    const user = await User.findById(decoded.id).select('-password');

    if (!user || !user.isActive) {
      req.session.destroy();
      req.flash('error_msg', 'Session expired. Please log in again.');
      return res.redirect('/auth/login');
    }

    req.session.user = user;
    res.locals.user = user;
    req.user = user;
    next();
  } catch (err) {
    req.session.destroy();
    req.flash('error_msg', 'Session expired. Please log in again.');
    res.redirect('/auth/login');
  }
};

// Ensure user is admin
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') return next();
  req.flash('error_msg', 'Access denied. Admin only area.');
  res.redirect('/alumni/dashboard');
};

// Ensure user is alumni
const isAlumni = (req, res, next) => {
  if (req.user && req.user.role === 'alumni') return next();
  req.flash('error_msg', 'Access denied.');
  res.redirect('/admin/dashboard');
};

// Redirect if already logged in
const redirectIfAuthenticated = (req, res, next) => {
  const token = req.session.token || req.cookies.token;
  if (token) {
    try {
      jwt.verify(token, process.env.JWT_SECRET || 'svpm-jwt-secret');
      const user = req.session.user;
      if (user) {
        return res.redirect(user.role === 'admin' ? '/admin/dashboard' : '/alumni/dashboard');
      }
    } catch (e) { /* continue */ }
  }
  next();
};

// Ensure alumni is approved
const isApproved = (req, res, next) => {
  if (req.user.role === 'admin') return next();
  if (!req.user.isVerified) {
    req.flash('error_msg', 'Your account is pending admin approval.');
    return res.redirect('/alumni/pending');
  }
  next();
};

module.exports = { isAuthenticated, isAdmin, isAlumni, redirectIfAuthenticated, isApproved };

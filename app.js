require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const flash = require('connect-flash');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const methodOverride = require('method-override');
const rateLimit = require('express-rate-limit');
const fileUpload = require('express-fileupload');
const path = require('path');

const app = express();

// ─── Connect MongoDB ───────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/svpm_alumni')
  .then(() => {
    console.log('✓ MongoDB connected');
    require('./config/seeder').seedAdmin();
  })
  .catch(err => console.error('✗ MongoDB error:', err));

// ─── Security Middleware ───────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'",
        "https://cdn.tailwindcss.com",
        "https://cdn.jsdelivr.net",
        "https://www.gstatic.com",
        "https://www.googleapis.com",
        "https://apis.google.com",
        "https://checkout.razorpay.com",
        "https://cdn.razorpay.com",
        "https://cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'",
        "https://cdn.tailwindcss.com",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com",
        "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      scriptSrcAttr: ["'unsafe-inline'"],
      connectSrc: ["'self'", "https://identitytoolkit.googleapis.com",
        "https://www.googleapis.com", "https://securetoken.googleapis.com",
        "https://lumberjack.razorpay.com", "https://api.razorpay.com"],
      frameSrc: ["'self'", "https://www.google.com", "https://accounts.google.com",
        "https://api.razorpay.com", "https://checkout.razorpay.com"]
    }
  }
}));

app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many login attempts, please try again after 15 minutes'
});
app.use('/auth/', authLimiter);

// ─── Core Middleware ───────────────────────────────────────────────────────────
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(methodOverride('_method'));
app.use(methodOverride(function (req, res) {
  if (req.query && req.query._method) {
    const method = req.query._method;
    delete req.query._method;
    return method;
  }
}));
app.use(fileUpload({
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 },
  useTempFiles: true,
  tempFileDir: '/tmp/',
  createParentPath: true
}));

// ─── Static Files ──────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── Session ──────────────────────────────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'svpm-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

app.use(flash());

// ─── View Engine ──────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ─── Global Template Locals ───────────────────────────────────────────────────
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  res.locals.user = req.session.user || null;
  res.locals.college = {
    name: process.env.COLLEGE_NAME || 'SVPM College of Engineering',
    location: process.env.COLLEGE_LOCATION || 'Malegaon Bk, Baramati',
    email: process.env.COLLEGE_EMAIL || 'info@svpmcoe.edu.in',
    phone: process.env.COLLEGE_PHONE || '',
    website: process.env.COLLEGE_WEBSITE || '#'
  };
  res.locals.firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID
  };
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));
app.use('/alumni', require('./routes/alumni'));
app.use('/admin', require('./routes/admin'));
app.use('/events', require('./routes/events'));
app.use('/payments', require('./routes/payments'));
app.use('/api', require('./routes/api'));

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).render('404', { title: '404 - Page Not Found' });
});

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', {
    title: 'Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong!'
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`║  SVPM Alumni Platform running on port ${PORT}   ║`);
  console.log(`║  http://localhost:${PORT}                        ║`);
  console.log(`╚══════════════════════════════════════════════╝\n`);
});

module.exports = app;

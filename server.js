require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');

// ─── Colors for terminal output ───────────────────────────────────────────────
const c = {
  reset:  '\x1b[0m',
  bright: '\x1b[1m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  cyan:   '\x1b[36m',
  blue:   '\x1b[34m',
  magenta:'\x1b[35m',
  white:  '\x1b[37m',
};

const log = {
  info:    (msg) => console.log(`${c.cyan}[INFO]${c.reset}  ${msg}`),
  success: (msg) => console.log(`${c.green}[OK]${c.reset}    ${msg}`),
  warn:    (msg) => console.log(`${c.yellow}[WARN]${c.reset}  ${msg}`),
  error:   (msg) => console.log(`${c.red}[ERROR]${c.reset} ${msg}`),
  section: (msg) => console.log(`\n${c.bright}${c.blue}──── ${msg} ────${c.reset}`),
  banner:  ()    => {
    console.log(`\n${c.bright}${c.magenta}`);
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║       SVPM Alumni Association Platform               ║');
    console.log('║       SVPM College of Engineering, Baramati          ║');
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log(c.reset);
  }
};

// ─── Startup Banner ───────────────────────────────────────────────────────────
log.banner();
log.section('Booting Server');
log.info(`Environment  : ${c.yellow}${process.env.NODE_ENV || 'development'}${c.reset}`);
log.info(`Node.js      : ${c.yellow}${process.version}${c.reset}`);
log.info(`PID          : ${c.yellow}${process.pid}${c.reset}`);
log.info(`Started at   : ${c.yellow}${new Date().toLocaleString('en-IN')}${c.reset}`);

// ─── MongoDB Connection ───────────────────────────────────────────────────────
log.section('Database');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/svpm_alumni';
log.info(`Connecting to MongoDB...`);
log.info(`URI          : ${c.yellow}${MONGODB_URI.replace(/:\/\/.*@/, '://<credentials>@')}${c.reset}`);

mongoose.set('strictQuery', false);

mongoose.connection.on('connecting',   () => log.info('MongoDB: establishing connection...'));
mongoose.connection.on('connected',    () => log.success(`MongoDB: connected to ${c.yellow}${mongoose.connection.name}${c.reset}`));
mongoose.connection.on('open',         () => log.success(`MongoDB: connection open & ready`));
mongoose.connection.on('disconnecting',() => log.warn('MongoDB: disconnecting...'));
mongoose.connection.on('disconnected', () => log.warn('MongoDB: disconnected'));
mongoose.connection.on('reconnected',  () => log.success('MongoDB: reconnected'));
mongoose.connection.on('error',        (err) => log.error(`MongoDB: ${err.message}`));

mongoose
  .connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
  .then(async () => {
    log.success(`MongoDB: database "${c.yellow}${mongoose.connection.db.databaseName}${c.reset}" selected`);
    log.info(`MongoDB: host ${c.yellow}${mongoose.connection.host}:${mongoose.connection.port}${c.reset}`);

    // ─── Seed Admin ─────────────────────────────────────────────────────
    log.section('Seeder');
    try {
      await require('./config/seeder').seedAdmin();
      log.success('Admin seed check complete');
    } catch (err) {
      log.warn(`Seeder skipped: ${err.message}`);
    }

    // ─── Load Express App ────────────────────────────────────────────────
    log.section('Express App');
    log.info('Loading app.js...');
    const app = require('./app');
    log.success('Express app loaded');

    // ─── Log Registered Routes ───────────────────────────────────────────
    log.section('Routes');
    const routes = [
      { method: 'GET/POST', path: '/auth/*',        desc: 'Authentication (login, register, reset)' },
      { method: 'ALL',      path: '/admin/*',       desc: 'Admin panel (dashboard, alumni, events)' },
      { method: 'ALL',      path: '/alumni/*',      desc: 'Alumni portal (profile, membership)'     },
      { method: 'ALL',      path: '/events/*',      desc: 'Events (list, detail, register)'         },
      { method: 'ALL',      path: '/payments/*',    desc: 'Payments & Razorpay webhook'             },
      { method: 'ALL',      path: '/api/*',         desc: 'REST API endpoints'                      },
      { method: 'GET',      path: '/',              desc: 'Public homepage'                         },
    ];
    routes.forEach(r =>
      log.info(`  ${c.green}${r.method.padEnd(9)}${c.reset} ${c.yellow}${r.path.padEnd(18)}${c.reset} → ${r.desc}`)
    );

    // ─── Middleware Info ─────────────────────────────────────────────────
    log.section('Middleware');
    log.success('Helmet (CSP, XSS, HSTS) enabled');
    log.success('CORS enabled');
    log.success('Rate limiting: 200 req/15min (API), 20 req/15min (auth)');
    log.success('Session (express-session) initialized');
    log.success('Flash messages (connect-flash) ready');
    log.success('File upload (express-fileupload) ready');
    log.success('Method override (_method) enabled');

    // ─── Config Summary ──────────────────────────────────────────────────
    log.section('Configuration');
    log.info(`SMTP Host    : ${c.yellow}${process.env.SMTP_HOST || 'smtp.gmail.com'}${c.reset}`);
    log.info(`Firebase     : ${process.env.FIREBASE_PROJECT_ID ? `${c.green}configured (${process.env.FIREBASE_PROJECT_ID})` : `${c.yellow}not configured (Google login disabled)`}${c.reset}`);
    log.info(`Razorpay     : ${process.env.RAZORPAY_KEY_ID ? `${c.green}configured` : `${c.yellow}not configured (payments disabled)`}${c.reset}`);
    log.info(`File size    : ${c.yellow}${((parseInt(process.env.MAX_FILE_SIZE) || 5242880) / 1024 / 1024).toFixed(0)} MB max upload${c.reset}`);
    log.info(`Session      : ${c.yellow}7-day cookie${c.reset}`);

    // ─── HTTP Server ─────────────────────────────────────────────────────
    log.section('HTTP Server');
    const PORT = parseInt(process.env.PORT) || 3000;
    const HOST = process.env.HOST || '0.0.0.0';

    const server = http.createServer(app);

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        log.error(`Port ${PORT} is already in use. Try: PORT=3001 npm start`);
      } else {
        log.error(`Server error: ${err.message}`);
      }
      process.exit(1);
    });

    server.listen(PORT, HOST, () => {
      log.success(`Server listening on ${c.yellow}${HOST}:${PORT}${c.reset}`);
      console.log(`\n${c.bright}${c.green}`);
      console.log('  ╔════════════════════════════════════════════════╗');
      console.log(`  ║  🌐  http://localhost:${PORT}                      ║`);
      console.log(`  ║  🔐  Admin Login : /auth/login                  ║`);
      console.log(`  ║  📧  ${(process.env.ADMIN_EMAIL || 'admin@svpmcoe.edu.in').padEnd(38)}║`);
      console.log('  ╚════════════════════════════════════════════════╝');
      console.log(c.reset + '\n');
    });

    // ─── Graceful Shutdown ───────────────────────────────────────────────
    const shutdown = (signal) => {
      log.section('Shutdown');
      log.warn(`Received ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        log.info('HTTP server closed');
        await mongoose.connection.close();
        log.info('MongoDB connection closed');
        log.success('Goodbye! 👋');
        process.exit(0);
      });
      setTimeout(() => {
        log.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));

  })
  .catch((err) => {
    log.error(`MongoDB connection FAILED: ${err.message}`);
    log.warn('Check your MONGODB_URI in .env and ensure MongoDB is running.');
    log.warn('To start MongoDB locally: mongod --dbpath /data/db');
    process.exit(1);
  });

// ─── Unhandled Rejections & Exceptions ───────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  log.error(`Unhandled Promise Rejection: ${reason}`);
});

process.on('uncaughtException', (err) => {
  log.error(`Uncaught Exception: ${err.message}`);
  log.error(err.stack);
  process.exit(1);
});
